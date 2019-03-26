/*@preserve Copyright (C) 2019 Crawford Currie http://c-dot.co.uk license MIT*/
/* eslint-env browser */

/**
 * Encryption password change dialog
 * Options:
 * app (required)
 */
define("dialogs/chpw", ["js/Dialog"], function(Dialog) {

    class ChangePasswordDialog extends Dialog {

        _checkSamePass() {
            let p = this.control("pass").val(),
                c = this.control("conf").val();
            let ok = (p !== "" && p === c);
            this.control("nonull").toggle(p === "");
            this.control("nomatch").toggle(p !== c);
            this.control("ok").toggle(ok);
            return ok;
        }

        initialise() {
            let chk = this._checkSamePass.bind(this);
            this.control("pass").on("change", chk).simulated_password();
            this.control("conf").on("change", chk).simulated_password();
        }

        ok() {
            if (!this._checkSamePass())
                return Promise.reject();
            let app = this.options.app;
            app.encryptionPass(this.control("pass").val());
            return Promise.resolve();
        }

        open() {
            this._checkSamePass();
        }
    }
    return ChangePasswordDialog;
});

