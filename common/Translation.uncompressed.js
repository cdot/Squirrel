/**
 * Translations module. Determines the language to use from the browser,
 * picks up translations from 
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
                        $(this).attr("title", TX.tx($(this).attr("title")));
                    });
                    $(".TX_text").each(function() {
                        $(this).text(TX.tx($(this).text()));
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
            s = s.replace("\$" + i, arguments[i]);
        }

        return s;
    },

    error: function() { return TX.tx("Error"); },

    warning: function() { return TX.tx("Warning"); }
};
