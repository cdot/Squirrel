var chosen_language = "en";

function init_TX() {
    if (chosen_language === "tx" ) {
        // Extract translatable strings
        var words = {};
        $(".TX_title").each(function() {
            words[$(this).attr("title")] = true;
        });
        
        $(".TX_text").each(function() {
            words[$(this).text()] = true;
        });
        var $ta = $("<textarea cols='120' rows='100'></textarea>");
        $ta.text(Object.keys(words).sort().join("\n"));
        $("body").empty().append($ta);
    }
    else if (chosen_language !== "en") {
        // TODO: implement TX somehow. FileReader, probably.
        $(".TX_title").each(function() {
            $(this).attr("title", TX($(this).attr("title")));
        });
        
        $(".TX_text").each(function() {
            $(this).text(TX($(this).text()));
        });
    }
}

function TX(s) {
    return s;
}
