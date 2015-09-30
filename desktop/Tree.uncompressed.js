/* Copyright (C) 2015 Crawford Currie http://c-dot.co.uk / MIT */

/**
 * Subclass of squirrel.treenode, specific to desktop jQuery
 */
(function($) {
    var map_treenode_icon = {
        "closed": "ui-icon-folder-collapsed",
        "open": "ui-icon-folder-open",
        "alarm": "squirrel-icon-alarm"
    };

    $.widget("squirrel.treenode", $.squirrel.treenode, {
        /**
         * Edit a node in place, used for renaming and revaluing.
         * Requires edit_in_place.
         */
        edit: function(what) {
            "use strict";
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
                    var e = Squirrel.client.hoard.record_action(
                        { type: what === "key" ? "R" : "E",
                          path: $node.treenode("get_path"),
                          data: s },
                        function(ea) {
                            Squirrel.Tree.action(
                                ea,
                                function(/*$newnode*/) {
                                    Utils.sometime("update_save");
                                    Utils.sometime("update_tree");
                                }, true);
                        });
                    if (e !== null)
                        Squirrel.Dialog.squeak(e.message);
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
        }
    });
})(jQuery);
