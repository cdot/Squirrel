var TX = {
    lingo: window.navigator.userLanguage || window.navigator.language || "en",
    translations: null,
    init: function(tx_ready) {
        "use strict";

        if (/^en(\b|$)/i.test(TX.lingo)) {
            console.debug("Using language 'en'");
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
                    console.debug("Using language '" + TX.lingo + "'");
                    tx_ready();
                },
                error: function(a, b, c) {
                    var m;
                    console.log("Failed to load " + TX.lingo + ".json: "
                                + c.message);
                    if (m = /^(.+)-.+/.exec(TX.lingo))
                        TX.lingo = m[1];
                    else
                        TX.lingo = "en";
                    TX.init(tx_ready);
                }
            })
    },
    tx: function(s) {
        "use strict";

        if (TX.translations === null)
            return s;

        var tx = TX.translations[s];
        if (typeof tx === "undefined")
            return s;

        return tx;
    }
};
