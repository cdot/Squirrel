/* Copyright (C) 2015 Crawford Currie http://c-dot.co.uk / MIT */

/**
 * Plugin to scroll the view to this element
 */
(function($) {
    $.fn.scroll_into_view = function () {
        "use strict";

        return this.each(function () {
            var offset = $(this).offset().top - $(window).scrollTop();

            if (offset > window.innerHeight){
                // Not in view so scroll to it
                $("html,body").animate({scrollTop: offset - 16}, 500);
                return false;
            }
            return true;
        });
    };
})(jQuery);
