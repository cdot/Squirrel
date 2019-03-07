define(function() {
    return function($dlg) {
        /**
         * options:
         * on_signin - passing the user and password
         *      and with this set to the options.store
         * user_required - set true if the store requires a username
         * pass_required - set true if the store requires a password
         * store - store we are logging in to
         * on_signin
         */
        $dlg.on('dlg-open', function (e, options) {
            $dlg.squirrel_dialog("control", "uReq")
                .toggle(options.user_required);
            $dlg.squirrel_dialog("control", "pReq")
                .toggle(options.pass_required);

            let $user = $dlg.squirrel_dialog("control", "store_user");
            let $pass = $dlg.squirrel_dialog("control", "store_pass");
            let $signin = $dlg.squirrel_dialog("control", "store_signin");

            let sign_in = function () {
                if ($dlg.squirrel_dialog("isOpen")) {
                    $dlg.squirrel_dialog("close");
                    $signin.off($.getTapEvent());
                    $user.off("change");
                    $pass.off("change");
                    options.on_signin.call(
                        $user.val(),
                        $pass.val());
                }
                return true;
            };

            $signin
                .off($.getTapEvent())
                .on($.getTapEvent(), sign_in);

            $user.off("change")
                .val(options.store.option("user"));
            $pass.off("change")
                .val(options.store.option("pass"));

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
                $dlg.squirrel_dialog("control", "foruser")
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
        });
    }
});
