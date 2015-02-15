var translations = {};
var chosen_langauge = "en";

function init_Translation(lingo, tx_ready) {
    if (typeof lingo === 'undefined' || lingo === "en") {
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
                    $(this).attr("title", TX($(this).attr("title")));
                });
                $(".TX_text").each(function() {
                    $(this).text(TX($(this).text()));
                });
                tx_ready();
            },
            error: function(a,b,c,d) {
                console.log("Failed to load " + chosen_language + ".json: "
                            + c.message);
                tx_ready();
            }
        });
}

function TX(s) {
    var tx = translations[chosen_language][s];
    if (typeof tx === 'undefined') {
        return s;
    } else {
        return tx;
    }
}
