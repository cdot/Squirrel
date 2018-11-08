/*@preserve Copyright (C) 2015-2017 Crawford Currie http://c-dot.co.uk license MIT*/

/* eslint-env jquery */
/* eslint no-eval: 1 */
/* global global:true */
/* global module */
/* global Utils */
/* global Cookies */

/**
 * Translations module. Guesses the language to use from cookies, or
 * from the browser locale.
 *
 * Translatable strings are declared in code using `TX.tx(string)`.
 * These are format strings that may be populated with expandable arguments
 * `$1..$N`, for example: `TX.text("$1 days of Christmas", 12)`
 *
 * Strings can also be reaped from HTML using classes:
 * `<... class="TX_title" title="string">` or
 * TX_title will translate the title= tag in that node.
 * `<... class="TX_text">content</...>` 
 * TX_text will translate all text nodes and title attributes in the
 * HTML under the tagged node, recursively.  Individual text nodes are
 * translated individually, so "x<b>y</b>z" will require tranlations
 * of 3 strings, !x", "y" and "z".
 * `<... class="TX_html">content</...>` 
 * TX_html will translate the entire HTML subtree under the tagged
 * node in one big block with embedded tags, so should not be used on
 * anything where handlers might be attached.
 * TX_text and TX_html should never be used together on the same node.
 * HTML reaping is done by the build/extractTX.js node.js script.
 */
var TX = {
    lingo: undefined,

    // Map from DOM node to cache of original English strings. Each
    // entry for a node has three possible fields; title, text and html,
    // that represent the context of the node for each case.
    originals: undefined,

    /**
     * Getter/setter for the current language. Just sets the language,
     * does not re-translate the DOM. Setter returns old language.
     */
    language: function (code) {
        "use strict";

        var old = TX.lingo;

        if (typeof code !== "undefined") {
            // Won't apply until we clear caches and restart
            TX.lingo = code;
            Cookies.set("ui_lang", code, {
                expires: 365
            });
        } else if (!old) {
            TX.lingo = Cookies.get("ui_lang") ||
                window.navigator.userLanguage ||
                window.navigator.language || "en";
        }
        return old;
    },

    translations: null,

    /* Simplify a string for lookup in the translations table */
    clean: function (s) {
        "use strict";

        return s
            .replace(/\s+/g, " ")
            .replace(/^ /, "")
            .replace(/ $/, "");
    },

    /**
     * Initialise the translations module for the language in TX.lingo.
     * Requires jQuery
     * @param tx_ready function to call when it's loaded
     */
    init: function (tx_ready, tx_fail) {
        "use strict";

        if (!TX.lingo)
            TX.language();

        if (/^en(\b|$)/i.test(TX.lingo)) {
            if (global.DEBUG) console.debug("Using language 'en'");
            if (TX.originals) {
                // if originals exists, then apply the original for each
                // entry. WeakMaps are not enumerable, so have to drive this
                // backwards.
                $("body")
                    .each(function () {
                        TX.translateDOM(this, function (s) {
                            return s;
                        });
                    });
                TX.originals = undefined;
            }

            if (tx_ready)
                tx_ready();
            return;
        }

        TX.originals = new WeakMap();
        $.ajax(
            "locale/" + TX.lingo + ".json", {
                success: function (data) {
                    TX.translations = data;
                    $("body")
                        .each(function () {
                            TX.translateDOM(this, function (s) {
                                var tx = TX.translations[TX.clean(s)];
                                if (typeof tx !== "undefined")
                                    return tx.s;
                                return s;
                            });
                        });
                    if (global.DEBUG)
                        console.debug("Using language '" + TX.lingo + "'");
                    if (tx_ready)
                        tx_ready();
                },
                error: function (a, b, c) {
                    var m = /^(.+)-.+/.exec(TX.lingo);
                    if (global.DEBUG)
                        console.debug("Failed to load locale/" +
                            TX.lingo + ".json: " + c.message);
                    if (tx_fail)
                        tx_fail("Failed to load locale/" + TX.lingo +
                            ".json: " + c.message);
                    if (m)
                        TX.lingo = m[1];
                    else
                        TX.lingo = "en";
                    TX.init(tx_ready);
                }
            });
    },

    /**
     * Find all tagged strings under the given DOM node and translate them
     * in place. The original string is held in dataset so that dynamic changes
     * of language are possible (requires HTML5 dataset)
     * @param node root of the DOM tree to process
     * @param translate function to call on each string to perform the
     * translation. if this function returns undefined, the string will
     * not be translated.
     * @param translating boolean that indicates whether to translate text
     * nodes encountered
     */
    translateDOM: function (node, translate, translating) {
        "use strict";

        function hasClass(element, thatClass) {
            return ((" " + element.className + " ")
                .replace(
                    /\s+/g, " ")
                .indexOf(" " + thatClass + " ") >= 0);
        }

        var t, attrs;

        if (!TX.originals.has(node))
            TX.originals.set(node, attrs = {});
        else
            attrs = TX.originals.get(node);

        if (node.nodeType == 3) {
            // text node
            if (translating && /\S/.test(node.nodeValue)) {
                t = attrs.text;
                if (typeof t === "undefined")
                    attrs.text = t = node.nodeValue;
                if (t) {
                    t = translate(t);
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
                    t = translate(t);
                    if (typeof t !== "undefined")
                        node.title = t;
                }
            }
            if (hasClass(node, "TX_html")) {
                t = attrs.html;
                if (typeof t === "undefined")
                    attrs.html = t = node.innerHTML;
                if (t) {
                    t = translate(t);
                    if (t)
                        node.innerHTML = t;
                }
            } else {
                if (hasClass(node, "TX_text"))
                    translating = true;

                for (var i = 0, len = node.childNodes.length; i < len; ++i) {
                    TX.translateDOM(node.childNodes[i], translate, translating);
                }
            }
        }
    },

    /**
     * Translate and expand a string (and optional parameters)
     * @param s the string to expand. All other arguments are used
     * to expand placeholders in the string, per Utils.expandTemplate
     * (unless noexpand)
     * @param noexpand don't expand template strings
     */
    tx: function () {
        "use strict";

        var tx;

        // Look up the translation
        if (TX.translations !== null) {
            tx = TX.translations[TX.clean(arguments[0])];
            if (typeof tx !== "undefined")
                arguments[0] = tx.s;
            // else use English
        }

        if (/\$/.test(arguments[0]))
            return Utils.expandTemplate.apply(null, arguments);
        else
            return arguments[0];
    }
};

if (typeof module !== "undefined")
    module.exports = TX;