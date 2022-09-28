/*@preserve Copyright (C) 2017 Crawford Currie http://c-dot.co.uk license MIT*/
/* eslint-env browser,jquery */

define("js/jq/twisted", ["jquery", "jquery-ui", "js/jq/icon_button"], () => {
	/**
	 * jQuery widget for twisting (opening/closing paragraphs)
	 * Creates open-close buttons on a container e.g. a `div`
	 *
	 * CSS classes used:
	 * * `twisted-title` - optional element that will be shown even when
	 * the twist is closed and will also be sensitive to open/close clicks
	 * * `twisted-button` - applied to the open/close button
	 * * `twisted-shut` - applied if the twist is closed
	 *
	 * `data-` attributes used:
	 * * `data-open="ui-icon-circle-plus"`
	 * * `data-close="ui-icon-circle-minus"`
	 *
	 * Example:
	 * ```
	 * $(".twist").twisted();
	 * ```
	 * @namespace squirrel.twisted
	 */
    $.widget("squirrel.twisted", {
        _create: function () {
            const self = this;
            const $container = self.element;

            function handleTap() {
                if ($container.hasClass("twisted-shut"))
                    self.open();
                else
                    self.close();
            }

            const $button = $(document.createElement("button"))
                .addClass("twisted-button twisted-title")
                .icon_button({
                    icon: "ui-icon-info",
                    showLabel: false
                });

            const $title = $container
                .children(".twisted-title")
                .first()
                .detach()
                .insertBefore($container)
                .prepend($button)
                .on($.isTouchCapable() ? "tap" : "click", handleTap);

            if ($title.length === 0) {
                $button
                .insertBefore($container)
                .on($.isTouchCapable() ? "tap" : "click", handleTap);
            }

            $container.data("twisted-button", $button);

            self.close();
        },

		/**
		 * @name squirrel.twisted#open
		 * @function
		 * @description Open the container
		 */
        open: function () {
            const icon = this.element.data("close") ||
                "ui-icon-circle-minus";
            this.element
            .removeClass("twisted-shut")
            .show()
            .data("twisted-button")
            .icon_button("option", "icon", icon);
        },

		/**
		 * @name squirrel.twisted#close
		 * @function
		 * @description Close the container
		 */
        close: function () {
            const icon = this.element.data("open") ||
                "ui-icon-circle-plus";
            this.element
            .addClass("twisted-shut")
            .hide()
            .data("twisted-button")
            .icon_button("option", "icon", icon);
        }
    });
});
