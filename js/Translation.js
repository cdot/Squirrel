/*@preserve Copyright (C) 2015 Crawford Currie http://c-dot.co.uk license MIT*/

/* eslint no-eval: 1 */
/* global DEBUG:true */
/* global module */
/* global Utils */

/**
 * Translations module. Determines the language to use from the browser.
 *
 * Translatable strings are declared in code using `TX.tx(string)`.
 * These are format strings that may be populated with expandable arguments
 * `$1..$N`, for example: `TX.text("$1 days of Christmas", 12)`
 *
 * Strings can also be reaped from HTML using classes:
 * `<... class="TX_title" title="string">` or
 * `<... class="TX_text">content</...>` 
 * `<... class="TX_html">content</...>` 
 * TX_title will translate the title= tag in that node. TX_text will
 * translate all text nodes and title attributes in the HTML under the
 * tagged node, recursively.  Individual text nodes are translated
 * individually, so "x<b>y</b>z" will require tranlations of 3
 * strings, !x", "y" and "z". TX_html will translate the entire HTML
 * subtree under the tagged node in one big block with embedded tags,
 * so should not be used on anything where handlers might be attached.
 * TX_text and TX_html should never be used together on the same node.
 * 
 */
var TX = {
    lingo: undefined,

    langFromLocale: function () {
        "use strict";

        TX.lingo = window.navigator.userLanguage ||
            window.navigator.language || "en";
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
    init: function (tx_ready) {
        "use strict";

        if (!TX.lingo)
            TX.langFromLocale();

        if (/^en(\b|$)/i.test(TX.lingo)) {
            if (DEBUG) console.debug("Using language 'en'");
            tx_ready();
            return;
        }

        $.ajax(
            "locale/" + TX.lingo + ".json", {
                success: function (data) {
                    TX.translations = data;
                    $("body")
                        .each(function () {
                            TX.translateDOM(this, TX.tx, false);
                        });
                    if (DEBUG) console.debug(
                        "Using language '" + TX.lingo + "'");
                    tx_ready();
                },
                error: function (a, b, c) {
                    var m = /^(.+)-.+/.exec(TX.lingo);
                    if (DEBUG) console.debug(
                        "Failed to load " + TX.lingo + ".json: " + c.message);
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
     * in place.
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

        var t;

        if (node.nodeType == 3) {
            if (translating && /\S/.test(node.nodeValue)) {
                t = translate(node.nodeValue)
                if (typeof t !== "undefined")
                    node.nodeValue = t;
            }
        } else {
            if (translating || hasClass(node, "TX_title")) {
                t = node.title;
                if (t) {
                    t = translate(t);
                    if (typeof t !== "undefined")
                        node.title = t;
                }
            }
            if (hasClass(node, "TX_html")) {
                t = translate(node.innerHTML);
                if (typeof t !== "undefined")
                    node.innerHTML = t;
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
     * to expand placeholders in the string, per Utils.expandTemplate.
     */
    tx: function () {
        "use strict";

        var tx, i;

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