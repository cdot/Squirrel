define(["dialogs/Dialog"], function(Dialog) {
    class StoreLoginDialog extends Dialog {
        /**
         * options:
         * on_signin - passing the user and password
         *      and with this set to the options.store
         * user_required - set true if the store requires a username
         * pass_required - set true if the store requires a password
         * store - store we are logging in to
         * on_signin
         */
        open(e, options) {
            let self = this;
            this.control("uReq")
                .toggle(options.user_required);
            this.control("pReq")
                .toggle(options.pass_required);

            let $user = this.control("store_user");
            let $pass = this.control("store_pass");
            let $signin = this.control("store_signin");

            let sign_in = function () {
                if (self.$dlg.squirrel_dialog("isOpen")) {
                    self.close();
                    $signin.off(self.tapEvent());
                    $user.off("change");
                    $pass.off("change");
                    options.on_signin.call(
                        $user.val(),
                        $pass.val());
                }
                return true;
            };

            $signin
                .off(this.tapEvent())
                .on(this.tapEvent(), sign_in);

            if (options.store) {
                $user.off("change").val(options.store.option("user"));
                $pass.off("change").val(options.store.option("pass"));
            }

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
                    .toggle(options.store.option("user") !== null)
                    .text(options.store.option("user") || "");

                $pass.attr("autofocus", "autofocus");
                if (options.user_required) {
                    $pass.on("change", function () {
                        $signin.focus();
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
