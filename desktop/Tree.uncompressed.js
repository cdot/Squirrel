/*@preserve Copyright (C) 2015 Crawford Currie http://c-dot.co.uk license MIT*/

/* eslint-env jquery */
/* global Utils */
/* global Squirrel */

/**
 * Subclass of squirrel.treenode, specific to desktop jQuery
 * See common/Tree.uncompressed.js
 */

(function($, S) {
    "use strict";
    var map_treenode_icon = {
        "closed": "ui-icon-squirrel-folder-closed",
        "open": "ui-icon-squirrel-folder-open",
        "alarm": "ui-icon-squirrel-alarm"
    };

    // Extend the treenode widget with platform specifics
    $.widget("squirrel.treenode", $.squirrel.treenode, {
        /**
         * Implements superclass edit.
         * Requires edit_in_place.
         */
        edit: function(what) {
            var $node = $(this.element);

            var $span = $node.find("." + what).first();

            // Fit width to the container
            var w = $("#sites-node").width();
            $span.parents().each(function() {
                w -= $(this).position().left;
            });

            $span.edit_in_place({
                width: w,
                changed: function(s) {
                    var e = S.client.hoard.record_action(
                        { type: what === "key" ? "R" : "E",
                          path: $node.treenode("get_path"),
                          data: s },
                        function(ea) {
                            S.Tree.action(
                                ea,
                                function(/*$newnode*/) {
                                    Utils.sometime("update_save");
                                }, true);
                        });
                    if (e !== null)
                        S.Dialog.squeak(e.message);
                }
            });
        },

        icon_button: function(action, selector, icon, on_click) {
            var $node = $(this.element);
            var $control = (typeof selector === "string") ?
                $node.find(selector) : selector;

            switch (action) {
            case "create":
                var $button = $control.button({
                    icons: {
                        primary: map_treenode_icon[icon]
                    },
                    text: false
                });
                if (on_click)
                    $button.on("click", on_click);
                break;
            case "change":
                if ($control.length > 0)
                    $control.button(
                        "option", "icons", { primary: map_treenode_icon[icon] });
                break;
            case "destroy":
                $control.remove();
                break;
            }
            return $node;
        },

        attach_handlers: function() {
            var $node = $(this.element);
            var $info = $node.children(".treenode-info");
            $info.hover(
                function(/*evt*/) {
                    if ($(this).find(".in_place_editor").length === 0) {
                        var $status = $("<div></div>");
                        $status
                            .addClass("lastmod");
                        $(this)
                            .addClass("hover")
                            .append($status);

                        var mod = new Date($node.data("last-time"))
                            .toLocaleString();
                        $status.append("<span>" + mod + " </span");

                        if (typeof $node.data("alarm") !== "undefined") {
                            $status.append(
                                '<div class="inline-icon ui-icon-squirrel-alarm"></div>');
                            $status.append(
                                '<div class="treenode-info">'
                                    + Utils.deltaTimeString(
                                        new Date($node.data("last-time")
                                                 + $node.data("alarm")
                                                 * Utils.MSPERDAY))
                                    + "</div>");
                         }
                        return false;
                    }
                },
                function(/*evt*/) {
                    $(this)
                        .removeClass("hover")
                        .find(".lastmod")
                        .remove();
                });
            $info
                .children(".key")
                .on("dblclick", function(e) {
                    $node.treenode("edit", "key");
                });
            $info
                .children(".value")
                .on("dblclick", function() {
                    $node.treenode("edit", "value");
                });
        }
    });
})(jQuery, Squirrel);
