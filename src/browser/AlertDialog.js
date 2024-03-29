/*@preserve Copyright (C) 2015-2023 Crawford Currie http://c-dot.co.uk license MIT*/
/* eslint-env browser */

import { Dialog } from "./Dialog.js";

let $http = null;

/**
 * Notification dialog.
 * See {@link Dialog} for constructor parameters.
 * @extends Dialog
 */
class AlertDialog extends Dialog {

  /**
	 * @Override
	 */
  onOpened() {
    this.$control("messages").empty();

    if (this.options.title)
      this.$dlg.dialog("option", "title", this.options.title);

    if (this.options.alert)
      this.push(this.options.alert);
  }

  /**
   * Add a message to the dialog
   * @param {object} lert
   * @param {string} lert.severity one of "notice", "warning", "error"
   * @param {string} lert.message the translated message text
   * Can also be an array of these objects
   * @param first if true, add to the start of the message list
   */
  add(lert, first) {
    if (lert instanceof Array) {
      if (first)
        for (let i = lert.length - 1; i >= 0; i--)
          this.add(lert[i], true);
      else
        for (let i in lert)
          this.add(lert[i], false);
      return;
    }
    if (typeof lert === 'string')
      lert = { message: lert };

    if (!lert.severity)
      lert.severity = "notice";
    let mess = lert.message;
    if (mess instanceof Array)
      mess = mess.join("<br />");

    const $mess = $(`<div>${mess}</div>`)
          .addClass(`dlg-${lert.severity}`);
    if (first)
      this.$control("messages").prepend($mess);
    else
      this.$control("messages").append($mess);
  }

  /**
   * Add a message to the start of the message list.
   * @param {object} lert see `add()' for details
   */
  unshift(lert) {
    this.add(lert, true);
  }
  
  /**
   * @override
   */
  push(lert) {
    this.add(lert, false);
  }
}

export { AlertDialog }
