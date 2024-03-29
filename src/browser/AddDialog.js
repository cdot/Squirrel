/*@preserve Copyright (C) 2015-2023 Crawford Currie http://c-dot.co.uk license MIT*/
/* eslint-env browser */

import { Dialog } from "./Dialog.js";
import { Action } from "../common/Action.js";

/**
 * Add folder/value dialog.
 * See {@link Dialog} for constructor parameters
 * @extends Dialog
 */
class AddDialog extends Dialog {

  /**
   * Code shared between add and insert
   * @protected
   */
  validateUniqueKey() {
    // Disable OK if key value exists or is invalid
    const $input = this.$control("key");
    const val = $input.val();
    let enabled = true;

    if (!/\S/.test(val)) // empty?
      enabled = false;
    else if (typeof this.options.validate === 'function')
      enabled = this.options.validate(val);

    if (enabled) {
      this.$control("ok").icon_button("enable");
      $input
      .removeClass("dlg-disabled")
      .attr("title", $.i18n("Enter new name"));
    } else {
      this.$control("ok", true).icon_button("disable");
      $input
      .addClass("dlg-disabled")
      .attr("title", $.i18n("name_used"));
    }
  }

  initialise() {
    const self = this;

    this.$control("key")
    .on("input", function () {
      self.validateUniqueKey();
    })
    .autocomplete({
      source: [
        $.i18n("User"), $.i18n("Pass"), $.i18n("Email"), $.i18n("Website")
      ]
    });
  }

  onOpened() {
    this.$control("path").text(Action.pathS(this.options.path, true));
    const isV = this.options.is_value;
    this.$control("value_help", true).toggle(isV);
    this.$control("folder_help", true).toggle(!isV);
    this.$control("value_parts", true).toggle(isV);
    this.$control("key")
    .autocomplete(isV ? "enable" : "disable").select();
    this.$control("value", true).val(this.options.value || "");

    this.validateUniqueKey();
  }

  onOK() {
    return {
      key: this.$control("key").val(),
      value: this.$control("value", true).val()
    };
  }
}

export { AddDialog }
