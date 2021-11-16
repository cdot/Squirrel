/*@preserve Copyright (C) 2015-2019 Crawford Currie http://c-dot.co.uk license MIT*/
/* eslint-env browser */

/*
 * Pick characters from a string value
 */
define("dialogs/pick", ["js/Dialog"], Dialog => {
    class PickDialog extends Dialog {
        initialise() {
            this.$control("clear")
            .on(Dialog.tapEvent(), () =>
				this.$dlg.find(".dlg-picked")
                .removeClass("dlg-picked"));
        }

        open() {
            const $dlg = this.$dlg;

            const val = this.options.pick_from;
            const $which = this.$control("which");
            const $from = this.$control("from");
            let i;

            $dlg
			.find(".dlg-pick-cell")
            .remove();

            const item_clicked = function() {
                const ii = $(this)
                    .data("i");
                $dlg.find("td.i" + ii)
                .addClass("dlg-picked");
            };

            for (i = 0; i < val.length; i++) {
                const $f = $from.children("td.i" + i);
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

            $dlg.find(".dlg-picked")
            .removeClass("dlg-picked");
        }
    }
    return PickDialog;
});
