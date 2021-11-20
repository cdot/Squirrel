/*@preserve Copyright (C) 2015-2019 Crawford Currie http://c-dot.co.uk license MIT*/
/* eslint-env browser,jquery */

define("js/jq/scroll_into_view", ["jquery", "jquery-ui"], () => {

	/**
	 * JQuery plugin function to scroll the view to this element
	 * Usage is simple:
	 * ```
	 * `$(el).scroll_into_view();
	 * ```
	 * @namespace $.scroll_into_view
	 */
    $.fn.scroll_into_view = function () {
        return this.each(function () {
            // Top of element relative to document
            const offset = $(this).offset().top;
            const thisht = $(this).height();
            const $win = $(window);
            const curtop = $win.scrollTop();
            const winht = $win.innerHeight();

            if (offset < curtop || offset + thisht > curtop + winht) {
                // Not in the view. Scroll it to the centre.
                let newtop = offset - winht / 2;
                if (newtop < 0)
                    newtop = 0;
                $("html,body")
                    .animate({
                        scrollTop: newtop
                    }, 500);
                return false;
            }
            return true;
        });
    };
});
