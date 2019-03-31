/*@preserve Copyright (C) 2019 Crawford Currie http://c-dot.co.uk license MIT*/
/* eslint-env node */

/**
 * Support for build-dist.js. Automatic string extraction and
 * translation. Development only.
 */
define(["node-getopt", "jsdom", "js/Translator", "fs-extra", "request"], function(getopt, jsdom, Translator, Fs, request) {

    TX = Translator.instance();
    
    class Locales {

        constructor(debug) {
            this.strings = [];
            this.translations = {};
            this.debug = debug;
        }

        /**
         * Load reference translations from the "locale" subdir
         */
        loadTranslations() {
            let self = this;
            return Fs.readdir("locale")
            .then((entries) => {
                let proms = [];
                for (let i in entries) {
                    let entry = entries[i];
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
            let strings = TX.findAllStrings(dom.window.document.body);
            for (let i in strings) {
                this.strings[strings[i]] = true;
            }
            return Promise.resolve();
        }

        /**
         * Analyse a block of JS and extract English strings
         * @param data string of JS
         */
        js(data) {
            data.replace(
                /\b(?:TX|Translator\.instance\(\))\.tx\((["'])(.+?[^\\])\1/g,
                (m, q, s) => {
                    this.strings[s] = true;
                    return "";
                });
            return Promise.resolve();
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
                return os.replace(/(\{|\}|\$\d*|<[^>]*>)/g, function(m, p) {
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

            function getURL(url, tries) {
                return new Promise((resolve, reject) => {
                    console.log("GET",url);
                    request.get(url)
                    .on('response', function(response) {
                        if (response.statusCode === 429) {
                            if (tries === 0)
                                reject("Too many retries, giving up on "
                                       + url);
                            let waitFor = response.headers["retry-after"];
                            if (this.debug) this.debug(
                                url, "try",tries,
                                "is rate limited, waiting for",
                                waitFor, "seconds");
                            setTimeout(() => {
                                getURL(url, --tries)
                                .then((body) => { resolve(body); })
                                .catch((e) => {
                                    reject(e);
                                });
                            }, waitFor * 1000);
                            return;           
                        }
                        if (response.statusCode !== 200) {
                            reject(url + " error " + response.statusCode);
                            return;
                        }
                        let body = '';
                        response.on('data', (chunk) => {
                            body += chunk;
                        });
                        response.on('end', () => {
                            let result = JSON.parse(body);
                            console.log(result);
                            resolve({
                                m: result.match,
                                s: unprotect(result.translatedText)
                            });
                        });
                    });
                });
            }

            function _process(en, translated) {
                let p;
                if (improve) {
                    let s = protect(en);
                    if (lengthInUtf8Bytes(s) > 500) {
                        throw "Cannot auto-translate " + s
                        + " it's > 500 bytes";
                    }
                    let url = "http://api.mymemory.translated.net/get?q="
                        + encodeURIComponent(s) + "&langpair="
                        + encodeURIComponent("en|" + lang);
                    p = getURL(url, 3);
                } else
                    // Keep the English string for manual processing
                    p = Promise.resolve({ m: -1, s: en });

                return p
                .then((tx) => {
                    if (!translated[en] || translated[en].m < tx.m) {
                        translated[en] = tx;
                        if (self.debug) self.debug("Translated", "'" + en +
                                    "'", "to", lang, "'" + tx.s +
                                    "'", "with confidence", tx.m);
                    }
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
                    promise = promise.then(_process(en, translated));
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
