/*@preserve Copyright (C) 2019 Crawford Currie http://c-dot.co.uk license MIT*/
/* eslint-env browser */

/**
 * Change chooser dialog
 */
define("dialogs/choose_changes", ["js/Dialog"], function(Dialog) {

    class ChangesDialog extends Dialog {

        ok() {
            let picked_acts = [];
            for (let n in this.options.changes) {
                let $in = this.control("act" + n);
                if ($in.prop("checked")) {
                    picked_acts.push(this.options.changes[n]);
                }
            }
            return picked_acts;
        }

        open() {
            let $table = this.control("changes");
            $table.empty();
            this.control("changes").empty();
            let template = this.control("row-template").html();
            let n = 0;
            for (let act of this.options.changes) {
                let row = template.replace(/\$N/g, n++)
                    .replace(/\$A/g, act.verbose());
                $table.append(row);
            }
        }
    }
    return ChangesDialog;
});
