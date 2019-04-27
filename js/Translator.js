/*@preserve Copyright (C) 2015-2019 Crawford Currie http://c-dot.co.uk license MIT*/
/* eslint-env browser,node */
/* global XMLHttpRequest:true */

/**
 * Translations module. Guesses the language to use from cookies, or
 * from the browser locale, or it can be changed using language()
 *
 * Translatable strings are format strings that may be populated with
 * expandable arguments `$1..$N`.
 *
 * Strings are picked up from code and from HTML. In code, a call to
 * the tx() method of the singleton translator instance will return
 * the (expanded) translation of the string.
 *
 * Strings can also be drawn from HTML using classes.
 * 'TX_title' will automate the translation of the title= tag in that node.
 * 'TX_text' will translate all text nodes and title attributes in the
 * HTML under the tagged node, recursively.
 * Individual text nodes are translated individually, so "x<b>y</b>z"
 * will require tranlations of 3 strings, "x", "y" and "z".
 * 'TX_html'
 * TX_text and TX_html should never be used together on the same node.
 * HTML reaping is done by the build/extractTX.js node.js script.
 *
 * Implementation requires a "locale" URL that has "strings" (a file of
 * English strings) and <locale>.json URLS, one for each language, named
 * using the language code.
 */
if (typeof XMLHttpRequest === "undefined")
    XMLHttpRequest = require("xhr2");

