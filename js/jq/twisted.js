/*@preserve Copyright (C) 2017 Crawford Currie http://c-dot.co.uk license MIT*/
/* eslint-env browser,jquery */

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

define("js/jq/twisted", ["jquery", "jquery-ui", "js/jq/icon_button"], function() {
    $.widget("squirrel.twisted", {
        _create: function () {
            let self = this;
            let $container = self.element;

            function handleTap() {
                if ($container.hasClass("twisted-shut"))
                    self.open();
                else
                    self.close();
            }

            let $button = $(document.createElement("button"))
                .addClass("twisted-button twisted-title")
                .icon_button({
                    icon: "ui-icon-info",
                    showLabel: false
                });

            let $title = $container
                .children(".twisted-title")
                .first()
                .detach()
                .insertBefore($container)
                .prepend($button)
                .on($.getTapEvent ? $.getTapEvent() : "click", handleTap);

            if ($title.length === 0) {
                $button
                .insertBefore($container)
                .on($.getTapEvent ? $.getTapEvent() : "click", handleTap);
            }

            $container.data("twisted-button", $button);

            self.close();
        },

        open: function () {
            let icon = this.element.data("close") ||
                "ui-icon-circle-minus";
            this.element
            .removeClass("twisted-shut")
            .show()
            .data("twisted-button")
            .icon_button("option", "icon", icon)
        },

        close: function () {
            let icon = this.element.data("open") ||
                "ui-icon-circle-plus";
            this.element
            .addClass("twisted-shut")
            .hide()
            .data("twisted-button")
            .icon_button("option", "icon", icon);
        }
    });
});
