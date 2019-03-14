/*@preserve Copyright (C) 2019 Crawford Currie http://c-dot.co.uk license MIT*/
/**
 * Options:
 * title: title for the dialog
 * user: initial value for username
 * pass: initial value for password
 */
define(["js/Dialog", "jsjq/simulated_password"], function(Dialog) {
    class LoginDialog extends Dialog {
        initialise() {
            let self = this;
            let $pass = this.control("pass");
            
            $pass.simulated_password();
            
            this.control("user")
                .on("change", function () {
                    $pass.focus();
                });
            $pass.on("change", function () {
                self.control("cancel").focus();
            });
        }
        
        open() {
            let $user = this.control("user");

            this.$dlg.dialog("option", "title", this.options.title);

            if (typeof this.options.user !== "undefined")
                $user.val(this.options.user);
            if (typeof this.options.pass !== "undefined")
                this.control("pass").val(this.options.pass);

            $user.focus();
        }
    }
    return LoginDialog;
});
