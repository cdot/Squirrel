/*@preserve Copyright (C) 2015 Crawford Currie http://c-dot.co.uk license MIT*/

/**
 * Plugin to scroll the view to this element
 */
(function ($) {

    "use strict";

    $.fn.scroll_into_view = function () {
        return this.each(function () {
            // Top of element relative to document
            var offset = $(this).offset().top;
            var thisht = $(this).height();
            var $win = $(window);
            var curtop = $win.scrollTop();
            var winht = $win.innerHeight();

            if (offset < curtop || offset + thisht > curtop + winht) {
                // Not in the view. Scroll it to the centre.
                var newtop = offset - winht / 2;
                if (newtop < 0)
                    newtop = 0;
                console.log("Scrolling to " + newtop);
                $("html,body")
                    .animate({
                        scrollTop: newtop
                    }, 500);
                return false;
            }
            return true;
        });
    };
})(jQuery);