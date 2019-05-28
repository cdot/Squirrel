/*@preserve Copyright (C) 2019 Crawford Currie http://c-dot.co.uk license MIT*/
/* eslint-env node */

/**
 * Support for build-dist.js. Automatic string extraction and
 * translation. Development only.
 */
define(["node-getopt", "jsdom", "js/Translator", "fs-extra", "request"], function(getopt, jsdom, Translator, Fs, request) {

    let TX = Translator.instance();
    
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
                    this.strings[s] = true;
            }).catch((e) => {
                console.log("No strings extracted yet", e);
                this.strings = [];
            });
        }

        saveStrings() {
            let data = [];
            for (let s in this.strings)
                data.push(s);
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
                    if (entry == "strings")
                        continue;
                    if (/\.json$/.test(entry)) {
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
                if (this.debug) this.debug("Writing",dir + lang + ".json");
                proms.push(Fs.writeFile(
                    dir + lang + ".json", JSON.stringify(tx)));
            }
            return Promise.all(proms);
        }

        /**
         * Analyse a block of HTML and extract English strings
         * @param data string of HTML
         */
        html(data) {
            let dom;
            if (typeof data === "string")
                dom = new jsdom.JSDOM(data);
            else
                dom = data;
            let count = 0;
            let strings = TX.findAllStrings(dom.window.document.body);
            for (let s of strings) {
                if (!this.strings[s]) {
                    count++;
                    this.strings[s] = true;
                }
            }
            return Promise.resolve(count);
        }

        /**
         * Analyse a block of JS and extract English strings
         * @param data string of JS
         */
        js(data) {
            let count = 0;
            data.replace(
                /\.tx\((["'])(.+?[^\\])\1/g,
                (match, quote, str) => {
                    if (!this.strings[str]) {
                        this.strings[str] = true;
                        count++;
                    }
                    return "";
                });
            return Promise.resolve(count);
        }

        /**
         * Update the translation for the given language
         * @param lang language code e.g. fr
         * @param improve true to re-translate existing known strings
         */
        updateTranslation(lang, improve) {
            let self = this;
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

            function _getURL(url, tries, resolve, reject) {
                request.get(url)
                .on('response', function(response) {
                    if (response.statusCode === 429) {
                        if (tries === 0) {
                            if (self.debug) self.debug(
                                "Too many retries, giving up on", url);
                            reject("rate limited " + url);
                            return;
                        }
                        let waitFor = response.headers["retry-after"];
                        if (self.debug) self.debug(
                            url, "is rate limited, waiting for",
                            waitFor, "seconds");
                        setTimeout(() => {
                            _getURL(url, --tries, resolve, reject);
                        }, waitFor * 1000);
                        return;           
                    }
                    else if (response.statusCode !== 200) {
                        if (self.debug) self.debug("Bad response", response);
                        reject(url + " error " + response.statusCode);
                        return;
                    }
                    let body = '';
                    response.on('data', (chunk) => {
                        body += chunk;
                    });
                    response.on('end', () => {
                        let result = JSON.parse(body).responseData;
                        resolve({
                            m: result.match,
                            s: unprotect(result.translatedText)
                        });
                    });
                });
            }

            function getURL(url) {
                return new Promise((resolve, reject) => {
                    _getURL(url, 0, resolve, reject);
                })
            }
            
            function _process(en, translated) {
                let s = protect(en);
                if (lengthInUtf8Bytes(s) > 500) {
                    throw "Cannot auto-translate " + s
                    + " it's > 500 bytes";
                }
                let url = "http://api.mymemory.translated.net/get?q="
                    + encodeURIComponent(s) + "&langpair="
                    + encodeURIComponent("en|" + lang);
                return getURL(url)
                .then((tx) => {
                    if (self.debug) self.debug(
                        "Translated", "'" + en +
                        "'", "to", lang, "'" + tx.s +
                        "'", "with confidence", tx.m);
                    if (!translated[en] || translated[en].m < tx.m) {
                        translated[en] = tx;
                        if (self.debug) self.debug("Translation accepted");
                    }
                })
                .catch((e) => {
                    console.debug("Gave up on", url);
                });
            }
            
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

            // mymemory translation is rate-limited, and we get in
            // trouble if we fling too many requests too quickly.
            // So sequence the requests, and respect 429.
            let promise = Promise.resolve();
            for (en in this.strings) {
                if (!translated[en] || improve) {
                    if (this.debug) this.debug("Must translate","'"+en+"'",'to',lang);
                    let p = _process(en, translated);
                    promise = promise.then(() => p);
                }
            }
            
            return promise;
        }

        /**
         * @param improve true to re-translate existing known strings
         */
        updateTranslations(improve) {
            let promise = Promise.resolve();
            // Don't send more than one request at a time, and respect
            // rate-limiting
            for (let lang in this.translations) {
                promise = promise.then(() => {
                    return this.updateTranslation(lang, improve);
                });
            }
            return promise;
        }
    }
    
    return Locales;
});
