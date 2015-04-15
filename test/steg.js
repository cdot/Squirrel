var DEBUG = true;
var steg;

function update() {
    "use strict";

    var $textarea = $('#text');
    var text = $textarea.val();
    $('#require').text(text.length);
    var $img = $('#img');
    var steg = new Steganographer($img[0], 5);

    var datauri;
    var tries = 5;

    while (tries-- > 0 && text.length > 0) {
        console.debug("Storing " + text.length);
        try {
            var data = new Uint8Array(text.length);
            for (var i = 0; i < text.length; i++)
                data[i] = text.charCodeAt(i) & 0xFF;
            datauri = steg.inject(data).toDataURL();
            break;
        } catch (e) {
            var m = /.*?(\d+)/.exec(e);
            if (m) {
                var excess = ((Number.parseInt(m[1]) / 8 + 1) >> 0);
                if (excess === 0)
                    debugger;
                console.debug(e);
                text = text.substr(0, text.length - excess);
            } else
                debugger;
        }
    }

    $("#cover")
        .attr("src", datauri)
        .on("load", function(e) {
            $(this).off("load");
            var gets = new Steganographer(this);
            var ab = gets.extract();
            var a = new Uint8Array(ab);
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
