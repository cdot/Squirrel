/*@preserve Copyright (C) 2015-2019 Crawford Currie http://c-dot.co.uk license MIT*/
/* eslint-env browser */

/*
 * Pick characters from a string value
 */
define("dialogs/pick", ["js/Dialog"], function(Dialog) {
    class PickDialog extends Dialog {
        initialise() {
            let self = this;
            this.control("clear")
            .on(Dialog.tapEvent(), function () {
                self.find(".dlg-picked")
                .removeClass("dlg-picked");
            });
        }

        open() {
            let self = this;

            let val = this.options.pick_from;
            let $which = this.control("which");
            let $from = this.control("from");
            let i, $f;

            this.find(".dlg-pick-cell")
            .remove();

            let item_clicked = function () {
                let ii = $(this)
                    .data("i");
                self.find("td.i" + ii)
                .addClass("dlg-picked");
            };

            for (i = 0; i < val.length; i++) {
                $f = $from.children("td.i" + i);
                if ($f.length === 0) {
                    $("<td></td>")
                    .data("i", i)
                    .addClass("dlg-pick-cell i" + i)
                    .text(i + 1)
                    .on(Dialog.tapEvent(), item_clicked)
                    .appendTo($which);
                    $f = $("<td></td>")
                    .data("i", i)
                    .addClass("dlg-pick-cell i" + i)
                    .on(Dialog.tapEvent(), item_clicked)
                    .appendTo($from);
                }
                $f.text(val.charAt(i));
            }

            while (i < $from.children("td")
                   .length) {
                $from.children("td")
                .last()
                .remove();
                i++;
            }

            this.find(".dlg-picked")
            .removeClass("dlg-picked");
        }
    }
    return PickDialog;
});
