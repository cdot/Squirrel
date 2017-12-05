/*@preserve Copyright (C) 2015 Crawford Currie http://c-dot.co.uk license MIT*/

/**
 * Simple in-place editing widget
 */
(function($) {
    "use strict";
    $.fn.edit_in_place = function(options) {

        var $this = $(this);
        var h = options.height || $this.height();
        var w = options.width || $this.width();
        var changed = options.changed ||
            function(/*text*/) {
                return $this.text();
            };
        var $input = $("<input/>");
        var text = options.text || $this.text();
            
        function blurb() {
            $input.remove();
            $this.show();
        }

        $this.hide();

        $input
            .insertBefore($this)
            .addClass("in_place_editor")
            .val(text)
            .css("height", h)
            .css("width", w)

            .on("change", function() {
                var val = $(this).val();
                blurb();
                if (val !== text)
                    text = changed.call($this, val);
            })

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

            .on("keydown", function(e) { // Escape means cancel
                if (e.keyCode === 27
                    || (e.keyCode === 13
                        && $(this).val() === text)) {
                    blurb();
                    return false;
                } else
                    return true;
            })

            .blur(blurb)
            .select();
    };
})(jQuery);
