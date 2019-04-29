/*@preserve Copyright (C) 2019 Crawford Currie http://c-dot.co.uk license MIT*/

if (typeof requirejs === "undefined")
    throw new Error(__filename + " is not runnable stand-alone");

/**
 * Support for jquery_tests HTML page
 */
requirejs.config({
    baseUrl: "..",
    paths: {
        mocha: "//cdnjs.cloudflare.com/ajax/libs/mocha/6.0.2/mocha",
        chai: "//cdnjs.cloudflare.com/ajax/libs/chai/4.2.0/chai",
        "js-cookie": "//cdnjs.cloudflare.com/ajax/libs/js-cookie/2.2.0/js.cookie.min",
        jquery: "//code.jquery.com/jquery-3.3.1",
        "jquery-ui": "//cdnjs.cloudflare.com/ajax/libs/jqueryui/1.12.1/jquery-ui"
    }
});

define(["js/Dialog", "js/Translator", "js/LocalStorageStore", "js/Hoard", "js/Tree", "jquery", "js/jq/simulated_password", "js/jq/icon_button"], function(Dialog, Translator, LocalStorageStore, Hoard) {

    let list = [
        "add",
        "alarm",
        "alert",
        "delete",
        "extras",
        "insert",
        "login",
        "pick",
        "randomise"
    ];

    let debug = console.debug;

    // Make sure global options get passed in
    Dialog.set_default_options({
        debug: debug,
    });
    const TESTR = "1234567普通话/普通話العَرَبِيَّة";

    let test_app = {
        client: {
            store: new LocalStorageStore(),
            hoard: new Hoard()
        },
        cloud: {
            store: new LocalStorageStore(),
            hoard: new Hoard()
        },
        add_child_node: function() {
            debug("add_child_node", arguments);
            return Promise.resolve();
        },
        insert_data: function() {
            debug("insert_data", arguments);
            return Promise.resolve();
        },
        playAction: function() {
            debug("playAction", arguments);
            return Promise.resolve();
        },
        encryptionPass: function() { debug("encryptionPass", arguments); },
        get_store_settings: function() {
            return Dialog.confirm("store_settings", {
                needs_image: true,
                path: "/path/to/cloud"
            })
        }
    };

    let login_title = "Login";
    let specials = {
        login: function() {
            Dialog.confirm("login", {
                title: login_title,
                user: "Jaffar",
                pass: "Cayke"
            }).then((dlg) => {
                let user = dlg.control("user").val();
                let pass = dlg.control("pass").val();
                login_title = "Login " + user + ":" + pass;
                Dialog.confirm("alert", {
                    alert: login_title
                });
            }).catch((dlg) => {
                console.log("login aborted");
            });
        },
        store_settings: function() {
            Dialog.confirm("store_settings", {
                needs_image: true,
                path: "/this/is/a/path"
            }).then((dlg) => {
                console.debug("store_settings", dlg.wasOked());
            });
        },
        alert: function() {
            Dialog.confirm("alert", {
                alert: [
                    {
                        severity: "notice",
                        message: "Notice",
                    },
                    {
                        severity: "warning",
                        message: "Close this dialog to open a non-blocking",
                    },
                    {
                        severity: "error",
                        http: 401
                    },
                    "Plain text"
                ]
            }).then((dlg) => {
                Dialog.open("alert", {
                    alert: {
                        severity: "warning",
                        message: "Message"
                    }
                }).then((dlg) => {
                    dlg.push([
                        {
                            severity: "error",
                            message: "An error"
                        },
                        {
                            severity: "notice",
                            message: "And a notice"
                        }]);
                    return dlg;
                })
                .then((dlg) => {
                    console.debug("Waiting for confirmation or cancel");
                    return dlg.wait();
                })
                .then((dlg) => {
                    console.debug("Closed", dlg.wasOked());
                });
            });
        }
    };

    return () => {
        Translator.instance({ url: "locale" }).language("en");
        // Fake the need for store_settings
        test_app.cloud.store.option("needs_image", true);

        $("#node")
        .data("key", "spoon")
        .data("value",TESTR)
        .data("path", ["A", "B", "C" ])
        .tree({ path: ["A", "B", "C" ] });

        $("#node").data("alarm", { time: Date.UTC(2020,1,2) });

        for (let i in list) {
            let name = list[i];
            let $button = $("<button>" + name + " </button>");
            $button.on("click", () => {
                if (specials[name])
                    specials[name]();
                else {
                    Dialog.confirm(name, {
                        app: test_app,
                        $node: $("#node")
                    }).then((dlg) => {
                        console.debug(name,dlg.wasOked());
                    });
                }
            });
            $("#buttons").append($button);
        }
    };
});
