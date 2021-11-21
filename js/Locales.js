/*@preserve Copyright (C) 2019-2021 Crawford Currie http://c-dot.co.uk license MIT*/
/* eslint-env node */

define([
	"node-getopt", "jsdom", "js/Translator", "fs-extra", "readline-sync"
], (getopt, jsdom, Translator, Fs, rl) => {

	const request = require('sync-request');
	const protection = [];

	function protect(os) {
		return os.replace(/(!=|\{|\}|\$\d*|<[^>]*>)/g, function(m, p) {
			protection.push(p);
			return `{${protection.length}}`;
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
		const s = protect(en);
		if (lengthInUtf8Bytes(s) > 500) {
			throw `Cannot auto-translate '${s}' it's > 500 bytes`;
		}
		const url = "http://api.mymemory.translated.net/get?q="
			  + encodeURIComponent(s) + "&langpair="
			  + encodeURIComponent(`en|${lang}`);
		console.log(url);
		const response = request('GET', url);
		let tx;
		if (response.statusCode !== 200)
			console.log("Bad response", response, response.body.toString());
		else {
			const result = JSON.parse(response.getBody()).responseData;
			tx = unprotect(result.translatedText);
			console.log(
				`Auto-translated '${en}' to ${lang}`,
				`as '${tx}' with confidence ${result.match}`);
		}
		return tx;
	}

	const TX = Translator.instance();
    
	/**
	 * Support for build-dist.js. Automatic string extraction and
	 * translation using mymemory.net. Not distributed.
	 */
    class Locales {

		/**
		 * @param {function} debug debug function
		 */
        constructor(debug) {
            this.strings = {};
            this.translations = {};
            this.debug = debug;
        }

		/**
		 * Load strings for translation from locale/strings
		 */
        loadStrings() {
            return Fs.readFile("locale/strings")
            .then(data => {
                this.strings = {};
                for (let s of data.toString().split("\n"))
                    this.strings[s] = "strings";
            }).catch(e => {
                console.log("No strings extracted yet", e);
                this.strings = [];
            });
        }

		/**
		 * Save a new locale/strings
		 */
        saveStrings() {
            const data = [];
            for (let s in this.strings) {
                if (this.strings[s] === "strings")
                    console.log("Removed string", s);
                else
                    data.push(s);
            }
            return Fs.writeFile("locale/strings", data.sort().join("\n"));
        }
        
        /**
         * Load reference translations from the `locale` subdir
		 * @return {Promise} Promise to load translations
         */
        loadTranslations() {
            return Fs.readdir("locale")
            .then(entries => {
                const proms = [];
                for (let entry of entries) {
                    if (/^[-a-zA-Z]+\.json$/.test(entry)) {
                        const lang = entry.replace(".json", "");
                        proms.push(
                            Fs.readFile(`locale/${entry}`, 'utf8')
                            .then(data => {
								const tx = JSON.parse(data);
								// Discard field
								let ss = Object.keys(tx);
								for (let key in tx)
									if (key !== "@metadata" &&
										typeof tx[key] === 'object')
										tx[key] = tx[key].s;
                                this.translations[lang] = tx;
                                if (this.debug) this.debug(
                                    "Translation for", lang, "loaded");
                            }));
                    }
                }
                return Promise.all(proms);
            });
        }

        /**
         * Save one translation to ./locale
		 * @return {Promise} Promise to save
         */
		saveTranslation(lang) {
            const tx = this.translations[lang];
			const file = `locale/${lang}.json`;
			const metadata = tx["@metadata"];
			metadata["last-updated"] = new Date().toISOString()
			.replace(/T.*/, "");
			console.log(`Writing ${file}`);
			return Fs.writeFile(file, JSON.stringify(tx, null, 1));
		}
		
        /**
         * Save translations to ./locale
		 * @return {Promise} Promise to save
         */
        saveTranslations() {
            const proms = [];
            for (let lang in this.translations) {
				proms.push(this.saveTranslation(lang));
            }
            return Promise.all(proms);
        }

        /**
         * Analyse a block of HTML and extract English strings
         * @param data string of HTML
		 * @return {Promise} Promise that resolves to the number of strings
         */
        html(data, source) {
            let dom;
            if (typeof data === 'string')
                dom = new jsdom.JSDOM(data);
            else
                dom = data;
            let count = 0;
            const strings = TX.findAllStrings(dom.window.document.body);
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
		 * @return {Promise} Promise that resolves to the number of strings
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
         * @param {string} lang language code e.g. fr
		 * @return {Promise} resolves when any updates have been saved
         */
        updateTranslation(lang) {

            console.log(`Translate to '${lang}'`);
			debugger;
			let modified = false;
            let translated = this.translations[lang];
            if (translated) {
				if (typeof translated["@metadata"] !== 'object') {
					translated["@metadata"] = {
						locale: lang
					};
					modified = true;
				}
			} else {
				// Needs creating
                translated = {
					"@metadata": { locale: lang }
				};
				this.translations[lang] = translated;
				modified = true;
			}

			// Translate a single string
            function _translate(en) {
                let finished = false;
                const prompt = "> ";
                
                console.log(`Translate '${en}' to ${lang}`);
                if (translated[en]) {
                    console.log(`Current: ${translated[en]}`);
                }
                console.log("t to auto-translate, <enter> to accept, x to end translation, anything else to enter a translation manually");

                while (!finished) {
                    const data = rl.question(prompt);
                    // User input exit.
                    if (data === 't') {
                        let tx = auto_translate(en, lang);
                        if (typeof tx !== 'undefined')
                            translated[en] = tx;
                    } else if (data === "") {
                        if (translated[en]) {
                            console.log(`Accepted: ${translated[en]}`);
                            return true;
                        }
                    } else if (data === "x")
                        return false;
                    else {
                        translated[en] = data;
						modified = true;
                    }
                }
				return false;
            }
            
            let en;
            for (en in translated) {
                if (en !== "@metadata" && !this.strings[en]) {
                    console.log(`Removed '${en}' from ${lang}`);
                    delete translated[en];
					modified = true;
                }
            }

            for (en in this.strings) {
                if (typeof translated[en] === 'undefined') {
                    _translate(en);
                }
            }

			if (modified)
				return this.saveTranslation(lang);

			return Promise.resolve();
        }

        /**
		 * Update all known translations
		 * @return {Promise} resolves when updates have been saved
         */
        updateTranslations() {
            // Don't send more than one request at a time, and respect
            // rate-limiting
			const promises = [];
            for (let lang in this.translations) {
                promises.push(this.updateTranslation(lang));
            }
			return Promise.all(promises);
        }
    }
    
    return Locales;
});
