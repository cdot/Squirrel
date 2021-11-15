/*@preserve Copyright (C) 2015-2021 Crawford Currie http://c-dot.co.uk license MIT*/
/* eslint-env browser,node */

if (typeof XMLHttpRequest === "undefined")
    XMLHttpRequest = require("xhr2");

define("js/Translator", ["js/Utils", "js/Serror"], function(Utils, Serror) {

    const TIMEUNITS = {
        // TX.tx("$1 year$?($1!=1,s,)")
        y: "$1 year$?($1!=1,s,)",
        // TX.tx("$1 month$?($1!=1,s,)")
        m: "$1 month$?($1!=1,s,)",
        // TX.tx("$1 day$?($1!=1,s,)")
        d: "$1 day$?($1!=1,s,)"
    };

	/**
	 * Translations module. Guesses the language to use from cookies, or
	 * from the browser locale, or it can be changed using language()
	 *
	 * Translatable strings are format strings that may be populated
	 * with expandable arguments `$1..$N`. Includes an Elvis operator
	 * for more flexibility in defining plurals.
	 *
	 * Strings are picked up from code and from HTML. In code, a call to
	 * the tx() method of the singleton translator instance will return
	 * the (expanded) translation of the string.
	 *
	 * Strings can also be drawn from HTML using classes.
	 * * `TX_title` will automate the translation of the title= tag in
	 *   that node.
	 * * `TX_text` will translate all text nodes and title attributes in the
	 *   HTML under the tagged node, recursively.
	 * 
	 * Individual text nodes are translated individually, so `x<b>y</b>z`
	 * will require tranlations of 3 strings, `x`, `y` and `z`. Alternatively
	 * `TX_html` can be used to perform a translation of the inner HTML
	 * of the node.
	 *
	 * `TX_text` and `TX_html` should never be used together on the same node.
	 * Reaping strings from source code is done by the `build/extractTX.js`
	 * node.js script.
	 *
	 * Implementation requires a locale URL that has `strings` (a file of
	 * English strings) and `<locale>.json` URLS, one for each language, named
	 * using the language code e.g. `de.json`.
	 */
    class Translator {

        /**
         * @param {object} options
         * @param {string} options.url base URL under which to find
         * language files. `files` and `translations` ignored if set
         * @param {string} options.files base file path under which to
         * find language files Ignored is `'url` set, `translations`
         * ignored if set
         * @param {Object.<string,string>} options.translations used if
		 * neither `url` nor `files` is given.
		 * @param {function} options.debug optional debug function
         */
        constructor(options) {
            if (typeof options === "undefined")
                options = {};
            this.options = options;
            this.debug = options.debug;

            // Can't attach arbitrary data to DOM nodes, so whenever we
            // translate a DOM node we need to record the original string
            // that was in the node. This is done using a WeakMap from the
            // node to a cache of original English strings. Each entry for
            // a node has three possible fields; title, text and html,
            // that represent the content of the node for each case.
            this.originals = undefined;
        }

        /**
		 * Simplify a string for lookup in the translations table
		 * @private
		 */
        static _clean(s) {
            return s
                .replace(/\s+/g, " ")
                .replace(/^ /, "")
                .replace(/ $/, "");
        }

        /**
         * Promise to initialise the language. Required before the language
         * can be used. Finds and translates marked strings in the given DOM.
         * @param {string} lingo two-character language code e.g. 'en', 'de',
		 * 'fr'
         * @param {jQuery} document optional DOM
		 * @return {Promise} resolves to the name of the language
         */
        language(lingo, document) {

            if (this.originals) {
                if (this.debug) this.debug("Untranslating");
                // If there is already a language applied, unapply it.
                // It would have been cleaner if we could have iterated over
                // the originals, but it's a WeakMap which can't be iterated
                // so we have to re-un-translate the document.
                const bod = document.getElementsByTagName("body");
                this._translateDOM(bod[0], function (s) {
                    return s;
                });
                // originals no longer needed, will regenerate if necessary
                // when the DOM is re-translated
                this.originals = undefined;
            }

            lingo = lingo || this.lingo || "en";
			this.lingo = lingo;

            if (lingo === "en") {
                // English, so no need to translate the DOM
                if (this.debug) this.debug("Using English");
                return Promise.resolve(lingo);
            }

            // Load the language
            let getter;
            if (this.options.url) {
                const xhr = new XMLHttpRequest();
                let url = `${this.options.url}/${lingo}.json`;
                if (this.debug) this.debug("Get language from", url);
                if (this.debug)
                    url = `${url}?nocache=${Date.now()}`;
                xhr.open("GET", url, true);
                getter = new Promise((resolve, reject) => {
					try {
						xhr.send();
					} catch (e) {
						reject(new Serror(400, [ url ], e));
					}
				
                    xhr.onreadystatechange = function() {
                        if (xhr.readyState != 4)
                            return;
                        if (xhr.status === 200) {
                            try {
                                resolve(JSON.parse(xhr.response));
                                return;
                            } catch (e) {
                                reject(new Serror(400, [ url ], e));
                            }
                        }
                        reject(new Serror(xhr.status, [ url ],
                                          xhr.statusText));
                    };

                    xhr.ontimeout = function() {
                        reject(new Serror(408, "Timeout exceeded"));
                    };
                });
            } else if (this.options.files) {
                // Specific to node.js - no browser support!
                getter = Utils.require("fs")
				.then(fs => fs.promises.readFile(
					`${this.options.files}${lingo}.json`))
                .then(json => JSON.parse(json));
            } else if (this.options.translations) {
                getter = Promise.resolve(this.options.translations[lingo]);
            }

            return getter.then(data => {
                this.translations = data;
                if (document) {
                    // Translate the DOM
                    if (this.debug) this.debug("Translating body to", lingo);
                    const bod = document.getElementsByTagName("body");
                    this.translate(bod[0]);
                }
                if (this.debug) this.debug("Using language", lingo);
				return lingo;
            })
            .catch(e => {
                if (this.debug) this.debug("Could not load language", lingo);
                const generic = lingo.replace(/-.*/, "");
                if (generic !== lingo) {
                    if (this.debug) this.debug("Trying fallback", generic);
                    return this.language(generic, document);
                }
				return undefined;
            });
        }

        /**
         * Find all tagged strings under the given DOM node and translate them
         * in place.
		 * @param {jQuery} dom DOM node to translate recursively
         */
        translate(dom) {
            if (!this.translations)
                return; // no language loaded
            if (!this.originals)
                this.originals = new WeakMap();
            this._translateDOM(dom, function (s) {
                const tx = this.translations[Translator._clean(s)];
                if (typeof tx !== "undefined")
                    s = tx.s;
                return s;
            });
        }

        /**
         * Find all tagged strings under the given DOM node and translate them
         * in place. The original string is held in dataset so that dynamic changes
         * of language are possible (requires HTML5 dataset)
         * @param node root of the DOM tree to process
         * @param translate function to call on each string to perform the
         * translation. If this function returns undefined, the string will
         * not be translated.
         * @param translating boolean that indicates whether to translate text
         * nodes encountered. Initially false, it is set true whenever a node
         * is encountered with `TX_text`.
         * @private
         */
        _translateDOM(node, translate, translating) {
            function hasClass(element, thatClass) {
                return (` ${element.className} `
                        .replace(
                                /\s+/g, " ")
                        .indexOf(` ${thatClass} `) >= 0);
            }

            let t, attrs;

            if (!this.originals.has(node))
                this.originals.set(node, attrs = {});
            else
                attrs = this.originals.get(node);

            if (node.nodeType == 3) {
                // text node
                if (translating && /\S/.test(node.nodeValue)) {
                    t = attrs.text;
                    if (typeof t === "undefined")
                        attrs.text = t = node.nodeValue;
                    if (t) {
                        t = translate.call(this, t);
                        if (t)
                            node.nodeValue = t;
                    }
                }
            } else {
                if (translating || hasClass(node, "TX_title")) {
                    t = attrs.title;
                    if (typeof t === "undefined")
                        attrs.title = t = node.title;
                    if (t) {
                        t = translate.call(this, t);
                        if (typeof t !== "undefined")
                            node.title = t;
                    }
                }
                if (hasClass(node, "TX_html")) {
                    t = attrs.html;
                    if (typeof t === "undefined")
                        attrs.html = t = node.innerHTML;
                    if (t) {
                        t = translate.call(this, t);
                        if (t)
                            node.innerHTML = t;
                    }
                } else {
                    if (hasClass(node, "TX_text"))
                        translating = true;

                    if (node.childNodes) {
                        for (let i = 0, len = node.childNodes.length; i < len; ++i) {
                            this._translateDOM(node.childNodes[i], translate, translating);
                        }
                    }
                }
            }
        }

        /**
         * Analyse a DOM and generate a list of all translatable strings found.
         * This can be used to seed the translations table.
         * @param el root element of the DOM tree to analyse
		 * @return {string[]} list of translatable strings
         */
        findAllStrings(el) {
            const strings = [], seen = {}; // use a map to uniquify
            this.originals = new WeakMap();
            this._translateDOM(el, s => {
                s = Translator._clean(s);
                if (!seen[s]) {
                    strings.push(s);
                    seen[s] = true;
                }
                return undefined;
            }, false);
            return strings.sort();
        }

        /**
         * Translate and expand a string (and optional parameters)
         * using the current translation. Translator.init() must have
         * been called with a Translator instance before tx() can be
         * called.
         * @param {string} s the string to expand. All other arguments are used
         * to expand placeholders in the string, per Utils.expandTemplate
         * (unless noexpand is given)
         * @param {boolean} noexpand don't expand template strings
		 * @return {object[]} the arguments passed to the function
         */
        tx() {
            // Look up the translation
            const txes = this.translations;
            if (txes) {
                const tx = txes[Translator._clean(arguments[0])];
                if (typeof tx !== "undefined")
                    arguments[0] = tx.s;
                // else use English
            }

            if (/\$/.test(arguments[0]))
                return Utils.expandTemplate.apply(null, arguments);

            return arguments[0];
        }

        /**
         * Given a time value, return a string describing the period
         * between a given time and that time. For example, "1 year
         * 6 months 4 days 3 hours 2 minutes 5 seconds".
         * @param {number} from absolute start date, as a number of ms
         * since the epoch.
         * @param {number} to end of the period, as a number of ms
         * since the epoch
         * @param {boolean} hms if true, add hours, minutes and
         * seconds. Default is days.
         * @return {string} describing the period in the current language
         */
        deltaTimeString(from, to, hms) {
            const deltaDate = new Date(to - from);
            const s = [];

            let delta = deltaDate.getUTCFullYear() - 1970;
            if (delta > 0)
                s.push(this.tx(TIMEUNITS.y, delta));

            // Normalise to year zero
            deltaDate.setUTCFullYear(1970);

            delta = deltaDate.getUTCMonth();
            if (delta > 0)
                s.push(this.tx(TIMEUNITS.m, delta));

            // Normalise to the same month (January)
            deltaDate.setUTCMonth(0);

            delta = deltaDate.getUTCDate();
            if (delta > 0 || s.length === 0)
                s.push(this.tx(TIMEUNITS.d, delta));

            if (hms)
                s.push(`00${deltaDate.getUTCHours()}`.slice(-2)
                       + ":" + `00${deltaDate.getUTCMinutes()}`.slice(-2)
                       + ":" + `00${deltaDate.getUTCSeconds()}`.slice(-2));
 
            return s.join(" ");
        }

        /**
         * Create a singleton instance of Translator
         * @param {object} p options to pass to constructor
         * @return {Translator} a new instance of Translator that will
         * be used in subsequent calls to static methods
         */
        static instance(p) {
            if (typeof p !== "undefined"
                || typeof Translator.inst === "undefined") {
                Translator.inst = new Translator(p);
            }
            return Translator.inst;
        }
    }

    Translator.inst = undefined;

    return Translator;
});
