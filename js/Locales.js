/*@preserve Copyright (C) 2019 Crawford Currie http://c-dot.co.uk license MIT*/
/* eslint-env node */

let request = require('sync-request');
let protection = [];

function protect(os) {
    return os.replace(/(!=|\{|\}|\$\d*|<[^>]*>)/g, function(m, p) {
        protection.push(p);
        return "{" + protection.length + "}";
    });
}

function unprotect(ns) {
    return ns.replace(/{(\d+)}/g, function(m, i) {
        return protection[parseInt(i)];
    });
}

function lengthInUtf8Bytes(str) {
    // Matches only the 10.. bytes that are non-initial
    // characters in a multi-byte sequence.
    var m = encodeURIComponent(str).match(/%[89ABab]/g);
    return str.length + (m ? m.length : 0);
}

// mymemory translation is rate-limited, and we get in
// trouble if we fling too many requests too quickly.
// So sequence the requests, and respect 429.
function auto_translate(en, lang) {
    let s = protect(en);
    if (lengthInUtf8Bytes(s) > 500) {
        throw "Cannot auto-translate " + s
        + " it's > 500 bytes";
    }
    let url = "http://api.mymemory.translated.net/get?q="
        + encodeURIComponent(s) + "&langpair="
        + encodeURIComponent("en|" + lang);
    console.log("Sending",url);
    let response = request('GET', url);
    let tx;
    if (response.statusCode !== 200)
        console.log("Bad response", response);
    else {
        let result = JSON.parse(response.getBody()).responseData;
        tx = {
            m: result.match,
            s: unprotect(result.translatedText)
        };
        console.log(
            "Auto-translated", "'" + en +
            "'", "to", lang, "'" + tx.s +
            "'", "with confidence", tx.m);
    }
    return tx;
}

/**
 * Support for build-dist.js. Automatic string extraction and
 * translation. Development only.
 */
define(["node-getopt", "jsdom", "js/Translator", "fs-extra", "readline-sync"], function(getopt, jsdom, Translator, Fs, rl) {

    let TX = Translator.instance();
    let readline;
    
    class Locales {

        constructor(debug) {
            this.strings = {};
            this.translations = {};
            this.debug = debug;
        }

        loadStrings() {
            return Fs.readFile("locale/strings")
            .then((data) => {
                this.strings = {};
                for (let s of data.toString().split("\n"))
                    this.strings[s] = "strings";
            }).catch((e) => {
                console.log("No strings extracted yet", e);
                this.strings = [];
            });
        }

        saveStrings() {
            let data = [];
            for (let s in this.strings) {
                if (this.strings[s] === "strings")
                    console.log("Removed string", s);
                else
                    data.push(s);
            }
            return Fs.writeFile("locale/strings", data.sort().join("\n"));
        }
        
        /**
         * Load reference translations from the "locale" subdir
         */
        loadTranslations() {
            let self = this;
            return Fs.readdir("locale")
            .then((entries) => {
                let proms = [];
                for (let entry of entries) {
                    if (/^[-a-zA-Z]+\.json$/.test(entry)) {
                        let lang = entry.replace(".json", "");
                        proms.push(
                            Fs.readFile("locale/" + entry, 'utf8')
                            .then(function(data) {
                                self.translations[lang] = JSON.parse(data);
                                if (self.debug) self.debug(
                                    "Translation for", lang, "loaded");
                            }));
                    }
                }
                return Promise.all(proms);
            });
        }

        /**
         * Save translations to dir/locale (defaults to ./locale)
         */
        saveTranslations(dir) {
            dir = (dir ? (dir + "/") : "") + "locale/";
            let proms = [];
            for (let lang in this.translations) {
                let tx = this.translations[lang];
                console.log("Writing", dir + lang + ".json");
                proms.push(Fs.writeFile(
                    dir + lang + ".json", JSON.stringify(tx)));
            }
            return Promise.all(proms);
        }

        /**
         * Analyse a block of HTML and extract English strings
         * @param data string of HTML
         */
        html(data, source) {
            let dom;
            if (typeof data === "string")
                dom = new jsdom.JSDOM(data);
            else
                dom = data;
            let count = 0;
            let strings = TX.findAllStrings(dom.window.document.body);
            for (let s of strings) {
                if (!this.strings[s])
                    count++;
                this.strings[s] = source;
            }
            return Promise.resolve(count);
        }

        /**
         * Analyse a block of JS and extract English strings
         * @param data string of JS
         */
        js(data, source) {
            let count = 0;
            data.replace(
                /\.tx\((["'])(.+?[^\\])\1/g,
                (match, quote, str) => {
                    if (!this.strings[str])
                        count++;
                    this.strings[str] = source;
                    return "";
                });
            return Promise.resolve(count);
        }

        /**
         * Update the translation for the given language
         * @param lang language code e.g. fr
         * @param improve integer to re-translate existing known strings
         * below this confidence level
         */
        updateTranslation(lang, improve) {
            let self = this;

            function _translate(en, translated) {
                let finished = false;
                let prompt = "> ";
                
                console.log("Translate:", en);
                if (translated[en]) {
                    console.log("Current:", translated[en].s,
                                "with confidence", translated[en].m);
                }
                console.log("t to auto-translate, <enter> to accept, x to end translation, anything else to enter a translation manually");

                while (!finished) {
                    let data = rl.question(prompt);
                    // User input exit.
                    if (prompt === "> ") {
                        if (data === 't') {
                            let tx = auto_translate(en, lang);
                            if (tx)
                                translated[en] = tx;
                        } else if (data === "") {
                            if (translated[en]) {
                                console.log(
                                    "Accepted:", translated[en].s,
                                    "with confidence", translated[en].m);
                                return true;
                            }
                        } else if (data === "x")
                            return false;
                        else {
                            prompt = "confidence: ";
                            translated[en] = { s: data, m: 0 };
                        }
                    } else {
                        if (/^[0-9.]+$/.test(data) && parseFloat(data) <= 1)
                            translated[en].m = parseFloat(data);
                        console.log("Current:", translated[en].s,
                                    "with confidence", translated[en].m);
                        prompt = "> ";
                    }
                }
            }
            
            console.log("Translate to", lang, "confidence <", improve);

            let translated = this.translations[lang];
            if (!translated)
                this.translations[lang] = translated = {};
            let en;

            for (en in translated) {
                if (!this.strings[en]) {
                    if (this.debug) this.debug("Removed", "'" + en + "'",
                                "from", lang);
                    delete translated[en];
                }
            }

            for (en in this.strings) {
                if (!translated[en] || translated[en].m < improve) {
                    if (!_translate(en, translated))
                        return false;
                }
            }
            
            return true;
        }

        /**
         * @param improve integer to re-translate existing known strings
         * below this confidence level
         */
        updateTranslations(improve) {
            // Don't send more than one request at a time, and respect
            // rate-limiting
            for (let lang in this.translations) {
                if (!this.updateTranslation(lang, improve))
                    break;
            }
        }
    }
    
    return Locales;
});
