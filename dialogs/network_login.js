/*@preserve Copyright (C) 2019 Crawford Currie http://c-dot.co.uk license MIT*/
/**
 * Network login (e.g. basic auth)
 * Options:
 * user (optional, default user)
 * pass (optional, default pass)
 * on_login (required, function)
 */
define(["js/Dialog"], function(Dialog) {
    class NetworkLoginDialog extends Dialog {
        initialise() {
            let self = this;
            let $pass = this.control("net_pass");
            
            this.control("net_user").on("change", function () {
                $pass.focus();
            });
            
            $pass.on("change", function () {
                self.control("cancel").focus();
            });
        }
        
        /**
         * options:
         * on_signin - passing the user and password
         */
        open() {
            this.control("net_user").val(this.options.user);
            this.control("net_pass").val(this.options.pass);
        }
    }
    return NetworkLoginDialog;
});
