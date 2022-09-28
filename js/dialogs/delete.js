/*@preserve Copyright (C) 2019 Crawford Currie http://c-dot.co.uk license MIT*/
/* eslint-env browser */

/**
 * Confirm deletion of a node
 */
define(["js/Dialog", "js/Action"], (Dialog, Action) => {

	/**
	 * Confirm delete dialog.
	 * See {@link Dialog} for constructor parameters.
	 * @extends Dialog
	 */
    class DeleteDialog extends Dialog {

        open() {
            this.$control("path").text(Action.pathS(this.options.path));
            this.$control("coll").toggle(!this.options.is_leaf);
        }

        ok() {
            return this.$control("path").text();
        }
    }
    return DeleteDialog;
});
