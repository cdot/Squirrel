/*@preserve Copyright (C) 2019-2023 Crawford Currie http://c-dot.co.uk license MIT*/
/* eslint-env browser */

/**
 * Change chooser dialog
 */
import { Dialog } from "./Dialog.js";

/**
 * Review changes dialog.
 * See {@link Dialog} for constructor parameters.
 * @extends Dialog
 */
class ChangesDialog extends Dialog {

  ok() {
    const picked_acts = [];
    for (let n in this.options.changes) {
      const $in = this.$control("act" + n);
      if ($in.prop("checked")) {
        picked_acts.push(this.options.changes[n]);
      }
    }
    return picked_acts;
  }

  open() {
    const $table = this.$control("changes");
    $table.empty();
    this.$control("changes").empty();
    const template = this.$control("row-template").html();
    let n = 0;
    for (let act of this.options.changes) {
      const row = template.replace(/\$N/g, n++)
            .replace(/\$A/g, act.verbose());
      $table.append(row);
    }
  }
}

export { ChangesDialog }
