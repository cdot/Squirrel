/*@preserve Copyright (C) 2019-2023 Crawford Currie http://c-dot.co.uk license MIT*/
/* eslint-env browser */

/**
 * Insert a copy of data
 * Options:
 * $node (required)
 * data: data value to insert
 */
import { AddDialog } from "./add.js";

class InsertDialog extends AddDialog {
  validateValue() {
    const $ta = this.$control("value");
    const text = $ta.val();
    
    try {
      JSON.parse(text);
      this.$control("ok").icon_button("enable");
      $ta
      .removeClass("dlg-disabled")
      .attr("title", $.i18n("Edit valid JSON"));
    } catch (e) {
      this.$control("ok").icon_button("disable");
      $ta
      .addClass("dlg-disabled")
      .attr("title", e);
    }
  }

  initialise() {
    const self = this;
    super.initialise();
    this.$control("value")
    .on("input", function () {
      self.validateValue();
    });
  }
  
  open() {
    super.open();
    this.validateValue();
  }
}

export { InsertDialog }
