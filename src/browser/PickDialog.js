/*@preserve Copyright (C) 2015-2023 Crawford Currie http://c-dot.co.uk license MIT*/
/* eslint-env browser */

import { Dialog } from "./Dialog.js";

/**
 * Pick characters dialog.
 * See {@link Dialog} for constructor parameters
 * @extends Dialog
 */
class PickDialog extends Dialog {
  initialise() {
    this.$control("clear")
    .on(Dialog.tapEvent(), () => {
			this.$dlg.find(".dlg-picked")
      .removeClass("dlg-picked");
			this.$control("pick").text("");
		});
  }

  onOpened() {
    const $dlg = this.$dlg;

    const val = this.options.pick_from;
    const $which = this.$control("which");
    const $from = this.$control("from");
    let i;
		let self = this;

    $dlg
		.find(".dlg-pick-cell")
    .remove();

    function item_clicked() {
      const ii = $(this)
            .data("i");
      $dlg.find("td.i" + ii)
      .addClass("dlg-picked");
			let picks = $from
					.find(".dlg-picked")
					.toArray()
					.map(el => $(el).text());
			self.$control("pick").text(picks.join(""));
    }

		this.$control("pick").text("");
    for (i = 0; i < val.length; i++) {
      let $f = $from.children("td.i" + i);
      if ($f.length === 0) {
				// top row, indices
        $("<td></td>")
        .data("i", i)
        .addClass("dlg-pick-cell top-row i" + i)
        .text(i + 1)
        .on(Dialog.tapEvent(), item_clicked)
        .appendTo($which);
				// bottom row, characters
        $f = $("<td></td>")
        .data("i", i)
        .addClass("dlg-pick-cell bottom-row i" + i)
        .on(Dialog.tapEvent(), item_clicked)
        .appendTo($from);
      }
      $f.text(val.charAt(i));
    }

		// trim unused
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

export { PickDialog }
