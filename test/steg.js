var steg;

function update() {
    "use strict";

    var $textarea = $('#text');
    var text = $textarea.val();
    $('#require').text(text.length);
    var $img = $('#img');
    var capacity = steg.getCapacity($img[0]);
    $('#capacity').text(capacity);

    if (text.length > capacity)
        text = text.substring(0, capacity);

    console.debug("Storing " + text.length);
    $("#cover")
        .attr("src", steg.inject(text, $img[0]))
        .on("load", function(e) {
            $(this).off("load");
            var text = steg.extract(e.target);
            console.debug("Recovered " + text.length);
            $('#message').text(text);
        });
}

(function($) {
    "use strict";

    $(document).ready(function() {
        steg = new Steganography(3, 7);
        $('#text,#t,#codeUnitSize,#threshold').on("change", update);
        update();
    });
})(jQuery);
