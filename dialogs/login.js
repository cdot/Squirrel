/*@preserve Copyright (C) 2019 Crawford Currie http://c-dot.co.uk license MIT*/
/* eslint-env browser */

/**
 * Options:
 * title: title for the dialog
 * user: initial value for username
 * pass: initial value for password
 */
define(["js/Dialog", "js/jq/simulated_password"], function(Dialog) {
    class LoginDialog extends Dialog {
        initialise() {
            let self = this;
            let $pass = this.control("pass");
            let $button = self.control("ok");

            $pass.simulated_password();

            this.control("user")
            .on('keyup', function (e) {
                if (e.keyCode == 13) {
                    $pass.focus();
                }
            })
            .on("change", function () {
                $pass.focus();
            });

            $pass
            .on('keyup', function (e) {
                if (e.keyCode == 13) {
                    $button.focus();
                }
            })
            .on("change", function () {
                $button.focus();
            });
        }

        open() {
            let $user = this.control("user");
            let $pass = this.control("pass");

            this.$dlg.dialog("option", "title", this.options.title);

            if (typeof this.options.user !== "undefined") {
                let u = this.options.user;
                $user.val(u);
                if (u.length > 0) {
                    $pass.focus();
                } else
                    $user.focus();
            }

            if (typeof this.options.pass !== "undefined")
                $pass.val(this.options.pass);
        }
    }
    return LoginDialog;
});
