/*@preserve Copyright (C) 2015 Crawford Currie http://c-dot.co.uk license MIT*/
/* eslint-env browser,jquery */

/**
 * Plugin to scroll the view to this element
 */
(function ($) {
    $.fn.scroll_into_view = function () {
        return this.each(function () {
            // Top of element relative to document
            let offset = $(this).offset().top;
            let thisht = $(this).height();
            let $win = $(window);
            let curtop = $win.scrollTop();
            let winht = $win.innerHeight();

            if (offset < curtop || offset + thisht > curtop + winht) {
                // Not in the view. Scroll it to the centre.
                let newtop = offset - winht / 2;
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
