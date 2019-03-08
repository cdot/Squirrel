define(["dialogs/Dialog"], function(Dialog) {
    class NetworkLoginDialog extends Dialog {
        initialise() {
            let self = this;
            let $user = this.control("net_user");
            let $pass = this.control("net_pass");
            let $signin = this.control("net_signin");
            
            $user.on("change", function () {
                $pass.focus();
            });
            
            $pass.on("change", function () {
                $signin.focus();
            });
            
            $signin
                .off(this.tapEvent())
                .on(this.tapEvent(), function () {
                    if (self.$dlg.squirrel_dialog("isOpen")) {
                        self.close();
                        $signin.off(self.tapEvent());
                        self.options.on_signin.call(
                            $user.val(),
                            $pass.val());
                    }
                    return true;
                })
        }
        
        /**
         * options:
         * on_signin - passing the user and password
         */
        open(e, options) {
            if (options.store) {
                this.control("net_user").val(options.store.option("user"));
                this.control("net_pass").val(options.store.option("pass"));
            }           
        }
    }
    return NetworkLoginDialog;
});
