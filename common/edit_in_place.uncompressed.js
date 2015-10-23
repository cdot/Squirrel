/* Copyright (C) 2015 Crawford Currie http://c-dot.co.uk / MIT */

/**
 * Simple in-place editing widget
 */
(function($) {
    "use strict";
    $.fn.edit_in_place = function(options) {

        var $self = $(this);
        var h = options.height || $self.height();
        var w = options.width || $self.width();
        var changed = options.changed ||
            function(/*text*/) {
                $self.text();
            };
        var $input = $("<input/>"),
        blurb = function() {
            $input.remove();
            $self.show();
        };

        $self.hide();

        $input
            .insertBefore($self)
            .addClass("in_place_editor")
            .val($self.text())
            .css("height", h)
            .css("width", w)

            .on("change", function() {
                var val = $(this).val();
                blurb();
                if (val !== $self.text())
                    changed.call($self, val);
            })

            .on("mouseup", function(e) {
                // Override the parent click handler
                e.stopPropagation();
            })

            .on("mousedown", function(e) {
                // Override the parent click handler
                e.stopPropagation();
            })

            .on("keydown", function(e) { // Escape means cancel
                if (e.keyCode === 27
                    || (e.keyCode === 13
                        && $(this).val() === $self.text())) {
                    blurb();
                    return false;
                } else
                    return true;
            })

            .blur(blurb)
            .select();
    };
})(jQuery);
