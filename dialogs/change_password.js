/*@preserve Copyright (C) 2019 Crawford Currie http://c-dot.co.uk license MIT*/
/* eslint-env browser */

/**
 * Encryption password change dialog. Password entry fields must match.
 */
define("dialogs/change_password", ["js/Dialog"], function(Dialog) {

    class ChangePasswordDialog extends Dialog {

        _checkSamePass() {
            let $pass = this.control("pass");
            let $problem = this.control("problem");
            let p = $pass.val(),
                c = this.control("conf").val();
            let ok = (p !== "" && p === c);
            if (p === "")
                $problem.text(this.tx("Password may not be empty"));
            else if (p !== c)
                $problem.text(this.tx("Passwords do not match"));
            $problem.toggle(!ok);
            this.control("ok").toggle(ok);
            return ok;
        }

        initialise() {
            let chk = this._checkSamePass.bind(this);
            this.control("pass")
            .simulated_password()
            .on("input", chk)
            .on("change", chk);
            this.control("conf")
            .simulated_password()
            .on("input", chk)
            .on("change", chk);
        }

        ok() {
            return this.control("pass").val();
        }

        open() {
            this.control("pass").val(this.options.encryption_pass());
            this._checkSamePass();
        }
    }
    return ChangePasswordDialog;
});

