/* Copyright (C) 2015 Crawford Currie http://c-dot.co.uk / MIT */

/**
 * Subclass of squirrel.treenode, specific to jQuery mobile
 */
(function($) {
    var map_treenode_icon = {
        "closed": "carat-r",
        "open": "carat-d",
        "alarm": "clock"
    };

    $.widget("squirrel.treenode", $.squirrel.treenode, {
        icon_button: function(action, selector, icon, on_click) {
            var $node = $(this.element);
            var $control = (typeof selector === "string") ?
                $node.find(selector).first() : selector;

            switch (action) {
            case "create":
                $control
                    .button({
                        mini: true,
                        inline: true,
                        icon: map_treenode_icon[icon],
                        iconpos: "notext"
                    });
                if (on_click)
                    $control.parent().on("vclick", on_click);
                break;
            case "change":
                $control.button({
                    icon: map_treenode_icon[icon]
                });
                break;
            case "destroy":
                $control.button("destroy").remove();
                break;
            }
            return $node;
        }
    });
})(jQuery);
