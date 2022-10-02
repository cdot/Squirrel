/*@preserve Copyright (C) 2015-2022 Crawford Currie http://c-dot.co.uk license MIT*/
/* eslint-env browser */

/**
 * Password generation for the given leaf node
 */
define([
  "js/Dialog", "js/dialogs/ConstraintsMixin",
  "cookie"
], (
  Dialog, ConstraintsMixin
) => {

  /**
	 * Randomise string dialog.
	 */
  class RandomiseDialog extends ConstraintsMixin(Dialog) {

    constraints_changed() {
      const cons = {
        size: parseInt(this.$control("len").val()),
        chars: this.$control("chs").val()
      };
      const memorable = !this.sameConstraints(cons, this.revert);
      this.$control("remember-label").toggle(memorable);
      this.$control("remember").toggle(memorable);

      // Revert to default
      this.$control("reset").toggle(
        !this.sameConstraints(cons, this.defaultConstraints));

      // Revert to starting condition, only if starting condition
      // if not default
      this.$control("revert").toggle(
        !this.sameConstraints(this.revert, this.defaultConstraints)
        && !this.sameConstraints(cons, this.revert));

      this.$control("again").trigger(Dialog.tapEvent());
    }

    initialise() {
      const self = this;
      
      this.$control("again")
      .on(Dialog.tapEvent(), function () {
        self.$control("idea")
        .text(this.generatePassword({
          size: self.$control("len").val(),
          chars: self.$control("chs").val()
        }));
        return false;
      });
      
      this.$control("len")
      .on("change", function () {
        self.constraints_changed();
      });
      
      this.$control("chs")
      .on("change", function () {
        self.constraints_changed();
      });
      
      this.$control("reset")
      .on(Dialog.tapEvent(), function () {
        self.$control("len").val(this.defaultConstraints.size);
        self.$control("chs").val(this.defaultConstraints.chars);
        self.constraints_changed();
      });
      
      this.$control("revert")
      .on(Dialog.tapEvent(), function () {
        self.$control("len").val(self.revert.size);
        self.$control("chs").val(self.revert.chars);
        self.constraints_changed();
      });
    }

    ok() {
      const res = { text: this.$control("idea").text() };
      if (this.$control("remember").prop("checked")) {
        res.constraints = {
          size: parseInt(this.$control("len").val()),
          chars: this.$control("chs").val()
        };
      }
      return res;
    }
    
    open() {
      this.revert = $.extend(
        {}, this.defaultConstraints, this.options.constraints);
      
      this.$control("len").val(this.revert.size);
      this.$control("chs").val(this.revert.chars);

      this.$control("key").text(this.options.key);
      this.$control("again").trigger(Dialog.tapEvent());
      this.$control("remember").hide();

      this.constraints_changed();
    }
  }
  return RandomiseDialog;
});
