/*@preserve Copyright (C) 2019 Crawford Currie http://c-dot.co.uk license MIT*/
/* eslint-env browser */
/* global __filename */

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

define(["js/Dialog", "js/Translator", "js/LocalStorageStore", "js/Action", "js/Hoard", "js/Tree", "jquery", "js/jq/simulated_password", "js/jq/icon_button"], function(Dialog, Translator, LocalStorageStore, Action, Hoard) {

    let debug = console.debug;

    // Make sure global options get passed in
    Dialog.set_default_options({
        debug: debug,
    });
    const TESTR = "1234567普通话/普通話العَرَبِيَّة";

    // Test application (do we need this any more?)
    let test_app = {
        client: {
            store: new LocalStorageStore(),
            hoard: new Hoard()
        },
        cloud: {
            store: new LocalStorageStore(),
            hoard: new Hoard()
        },
        playAction: function() {
            debug("playAction", arguments);
            return Promise.resolve();
        }
    };

    let login_title = "Login";

    function lert() {
        var args = Array.prototype.slice.call(arguments);
        Dialog.confirm("alert", {
            alert: args.join(" ")
        });
    }
    
    let tests = {
        add_node: function() {
            return Dialog.confirm("add", {
                path: [ "New", "Node", "Not", "x" ],
                validate: (key) => {
                    return key !== "x";
                },
                is_value: false
            }).then((result) => {
                lert(name, "OK", result);
            });
        },
        add_leaf: function() {
            return Dialog.confirm("add", {
                path: [ "Leaf", "Value", "Not", "x" ],
                validate: (key) => {
                    return key !== "x";
                },
                is_value: true
            }).then((result) => {
                lert(name, "OK", result);
            });
        },
        alarm: function() {
            return Dialog.confirm("alarm", {
                path: ["Squirrel", "Nut", "Kin"],
                alarm: { time: Date.UTC(2002,0,2), repeat: 12345678910 },
                last_change: Date.UTC(1998,3,1)
            })
            .then((act) => {
                lert("Alarm", act);
            });
        },
        alert: function() {
            return Dialog.confirm("alert", {
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
            }).then((/*dlg*/) => {
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
                    lert("Waiting for confirmation or cancel");
                    return dlg.wait();
                })
                .then(() => {
                    lert("OKed");
                });
            });
        },
        choose_changes: function() {
            return Dialog.confirm("choose_changes", {
                changes: [
                    new Action({
						type: "N",
						time: Date.UTC(2000,0,1),
						path: ["A"]
                    }),
                    new Action({
						type: "A",
						time: Date.UTC(2001,6,1),
						data: { time: Date.UTC(2001,6,1),
                                repeat: (1000 * 60 * 60 * 24 * 100) },
						path: [ "A" ]
                    }),
                    new Action({
						type: "C",
						time: Date.UTC(2001,6,1),
						path: [ "A" ]
                    }),
                    new Action({
						type: "N",
						time: Date.UTC(2002,0,1),
						path: [ "A", "B" ]
                    }),
                    new Action({
						type: "N",
						time: Date.UTC(2002,0,1),
						path: [ "A", "C" ]
                    }),
                    new Action({
						type: "D",
						time: Date.UTC(2002,0,1),
						path: [ "A", "C" ]
                    }),
                    new Action({
                        type: "N",
						path: [ "A", "B", "C" ],
						time: Date.UTC(2003,0,1)
                    }),
                    new Action({
						type: "E",
						time: Date.UTC(2002,0,2),
						path: ["A", "B", "C"],
                        data: "Nuts"
                    }),
                    new Action({
						type: "M",
						time: Date.UTC(2002,0,2),
						path: ["A", "B", "C"],
                        data: ["A", "Nuts"]
                    }),
                ]
            })
            .then((changes) => {
                lert("ok choose_changes", changes);
            });
        },
        change_pass: function() {
            return Dialog.confirm("change_password")
            .then((pw) => {
                lert("new pw", pw);
            });
        },
        delete: function() {
            return Dialog.confirm("delete", {
                path: [ "Woggle", "Niblick" ],
                is_leaf: true
            })
            .then((path) => {
                lert("Confirmed delete of", path);
            });
        },
        extras: function() {
            return Dialog.confirm("extras", {
                needs_image: false,
                encryption_pass: function(pass) {
                    lert("encryption pass", pass);
                    return pass;
                },
                cloud_path: function(path) {
                    if (typeof path !== "undefined")
                        lert("Cloud path", path);
                    else path = "/a/bogus/path";
                    return path;
                },
                tree_json: function(json) {
                    if (typeof json !== "undefined")
                        lert("JSON", json);
                    else json = JSON.stringify({ A: 1, C: 2 }, null, " ");
                    return json;
                }
            })
            .then((options) => {
                lert("Confirmed extras", options);
            });
        },
        insert: function() {
            return Dialog.confirm("insert", {
                $node: $("#node"),
                data: { "fruit": "bat" }
            })
            .then((options) => {
                lert("insert", options);
            });
        },
        login: function() {
            return Dialog.confirm("login", {
                title: login_title,
                user: "Jaffar",
                pass: "Cayke"
            })
            .then((info) => {
                lert("Login", info.user, info.pass);
            });
        },
        pick: function() {
            return Dialog.confirm("pick", {
                pick_from: "0123456789"
            });
        },
        store_settings_image: function() {
            return Dialog.confirm("store_settings", {
                needs_image: true,
                image_url: function(path) {
                    if (typeof path !== "undefined")
                        lert("Steg image", path);
                    return requirejs.toUrl("images/GCHQ.png")
                },
                cloud_path: function(path) {
                    if (typeof path !== "undefined")
                        lert("Cloud path", path);
                    return "/a/bogus/path";
                }
            })
            .then((path) => {
                lert("store_settings OK", path);
            });
        },
        store_settings_noimage: function() {
            return Dialog.confirm("store_settings", {
                cloud_path: function(path) {
                    if (typeof path !== "undefined")
                        lert("Cloud path", path);
                    return "/a/bogus/path";
                }
            })
            .then((path) => {
                lert("store_settings OK", path);
            });
        },
        randomise: function() {
            return Dialog.confirm("randomise", {
                key: "TEST",
                constraints: { size: 16, chars: "AB-D" }
            })
            .then((res) => {
                lert("randomise OK", res);
            });
        }
    };

    return () => {
        Translator.instance({ url: "locale" }).language("en");
        // Fake the need for store_settings
        test_app.cloud.store.option("needs_image", true);
        $("#node").data("key", "spoon");
        $("#node").data("value",TESTR);
        $("#node").data("path", []);
        $("#node").tree({});

        $("#node").data("alarm", { time: Date.UTC(2020,1,2) });

        for (let name in tests) {
            let $button = $("<button>" + name + " </button>");
            $button.on("click", () => {
                tests[name]()
                .catch((f) => {
                    lert("Aborted", f);
                });
            });
            $("#buttons").append($button);
            $("#buttons").append("<br/>");
        }
    };
});
