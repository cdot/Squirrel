/*@preserve Copyright (C) 2019 Crawford Currie http://c-dot.co.uk license MIT*/
/**
 * Encryption password change dialog
 * Options:
 * app (required)
 */
define(["js/Dialog"], function(Dialog) {

    class ChangePasswordDialog extends Dialog {

        _checkSamePass() {
            let p = this.control("pass").val(),
                c = this.control("conf").val();
            this.control("nomatch").toggle(p !== c);
            return (p === c);
        }

        initialise() {
            let self = this;

            this.find('input[type="password"]').simulated_password();
            
            this.control("conf")
                .on("change", function () {
                   self._checkSamePass();
                });

            this.control("set")
                .on(this.tapEvent(), function () {
                    if (!self._checkSamePass()) {
                        return false;
                    }
                    self.close();
                    let app = self.options.app;
                    app.encryptionPass(self.control("pass").val());

                    return true;
                });
        }

        open() {
            this._checkSamePass();
        }
    }
    return ChangePasswordDialog;
});
      
