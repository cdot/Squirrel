/*@preserve Copyright (C) 2019 Crawford Currie http://c-dot.co.uk license MIT*/
/* eslint-env browser */

/**
 * Confirm deletion of a node
 * Options:
 * app (required)
 * $node (required)
 */
define("dialogs/delete", ["js/Dialog", "js/Action", "js/Hoard"], function(Dialog, Action, Hoard) {
    class DeleteDialog extends Dialog {

        ok() {
            return this.options.app.playAction(new Action({
                type: "D",
                path: this.options.$node.tree("getPath")
            }));
        }

        open() {
            this.control("path")
                .text(this.options.$node.tree("getPath").join("↘"));
            this.control("coll")
                .toggle(!this.options.$node.hasClass("tree-leaf"));
        }
    }
    return DeleteDialog;
});