define("js/Translator", ["js/Utils", "js-cookie"], function(Utils, Cookies) {

    class Translator {

        /**
         * @param options
         * url: base URL under which to find language files
         * files: base file path under which to find language files
         * translations: reference to object contaiing translations
         * url overrides files overrides translations
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

        /* Simplify a string for lookup in the translations table */
        static _clean(s) {
            return s
                .replace(/\s+/g, " ")
                .replace(/^ /, "")
                .replace(/ $/, "");
        }

        /**
         * Promise to initialise the language. Required before the language
         * can be used. Finds and translates marked strings in the given DOM.
         * @param lingo two-character language code e.g. 'en', 'de', 'fr'
         * @param document optional DOM
         */
        language(lingo, document) {
            if (!this.lingo)
                this.lingo = Cookies.get("tx_lang");
            if (!this.lingo && window && window.navigator)
                this.lingo = (window.navigator.userLanguage
                              || window.navigator.language);
            if (!this.lingo)
                this.lingo = "en";

            if (typeof lingo === "undefined")
                return Promise.resolve(this.lingo);

            if (this.originals) {
                if (this.debug) this.debug("Untranslating");
                // If there is already a language applied, unapply it.
                // It would have been cleaner if we could have iterated over
                // the originals, but it's a WeakMap which can't be iterated
                // so we have to re-un-translate the document thisead.
                let bod = document.getElementsByTagName("body");
                this._translateDOM(bod[0], function (s) {
                    return s;
                });
                // originals no longer needed, will regenerate if necessary
                // when the DOM is re-translated
                this.originals = undefined;
            }

            if (typeof Cookies !== "undefined") {
                // Won't apply until we clear caches and restart
                Cookies.set("tx_lang", lingo, {
                    expires: 365
                });
            }
            this.lingo = lingo;
            if (this.debug) this.debug("Using language '" + lingo + "'");

            if (/^en(\b|$)/i.test(lingo)) {
                // English, so no need to translate the DOM
                return Promise.resolve();
            }

            // Load the language
            let getter;
            if (this.options.url) {
                let xhr = new XMLHttpRequest();
                let url = this.options.url + "/" + lingo + ".json";
                if (this.debug) this.debug("Get language from", url);
                if (this.debug)
                    url = url + "?nocache=" + Date.now();
                xhr.open("GET", url, true);
                xhr.send();

                getter = new Promise((resolve, reject) => {
                    xhr.onreadystatechange = function() {
                        if (xhr.readyState === 4)
                            resolve(JSON.parse(xhr.response));
                    };

                    xhr.ontimeout = function() {
                        reject(new Error("Timeout exceeded"));
                    };
                });
            } else if (this.options.files) {
                // Specific to node.js - no browser support!
                const fs = require("fs-extra");
                getter = fs.readFile(this.options.files + lingo + ".json")
                .then((json) => {
                    return JSON.parse(json);
                });
            } else if (this.options.translations) {
                getter = Promise.resolve(this.options.translations[lingo]);
            }

            return getter.then((data) => {
                if (!data)
                    throw "No TX for "+lingo;
                this.translations = data;
                if (document) {
                    // Translate the DOM
                    let bod = document.getElementsByTagName("body");
                    this.translate(bod[0]);
                }
                if (this.debug) this.debug("Using language '" + lingo + "'");
            });
        }

        /**
         * Find all tagged strings under the given DOM node and translate them
         * in place
         */
        translate(dom) {
            if (!this.translations)
                return; // no language loaded
            if (!this.originals)
                this.originals = new WeakMap();
            this._translateDOM(dom, function (s) {
                let tx = this.translations[Translator._clean(s)];
                if (typeof tx !== "undefined")
                    return tx.s;
                return s;
            })
        }

        /**
         * @private
         * Find all tagged strings under the given DOM node and translate them
         * in place. The original string is held in dataset so that dynamic changes
         * of language are possible (requires HTML5 dataset)
         * @param node root of the DOM tree to process
         * @param translate function to call on each string to perform the
         * translation. If this function returns undefined, the string will
         * not be translated.
         * @param translating boolean that indicates whether to translate text
         * nodes encountered. Initially false, it is set true whenever a node
         * is encountered with TX_text.
         */
        _translateDOM(node, translate, translating) {
            function hasClass(element, thatClass) {
                return ((" " + element.className + " ")
                        .replace(
                                /\s+/g, " ")
                        .indexOf(" " + thatClass + " ") >= 0);
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
         */
        findAllStrings(el) {
            let strings = [], seen = {}; // use a map to uniquify
            this.originals = new WeakMap();
            this._translateDOM(el, (s) => {
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
         * Translate and expand a string (and optional
         * parameters) using the current translator. Translator.init() must
         * have been called with a Translator instance before tx() can be
         * called.
         * @param s the string to expand. All other arguments are used
         * to expand placeholders in the string, per Utils.expandTemplate
         * (unless noexpand)
         * @param noexpand don't expand template strings
         */
        tx() {
            // Look up the translation
            let txes = this.translations;
            if (txes) {
                let tx = txes[Translator._clean(arguments[0])];
                if (typeof tx !== "undefined")
                    arguments[0] = tx.s;
                // else use English
            }

            if (/\$/.test(arguments[0]))
                return Utils.expandTemplate.apply(null, arguments);

            return arguments[0];
        }

        /**
         * Given a time value, return a breakdown of the period between now
         * and that time. For example, "1 years 6 months 4 days". Resolution is
         * days. Any time less than a day will be reported as 0 days.
         * @param time either a Date object specifying an absolute time or
         * a number of ms until the time/
         * @return array of structures each containing `id`
         * (one of `d`, `w`, `m`, `y`),
         * `number` of those, and `name` translated pluralised name e.g. `months`
         */
        deltaTimeString(date) {
            date = new Date(date.getTime() - Date.now());

            let s = [];

            let delta = date.getUTCFullYear() - 1970;
            if (delta > 0)
                s.push(this.tx(Translator.TIMEUNITS.y.format, delta));

            // Normalise to year zero
            date.setUTCFullYear(1970);

            delta = date.getUTCMonth();
            if (delta > 0)
                s.push(this.tx(Translator.TIMEUNITS.m.format, delta));

            // Normalise to the same month (January)
            date.setUTCMonth(0);

            delta = date.getUTCDate();
            if (delta > 0 || s.length === 0)
                s.push(this.tx(Translator.TIMEUNITS.d.format, delta));

            return s.join(" ");
        }

        /**
         * Set an instance of Translator
         * @param p options to pass to constructor
         * @return a new instance of Translator that will be used in subsequent
         * calls to static methods
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

    Translator.TIMEUNITS = {
        y: {
            days: 360,
            ms: 364 * 24 * 60 * 60 * 1000,
            // TX.tx("$1 year$?($1!=1,s,)")
            format: "$1 year$?($1!=1,s,)"
        },
        m: {
            days: 30,
            ms: 30 * 24 * 60 * 60 * 1000,
            // TX.tx("$1 month$?($1!=1,s,)")
            format: "$1 month$?($1!=1,s,)"
        },
        d: {
            days: 1,
            ms: 24 * 60 * 60 * 1000,
            // TX.tx("$1 day$?($1!=1,s,)")
            format: "$1 day$?($1!=1,s,)"
        }
    };

    return Translator;
});
