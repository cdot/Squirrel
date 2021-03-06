/*@preserve Copyright (C) 2015-2019 Crawford Currie http://c-dot.co.uk license MIT*/
/* eslint-env browser,jquery */

/**
 * Simple in-place editing widget
 */
define("js/jq/edit_in_place", ["jquery", "jquery-ui"], function () {

    $.fn.edit_in_place = function (options) {

        let $this = $(this);
        let h = options.height || $this.height() || "1em";
        let w = options.width || $this.width() || "1em";
        let $input = $(document.createElement("input"));
        let text = options.text || $this.text();

        function close() {
            let v = $input.val();
            $input.remove();
            $this.show();
            if (options.onClose)
                options.onClose.call($this, v);
        }

        $this.hide();

        $input
            .insertBefore($this)
            .addClass("in_place_editor")
            .val(text)
            .css("height", h)
            .css("width", w)
            .on("change", close)
            .blur(close)
            .on("keydown", function (e) { // Escape means cancel
                if (e.keyCode === 27 ||
                    (e.keyCode === 13 && $(this).val() === text)) {
                    close();
                    return false;
                } else
                    return true;
            })

            .select();
    };
});
