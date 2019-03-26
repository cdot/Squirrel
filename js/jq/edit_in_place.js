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
        let changed = options.changed ||
            function ( /*text*/ ) {
                return $this.text();
            };
        let closed = options.closed || function () {};
        let $input = $(document.createElement("input"));
        let text = options.text || $this.text();

        // Action on blur
        function blurb() {
            $input.remove();
            $this.show();
            closed();
        }

        $this.hide();

        $input
            .insertBefore($this)
            .addClass("in_place_editor")
            .val(text)
            .css("height", h)
            .css("width", w)

            .on("change", function () {
                let val = $(this)
                    .val();
                blurb();
                if (val !== text)
                    text = changed.call($this, val);
            })
            /*
                        .on($.getEndEvent(), function(e) {
                            // Override the parent click handler
                            e.stopPropagation();
                            // e.preventDefault(); Kills mouse events on desktop input
                        })

                        .on($.getStartEvent(), function(e) {
                            // Override the parent click handler
                            e.stopPropagation();
                            // e.preventDefault(); Kills mouse events on desktop input
                        })
            */
            .on("keydown", function (e) { // Escape means cancel
                if (e.keyCode === 27 ||
                    (e.keyCode === 13 &&
                        $(this)
                        .val() === text)) {
                    blurb();
                    return false;
                } else
                    return true;
            })

            .blur(blurb)
            .select();
    };
});
