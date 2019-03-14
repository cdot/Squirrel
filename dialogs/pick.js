/*@preserve Copyright (C) 2015-2019 Crawford Currie http://c-dot.co.uk license MIT*/
/*
* Options:
* $node (required)
*/
define(["js/Dialog"], function(Dialog) {
    class PickDialog extends Dialog {
        initialise() {
            let self = this;
            this.control("clear")
                .on(this.tapEvent(), function () {
                    self.find(".dlg-picked")
                        .removeClass("dlg-picked");
                });
        }

        open() {
            let self = this;

            let val = this.options.$node.data("value") || "";
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
                        .on(this.tapEvent(), item_clicked)
                        .appendTo($which);
                    $f = $("<td></td>")
                        .data("i", i)
                        .addClass("dlg-pick-cell i" + i)
                        .on(this.tapEvent(), item_clicked)
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
