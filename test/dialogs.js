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
        cookie: "//cdnjs.cloudflare.com/ajax/libs/js-cookie/2.2.0/js.cookie.min",
        jquery: "//code.jquery.com/jquery-3.3.1",
        "jquery-ui": "//cdnjs.cloudflare.com/ajax/libs/jqueryui/1.12.1/jquery-ui"
    }
});

define(["js/Dialog", "js/Translator", "js/LocalStorageStore", "js/Hoard", "js/Tree", "jquery", "js/jq/simulated_password", "js/jq/icon_button"], function(Dialog, Translator, LocalStorageStore, Hoard) {

    let list = [
        "about",
        "add",
        "alarm",
        "alert",
        "chpw",
        "delete",
        "extras",
        "insert",
        "json",
        "login",
        "optimise",
        "pick",
        "randomise",
        "store_settings"
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
        add_child_node: function() { debug("add_child_node", arguments); },
        trigger: function() { debug("trigger", arguments); },
        insert_data: function() { debug("insert_data", arguments); },
        playAction: function() { debug("playAction", arguments); },
        theme: function() { debug("theme", arguments); },
        autosave: function() { debug("autosave", arguments); },
        zoom: function() { debug("zoom", arguments); },
        encryptionPass: function() { debug("encryptionPass", arguments); },
        USE_STEGANOGRAPHY: true
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
                Dialog.open("alert", {
                    alert: login_title
                });
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
                    }
                ]
            }).then((dlg) => {
                Dialog.open("alert", {
                    alert: {
                        severity: "warning",
                        message: "Message"
                    }
                }).then((dlg) => {
                    dlg.add([
                        {
                            severity: "error",
                            message: "An error"
                        },
                        {
                            severity: "notice",
                            message: "And a notice"
                        }]);
                })
            });
        }
    };

    let Cookies = {
        // TODO: save a .rc
        vals: {},
        get: (k) => {
            return Cookies.vals[k];
        },
        set: (k, v) => {
            Cookies.vals[k] = v;
        },
        remove: (k) => {
            delete Cookies.vals[k];
        }
    }

    return () => {
        Translator.instance({ url: "locale" }).language("en");
        // Fake the need for store_settings
        test_app.cloud.store.option("needs_image", true);

        $("#node")
            .data("key", "spoon")
            .data("value",TESTR)
            .tree();
        for (let i in list) {
            let name = list[i];
            let $button = $("<button>" + name + " </button>");
            $button.on("click", () => {
                if (specials[name])
                    specials[name]();
                else {
                    Dialog.open(name, {
                        app: test_app,
                        $node: $("#node"),
                        cookies: Cookies,
                        close: function() {
                            Dialog.open("alert", {
                                alert: "Closed"
                            });
                        }
                    });
                }
            });
            $("#buttons").append($button);
        }
    };
});