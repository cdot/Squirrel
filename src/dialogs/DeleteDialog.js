/*@preserve Copyright (C) 2019-2023 Crawford Currie http://c-dot.co.uk license MIT*/
/* eslint-env browser */

/**
 * Confirm deletion of a node
 */
import { Dialog } from "../Dialog.js";
import { Action } from "../Action.js";

/**
 * Confirm delete dialog.
 * See {@link Dialog} for constructor parameters.
 * @extends Dialog
 */
class DeleteDialog extends Dialog {

  onOpened() {
    this.$control("path").text(Action.pathS(this.options.path));
    //this.$control("coll").toggle(!this.options.is_leaf);
  }

  onOK() {
    return this.$control("path").text();
  }
}

export { DeleteDialog }
