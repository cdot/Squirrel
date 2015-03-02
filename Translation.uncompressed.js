var translations = {};
var chosen_language = "en";

function TX(lingo, tx_ready) {
    "use strict";

    if (typeof lingo === "undefined" || lingo === "en") {
        tx_ready();
        return;
    }
    chosen_language = lingo;
    $.ajax(
        "locale/" + chosen_language + ".json",
        {
            success: function(data) {
                translations[chosen_language] = data;
                $(".TX_title").each(function() {
                    $(this).attr("title", TX.tx($(this).attr("title")));
                });
                $(".TX_text").each(function() {
                    $(this).text(TX.tx($(this).text()));
                });
                tx_ready();
            },
            error: function(a, b, c) {
                console.log("Failed to load " + chosen_language + ".json: "
                            + c.message);
                tx_ready();
            }
        });
}

TX.tx = function(s) {
    "use strict";

    var tx = translations[chosen_language];
    if (!tx) {
        return s;
    }
    tx = tx[s];
    if (typeof tx === "undefined") {
        return s;
    } else {
        return tx;
    }
};
