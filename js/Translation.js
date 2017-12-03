/*@preserve Copyright (C) 2015 Crawford Currie http://c-dot.co.uk license MIT*/

/* eslint no-eval: 1 */
/* global DEBUG:true */

/**
 * Translations module. Determines the language to use from the browser.
 *
 * Translatable strings are declared in code using `TX.tx(string)` or in
 * HTML using
 * `<... class="TX_title" title="string">` or
 * `<... class="TX_text">string</...>` 
 * These are format strings that may be populated with expandable arguments
 * `$1..$N`, for example: `TX.text("$1 days of Christmas", 12)`
 * There is limited support for conditional expansion using the
 * `$?(bexpr,then,else)` macro.
 * If `bexpr1` eval()s to true then the expression will expand to
 * `then`, otherwise it will expand to `else`.
 * Both `then` and `else` must be given, though can be empty.
 * For example, considr `TX.tx("$1 day$?($1!=1,s,)", ndays)`.
 * If `$1!=1` succeeds then the macro expands to `s` otherwise
 * to the empty string. Thus if `ndays` is `1` it will expand to `1 day`
 * but if it is `11` it will expand to `11 days`
 * NOTE: format strings are evalled and could thus be used for cross
 * scripting. User input must never be passed to the formatter. There is
 * no error checking on the eval, and it will throw an exception if the
 * syntax is incorrect.
 */
var TX = {
    lingo: window.navigator.userLanguage || window.navigator.language || "en",

    translations: null,

    init: function(tx_ready) {
        "use strict";

        if (/^en(\b|$)/i.test(TX.lingo)) {
            if (DEBUG) console.debug("Using language 'en'");
            tx_ready();
            return;
        }

        $.ajax(
            "locale/" + TX.lingo + ".json",
            {
                success: function(data) {
                    TX.translations = data;
                    $(".TX_title").each(function() {
                        $(this)
                            .attr("title", TX.tx($(this).attr("title")))
                            .removeClass("TX_title");
                    });
                    $(".TX_text").each(function() {
                        $(this)
                            .text(TX.tx($(this).text()))
                            .removeClass("TX_text");
                    });
                    if (DEBUG) console.debug("Using language '" + TX.lingo + "'");
                    tx_ready();
                },
                error: function(a, b, c) {
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

    tx: function(s) {
        "use strict";

        var tx, i;

        if (TX.translations !== null) {
            tx = TX.translations[s];
            if (typeof tx !== "undefined" && tx.length > 0)
                s = tx;
        }

        for (i = arguments.length - 1; i > 0; i--) {
            s = s.replace(new RegExp("\\$" + i, "g"), arguments[i]);
        }

        s = s.replace(
                /\$\?\((.*?),(.*?),(.*?)\)/g,
            function(m, test, pass, fail) {
                var result = false;
                eval("result=(" + test + ")");
                return result ? pass : fail;
            });
        return s;
    },

    error: function() {
        "use strict";
        return TX.tx("Error");
    },

    warning: function() {
        "use strict";
        return TX.tx("Warning");
    }
};
