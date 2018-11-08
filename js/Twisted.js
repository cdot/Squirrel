/*@preserve Copyright (C) 2017 Crawford Currie http://c-dot.co.uk license MIT*/

/* eslint-env jquery */

/**
 * jQuery widget for twisting
 * Create open-close buttons on a container
 *
 * Classes used:
 * .twisted-title - optional element that will be shown even when
 * the twist is closed and will also be sensitive to open/close clicks
 * .twisted-button - applied to the open/close button
 * .twisted-shut - applied if the twist is closed
 *
 * data- attributes used:
 * data-open="ui-icon-circle-plus"
 * data-close="ui-icon-circle-minus"
 */

(function ($) {

    "use strict";

    $.widget("squirrel.twisted", {
        _create: function () {
            var self = this;
            var $container = self.element;

            function handleTap() {
                if ($container.hasClass("twisted-shut"))
                    self.open();
                else
                    self.close();
            }

            var $button = $(document.createElement("button"))
                .addClass("twisted-button twisted-title")
                .iconbutton({
                    icon: "ui-icon-info",
                    showLabel: false
                });

            var $title = $container
                .children(".twisted-title")
                .first()
                .detach()
                .insertBefore($container)
                .prepend($button)
                .on("click", handleTap);

            if ($title.length === 0) {
                $button
                    .insertBefore($container)
                    .on("click", handleTap);
            }

            $container.data("twisted-button", $button);

            self.close();
        },

        open: function () {
            var icon = this.element.data("close") ||
                "ui-icon-circle-minus";
            this.element
                .removeClass("twisted-shut")
                .show()
                .data("twisted-button")
                .iconbutton("option", "icon", icon)
        },

        close: function () {
            var icon = this.element.data("open") ||
                "ui-icon-circle-plus";
            this.element
                .addClass("twisted-shut")
                .hide()
                .data("twisted-button")
                .iconbutton("option", "icon", icon);
        }
    });
})(jQuery);