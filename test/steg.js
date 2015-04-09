var steg;

function update() {
    "use strict";

    var $textarea = $('#text');
    var text = $textarea.val();
    $('#require').text(text.length);
    var $img = $('#img');
    var steg = new Steganographer($img[0], 7);

    var datauri;
    var tries = 5;

    while (tries-- > 0 && text.length > 0) {
        console.debug("Storing " + text.length);
        try {
            datauri = steg.inject(text).toDataURL();
            break;
        } catch (e) {
            var excess = ((e.p1 / 16 + 1) >> 0);
            if (excess === 0)
                debugger;
            console.debug(e.message + ", too much by " + excess);
            text = text.substr(0, text.length - excess);
        }
    }

    $("#cover")
        .attr("src", datauri)
        .on("load", function(e) {
            $(this).off("load");
            var gets = new Steganographer(this);
            var ab = gets.extract();
            var a = new Uint16Array(ab);
            console.debug("Recovered " + a.length);
            var text = '';
            for (var i = 0; i < a.length; i++)
                text += String.fromCharCode(a[i]);
            $('#message').text(text);
        });
}

(function($) {
    "use strict";
    $(document).ready(function() {
        $('#text,#t,#codeUnitSize,#threshold').on("change", update);
        update();
    });
})(jQuery);
