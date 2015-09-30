/* Copyright (C) 2015 Crawford Currie http://c-dot.co.uk / MIT */

/**
 * Plugin to generate taphold events on platforms that don't
 * natively support them
 */
(function($) {
    $.fn.linger = function() {
        "use strict";

        var eventType = {
            mousedown: "ontouchstart" in window ? "touchstart" : "mousedown",
            mouseup: "ontouchend" in window ? "touchend" : "mouseup"
        };

        return this.each(function() {
            var timeout;
            $(this)
                .on(eventType.mousedown + ".linger", function(e) {
                    timeout = window.setTimeout(function() {
                        $(e.currentTarget).trigger("taphold");
                    }, 1000);
                    return false; // stop bubble
                })
                .on(eventType.mouseup + ".linger", function(/*evt*/) {
                    window.clearTimeout(timeout);
                })
                .on(eventType.click + ".linger", function(/*evt*/) {
                    window.clearTimeout(timeout);
                })
                .on("contextmenu.linger", function(/*evt*/) {
                    window.clearTimeout(timeout);
                });
        });
    };
})(jQuery);
