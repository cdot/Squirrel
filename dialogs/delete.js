/*@preserve Copyright (C) 2019 Crawford Currie http://c-dot.co.uk license MIT*/
/**
 * Confirm deletion of a node
 * Options:
 * app (required)
 * $node (required)
 */
define(["js/Dialog", "js/Hoard"], function(Dialog, Hoard) {
    class DeleteDialog extends Dialog {
        ok() {
            this.options.app.playAction(Hoard.new_action({
                type: "D",
                path: this.options.$node.tree("getPath")
            }));
            return true;
        }

        open() {
            this.control("path")
                .text(
                    !this.options.$node.tree("getPath")
                        .join("↘"));
            this.control("coll")
                .toggle(!this.options.$node.hasClass("tree-leaf"));
        }
    }
    return DeleteDialog;
});
