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
        "jquery-ui": "//cdnjs.cloudflare.com/ajax/libs/jqueryui/1.12.1/jquery-ui",
        js: "src",
        jsjq: "src/jquery",
        dialogs: "dialogs",
        images: "images"
    }
});

define(["js/Dialog", "js/Translator", "js/LocalStorageStore", "js/Hoard", "js/Tree", "jquery", "jsjq/simulated_password", "jsjq/icon_button"], function(Dialog, Translator, LocalStorageStore, Hoard) {

    let list = [
        "about",
        "alert",
        "chpw",
        "insert",
        "optimise",
        "store_login",
        "add",
        "delete",
        "json",
        "pick",
        "store_settings",
        "alarm",
        "extras",
        "network_login",
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

    let specials = {
        network_login: function() {
            Dialog.confirm("network_login", {
                user: "Bungdit", pass: "Din"
            }).then((dlg) => {
                let user = dlg.control("net_user").val();
                let pass = dlg.control("net_pass").val();
                Dialog.open("alert", {
                    alert: {
                        severity: "notice",
                        message: user + ":" + pass
                    }
                });
            });
        },
        store_login: function() {
            Dialog.confirm("store_login", {
                user: "Jaffar", pass: "Cayke",
                user_required: true, pass_required: true
            }).then((dlg) => {
                let user = dlg.control("store_user").val();
                let pass = dlg.control("store_pass").val();
                Dialog.open("alert", {
                    alert: user + ":" + pass
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
