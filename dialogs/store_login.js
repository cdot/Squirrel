/*@preserve Copyright (C) 2019 Crawford Currie http://c-dot.co.uk license MIT*/
/**
 * Options:
 * on_login - function passed the user and password
 * user_required - set true if the store requires a username
 * user: default username
 * pass_required - set true if the store requires a password
 * pass: default pass
 */
define(["js/Dialog", "jsjq/simulated_password"], function(Dialog) {
    class StoreLoginDialog extends Dialog {
        initialise() {
            this.control("store_pass").simulated_password();
        }
        
        open() {
            let self = this;
            let options = self.options;
            
            this.control("uReq")
                .toggle(options.user_required);
            this.control("pReq")
                .toggle(options.pass_required);

            let $user = this.control("store_user");
            let $pass = this.control("store_pass");

            $user.off("change").val(options.user);
            $pass.off("change").val(options.pass);

            if (options.user_required) {
                $user.attr("autofocus", "autofocus");
                if (options.pass_required) {
                    $user
                        .off("change")
                        .on("change", function () {
                            $pass.focus();
                        });
                } else {
                    $user
                        .off("change")
                        .on("change", sign_in);
                }
                $user.focus();
            }

            if (options.pass_required) {
                this.control("foruser")
                    .toggle(options.user)
                    .text(options.user || "");

                $pass.attr("autofocus", "autofocus");
                if (options.user_required) {
                    $pass.on("change", function () {
                        self.control("cancel").focus();
                    });
                } else {
                    $pass.focus();
                    $pass.on("change", function () {
                        return sign_in();
                    });
                }
            }
        }
    }
    return StoreLoginDialog;
});
