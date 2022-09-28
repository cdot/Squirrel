/*@preserve Copyright (C) 2019 Crawford Currie http://c-dot.co.uk license MIT*/
/* eslint-env browser */

/**
 * Encryption password change dialog. Password entry fields must match.
 */
define( ["js/Dialog"], Dialog => {

	/**
	 * Password change dialog.
	 * See {@link Dialog} for constructor parameters.
	 * @extends Dialog
	 */
  class ChangePasswordDialog extends Dialog {

    _checkSamePass() {
      const $pass = this.$control("pass");
      const $problem = this.$control("problem");
      const p = $pass.val(),
            c = this.$control("conf").val();
      const ok = (p !== "" && p === c);
      if (p === "")
        $problem.text($.i18n("empty_pass"));
      else if (p !== c)
        $problem.text($.i18n("pass_mismatch"));
      $problem.toggle(!ok);
      this.$control("ok").toggle(ok);
      return ok;
    }

    initialise() {
      const chk = this._checkSamePass.bind(this);
      this.$control("pass")
      .simulated_password()
      .on("input", chk)
      .on("change", chk);
      this.$control("conf")
      .simulated_password()
      .on("input", chk)
      .on("change", chk);
    }

    ok() {
      return this.$control("pass").val();
    }

    open() {
      this.$control("pass").val(this.options.encryption_pass());
      this._checkSamePass();
    }
  }
  return ChangePasswordDialog;
});
