/*@preserve Copyright (C) 2015-2018 Crawford Currie http://c-dot.co.uk license MIT*/

/* eslint-env jquery */
/* global Utils */
/* global TX */
/* global global */
/* global Steganographer */
/* global Squirrel */
/* global Hoard */

// Handlers for Squirrel dialogs.
(function ($) {
    "use strict";

    $(function () {

        /**
         * options:
         * on_signin - passing the user and password
         *      and with this set to the options.store
         * user_required - set true if the store requires a username
         * pass_required - set true if the store requires a password
         * store - store we are logging in to
         * on_signin
         */
        $('#login_dlg').on('dlg-open', function (e, options) {
            var $dlg = $(this);
            $dlg.squirrelDialog("control", "uReq")
                .toggle(options.user_required);
            $dlg.squirrelDialog("control", "pReq")
                .toggle(options.pass_required);

            var $user = $dlg.squirrelDialog("control", "user");
            var $pass = $dlg.squirrelDialog("control", "pass");
            var $signin = $dlg.squirrelDialog("control", "signin");

            var sign_in = function () {
                $dlg.squirrelDialog("close");
                $signin.off($.getTapEvent());
                $user.off("change");
                $pass.off("change");
                options.on_signin.call(
                    options.store,
                    $user.val(),
                    $pass.data("hidden_pass"));
                return true;
            };

            $signin
                .off($.getTapEvent())
                .on($.getTapEvent(), sign_in);

            $user.off("change")
                .val(options.store.user());
            $pass.off("change")
                .val(options.store.pass());

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
                $dlg.squirrelDialog("control", "foruser")
                    .toggle(options.store.user() !== null)
                    .text(options.store.user() || "");

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

        /**
         * Confirm deletion of a node
         */
        $('#delete_dlg')
            .on('dlg-initialise', function () {
                var $dlg = $(this);
                $dlg.squirrelDialog("control", "ok")
                    .on($.getTapEvent(), function () {
                        $dlg.squirrelDialog("close");
                        Squirrel.playAction(Hoard.new_action(
                            "D", $dlg.data("node").tree("getPath"), Date.now()));
                        return true;
                    });
                $dlg.squirrelDialog("control", "cancel")
                    .on($.getTapEvent(), function () {
                        $dlg.squirrelDialog("close");
                        return false;
                    });
            })
            .on('dlg-open', function () {
                var $dlg = $(this);
                $dlg.squirrelDialog("control", "path")
                    .text(
                        $dlg.data("node").tree("getPath")
                        .join("↘"));
                $dlg.squirrelDialog("control", "coll")
                    .toggle(!$dlg.data("node").hasClass("tree-leaf"));
            });

        $('#pick_dlg')
            .on('dlg-initialise', function () {
                var $dlg = $(this);
                $dlg.squirrelDialog("control", "clear")
                    .on($.getTapEvent(), function () {
                        $dlg.find(".dlg-picked")
                            .removeClass("dlg-picked");
                    });
            })
            .on('dlg-open', function () {
                var $dlg = $(this);

                var $node = $dlg.data("node");
                var val = $node.data("value");
                var $which = $dlg.squirrelDialog("control", "which");
                var $from = $dlg.squirrelDialog("control", "from");
                var i, $f;

                $dlg.find(".dlg-pick-cell")
                    .remove();

                var item_clicked = function () {
                    var ii = $(this)
                        .data("i");
                    $dlg
                        .find("td.i" + ii)
                        .addClass("dlg-picked");
                };

                for (i = 0; i < val.length; i++) {
                    $f = $from.children("td.i" + i);
                    if ($f.length === 0) {
                        $(document.createElement("td"))
                            .data("i", i)
                            .addClass("dlg-pick-cell i" + i)
                            .text(i + 1)
                            .on($.getTapEvent(), item_clicked)
                            .appendTo($which);
                        $f = $(document.createElement("td"))
                            .data("i", i)
                            .addClass("dlg-pick-cell i" + i)
                            .on($.getTapEvent(), item_clicked)
                            .appendTo($from);
                    }
                    $f.text(val.charAt(i));
                }

                while (i < $from.children("td")
                    .length) {
                    $from.children("td")
                        .last()
                        .remove();
                    i++;
                }

                $dlg.find(".dlg-picked")
                    .removeClass("dlg-picked");
            });

        /**
         * Password generation for the given leaf node
         */
        const DEFAULT_RANDOM_LEN = 30;
        const DEFAULT_RANDOM_CHS = "A-Za-z0-9!%^&*_$+-=;:@#~,./?";

        function constraints_changed($dlg) {
            var $node = $dlg.data("node");
            var nc = $node.data("constraints");
            if (typeof nc !== "undefined")
                nc = nc.split(/;/, 2);
            else
                nc = [DEFAULT_RANDOM_LEN, DEFAULT_RANDOM_CHS];
            var dlg_l = $dlg.squirrelDialog("control", "len").val();
            var dlg_c = $dlg.squirrelDialog("control", "chs").val();

            if (dlg_l != nc[0] || dlg_c != nc[1])
                $dlg.squirrelDialog("control", "remember").show();
            else
                $dlg.squirrelDialog("control", "remember").hide();

            if (dlg_l !== DEFAULT_RANDOM_LEN || dlg_c !== DEFAULT_RANDOM_CHS)
                $dlg.squirrelDialog("control", "reset").show();
            else
                $dlg.squirrelDialog("control", "reset").hide();

            $dlg.squirrelDialog("control", "again")
                .trigger($.getTapEvent());
        }

        function reset_constraints($dlg) {
            $dlg.squirrelDialog("control", "len").val(DEFAULT_RANDOM_LEN);
            $dlg.squirrelDialog("control", "chs").val(DEFAULT_RANDOM_CHS);
            constraints_changed($dlg);
        }

        $('#randomise_dlg').on('dlg-initialise', function () {
            var $dlg = $(this);

            $dlg.squirrelDialog("control", "again")
                .on($.getTapEvent(), function () {
                    $dlg.squirrelDialog("control", "idea")
                        .text(Utils.generate_password({
                            length: $dlg.squirrelDialog("control", "len")
                                .val(),
                            charset: $dlg.squirrelDialog("control", "chs")
                                .val()
                        }));
                    return false;
                });
            $dlg.squirrelDialog("control", "use")
                .on($.getTapEvent(), function () {
                    $dlg.squirrelDialog("close");
                    Squirrel.playAction(Hoard.new_action(
                        "E", $dlg.data("node").tree("getPath"), Date.now(),
                        $dlg.squirrelDialog("control", "idea").text()));
                    return true;
                });
            $dlg.squirrelDialog("control", "len")
                .on("change", function () {
                    constraints_changed($dlg);
                });
            $dlg.squirrelDialog("control", "chs")
                .on("change", function () {
                    constraints_changed($dlg);
                });
            $dlg.squirrelDialog("control", "remember")
                .on($.getTapEvent(), function () {
                    Squirrel.playAction(Hoard.new_action(
                        "X", $dlg.data("node").tree("getPath"), Date.now(),
                        $dlg.squirrelDialog("control", "len").val() + ";" +
                        $dlg.squirrelDialog("control", "chs").val()));
                    constraints_changed($dlg);
                });
            $dlg.squirrelDialog("control", "reset")
                .on($.getTapEvent(), function () {
                    reset_constraints($dlg);
                });
        });

        $('#randomise_dlg').on('dlg-open', function () {
            var $dlg = $(this);
            var $node = $dlg.data("node");
            var my_key = $node.data("key");
            var c = $node.data("constraints");

            if (c) {
                c = c.split(";", 2);
                $dlg.squirrelDialog("control", "len").val(c[0]);
                $dlg.squirrelDialog("control", "chs").val(c[1]);
            }

            var path = $node.tree("getPath");
            $dlg.squirrelDialog("control", "path")
                .text(path.join("↘"));
            $dlg.squirrelDialog("control", "key")
                .text(my_key);
            $dlg.squirrelDialog("control", "again")
                .trigger($.getTapEvent());

            $dlg.squirrelDialog("control", "remember")
                .hide();

            constraints_changed($dlg);
        });

        $('#search_dlg').on('dlg-initialise', function () {
            var $dlg = $(this);
            $dlg.squirrelDialog("control", "ok")
                .on($.getTapEvent(), function () {
                    $dlg.squirrelDialog("close");
                    Squirrel.search($dlg.squirrelDialog("control", "string")
                        .val());
                });
            $dlg.squirrelDialog("control", "string")
                .on("change", function () {
                    $dlg.squirrelDialog("control", "ok")
                        .trigger($.getTapEvent());
                });
        });

        /**
         * Reminder setting dialog
         */

        /* Helper */
        function _updateNext($dlg) {
            var numb = $dlg.squirrelDialog("control", "number")
                .val();
            // Convert to days
            numb = numb * Utils.TIMEUNITS[$dlg.squirrelDialog("control", "units")
                .val()].days;
            var alarmd = new Date(Date.now() + numb * Utils.MSPERDAY);
            $dlg.squirrelDialog("control", "nextmod")
                .template(
                    "expand",
                    Utils.deltaTimeString(alarmd),
                    alarmd.toLocaleDateString());
        }

        $('#alarm_dlg').on('dlg-initialise', function () {
            var $dlg = $(this);

            $dlg.squirrelDialog("control", "units")
                .on("change", function () {
                    _updateNext($dlg);
                });

            $dlg.squirrelDialog("control", "number")
                .on("change", function () {
                    _updateNext($dlg);
                });

            $dlg.squirrelDialog("control", "remind")
                .on($.getTapEvent(), function () {
                    $dlg.squirrelDialog("close");
                    var numb = $dlg.squirrelDialog("control", "number")
                        .val() *
                        Utils.TIMEUNITS[$dlg.squirrelDialog("control", "units")
                            .val()].days;
                    Squirrel.playAction(Hoard.new_action(
                        "A", $dlg.data("node").tree("getPath"), Date.now(),
                        numb));
                    return false;
                });

            $dlg.squirrelDialog("control", "clear")
                .on($.getTapEvent(), function () {
                    $dlg.squirrelDialog("close");
                    Squirrel.playAction(Hoard.new_action(
                        "C", $dlg.data("node").tree("getPath"), Date.now()));
                    return false;
                });
        });

        $('#alarm_dlg').on('dlg-open', function () {
            var $dlg = $(this);
            var $node = $dlg.data("node");

            $dlg.squirrelDialog("control", "path")
                .text($node.tree("getPath")
                    .join("↘"));

            $dlg.data("node", $node);
            var lastmod = $node.data("last-time-changed");
            $dlg.squirrelDialog("control", "lastmod")
                .template(
                    "expand",
                    new Date(lastmod)
                    .toLocaleString());

            if (typeof $node.data("alarm") !== "undefined") {
                var alarm = new Date(
                    lastmod + $node.data("alarm") * Utils.MSPERDAY);
                $dlg.squirrelDialog("control", "current")
                    .template(
                        "expand",
                        Utils.deltaTimeString(alarm),
                        alarm.toLocaleDateString())
                    .show();
                $dlg.squirrelDialog("control", "clear")
                    .show();
            } else {
                $dlg.squirrelDialog("control", "current")
                    .hide();
                $dlg.squirrelDialog("control", "clear")
                    .hide();
            }

            _updateNext(this);
        });

        /* Helper */
        function _changeImage($dlg) {
            var fail = function (e) {
                $dlg.squirrelDialog("control", "message")
                    .template("pick", "cui")
                    .template("expand", e);
            };
            var file = $dlg.squirrelDialog("control", "file")[0].files[0];
            Utils.read_file(
                file,
                function (data) {
                    data = "data:" + file.type + ";base64," +
                        Utils.ArrayBufferToBase64(data);
                    if (data !== $dlg.squirrelDialog("control", "steg_image")
                        .attr("src", data)) {
                        $dlg.squirrelDialog("control", "steg_image")
                            .attr("src", data)
                            .off("load")
                            .on("load", function () {
                                $(this)
                                    .off("load");
                                // Check that we can use the image.
                                var steg = new Steganographer(this);
                                try {
                                    steg.inject("tada");
                                } catch (e) {
                                    if (global.DEBUG) console.debug("Caught " + e);
                                    fail(e);
                                    return;
                                }
                                $dlg.squirrelDialog("control", "ok")
                                    .iconbutton("enable");
                                var h = this.naturalHeight;
                                var w = this.naturalWidth;
                                this.height = 100;
                                $dlg.squirrelDialog("control", "message")
                                    .template("pick", "xbyy")
                                    .template("expand", w, h);
                                if (Squirrel.getClient()
                                    .status === Squirrel.IS_LOADED)
                                    Squirrel.getClient()
                                    .status = Squirrel.NEW_SETTINGS;
                                if (Squirrel.getCloud()
                                    .status === Squirrel.IS_LOADED)
                                    Squirrel.getCloud()
                                    .status = Squirrel.NEW_SETTINGS;
                                Utils.sometime("update_save");
                            });
                    }
                },
                fail,
                "arraybuffer");
        }

        $('#store_settings_dlg').on('dlg-initialise', function () {
            var $dlg = $(this);

            $dlg.squirrelDialog("control", "file")
                .hide()
                .on($.getTapEvent(), function () {
                    _changeImage($dlg);
                });

            $dlg.squirrelDialog("control", "image")
                .on($.getTapEvent(), function (e) {
                    $dlg.squirrelDialog("control", "file")
                        .trigger("change", e);
                });

            $dlg.squirrelDialog("control", "storepath")
                .on("keyup", function () {
                    if ($dlg.squirrelDialog("control", "storepath")
                        .val() === "") {
                        $dlg.squirrelDialog("control", "message")
                            .template("pick", "mnbe");
                        return false;
                    }
                    if (Squirrel.getClient()
                        .hoard.options.store_path !==
                        $dlg.squirrelDialog("control", "storepath")
                        .val()) {
                        Squirrel.getClient()
                            .hoard.options.store_path =
                            $dlg.squirrelDialog("control", "storepath")
                            .val();
                        if (Squirrel.getClient()
                            .status === Squirrel.IS_LOADED)
                            Squirrel.getClient()
                            .status = Squirrel.NEW_SETTINGS;
                        // No - the cloud isn't affected by the store path,
                        // so don't mark it as changed
                        // if (Squirrel.getCloud().status === Squirrel.IS_LOADED)
                        //     Squirrel.getCloud().status = Squirrel.NEW_SETTINGS;
                        Utils.sometime("update_save");
                    }
                    return true;
                })
                .on("change", function () {
                    $dlg.squirrelDialog("control", "ok")
                        .trigger($.getTapEvent());
                });

            $dlg.squirrelDialog("control", "ok")
                .on($.getTapEvent(), function () {
                    if ($dlg.squirrelDialog("control", "storepath")
                        .val() === "") {
                        $dlg.squirrelDialog("control", "message")
                            .template("pick", "mnbe");
                        return false;
                    }
                    $dlg.squirrelDialog("close");
                });
        });

        $('#store_settings_dlg').on('dlg-open', function () {
            var $dlg = $(this);
            $dlg.squirrelDialog("control", "message")
                .hide();
            $dlg.squirrelDialog("control", "storepath")
                .focus()
                .val(
                    Squirrel.getClient()
                    .hoard.options.store_path);
        });

        /**
         * Encryption password change dialog
         */
        $('#chpw_dlg').on('dlg-initialise', function () {
            var $dlg = $(this);

            $dlg.squirrelDialog("control", "show")
                .on("change", function () {
                    if ($dlg.squirrelDialog("control", "show")
                        .prop("checked")) {
                        $dlg.squirrelDialog("control", "pass")
                            .attr("type", "text");
                        $dlg.squirrelDialog("control", "conf")
                            .attr("type", "text");
                    } else {
                        $dlg.squirrelDialog("control", "pass")
                            .attr("type", "password");
                        $dlg.squirrelDialog("control", "conf")
                            .attr("type", "password");
                    }
                });

            $dlg.data("validate", function () {
                var p = $dlg.squirrelDialog("control", "pass")
                    .val(),
                    c = $dlg.squirrelDialog("control", "conf")
                    .val();

                $dlg.squirrelDialog("control", "nomatch")
                    .toggle(p !== c);
                return (p === c);
            });

            $dlg.squirrelDialog("control", "conf")
                .on("change", function () {
                    $dlg.data("validate")
                        .call();
                });

            $dlg.squirrelDialog("control", "set")
                .on($.getTapEvent(), function () {
                    if (!$dlg.data("validate")
                        .call())
                        return false;
                    $dlg.squirrelDialog("close");
                    var p = $dlg.squirrelDialog("control", "pass")
                        .val();
                    Squirrel.getClient()
                        .store.pass(p);
                    Squirrel.getClient()
                        .status = Squirrel.NEW_SETTINGS;
                    Squirrel.getCloud()
                        .store.pass(p);
                    Squirrel.getCloud()
                        .status = Squirrel.NEW_SETTINGS;
                    Utils.sometime("update_save");

                    return true;
                });
        });

        $('#chpw_dlg').on('dlg-open', function () {
            var $dlg = $(this);
            $dlg.data("validate")
                .call();
        });

        $('#json_dlg').on('dlg-initialise', function () {
            var $dlg = $(this);

            $dlg.squirrelDialog("control", "text")
                .on("input", function () {
                    $dlg.squirrelDialog("control", "ok")
                        .iconbutton("enable");
                });

            $dlg.squirrelDialog("control", "ok")
                .on($.getTapEvent(), function () {
                    $dlg.squirrelDialog("close");
                    var datum;
                    try {
                        datum = JSON.parse($dlg.squirrelDialog("control", "text")
                            .val());
                    } catch (e) {
                        Squirrel.alert({
                            title: TX.tx("JSON could not be parsed"),
                            severity: "error",
                            message: e
                        });
                        return false;
                    }
                    $dlg.squirrelDialog("control", "ok")
                        .iconbutton("disable");
                    if (global.DEBUG) console.debug("Importing...");
                    Squirrel.insert_data([], datum);
                    return true;
                });
        });

        $('#json_dlg').on('dlg-open', function () {
            var $dlg = $(this);

            var data = Squirrel.getClient()
                .hoard.JSON();
            $dlg.squirrelDialog("control", "text")
                .text(data)
                .select();
            $dlg.squirrelDialog("control", "ok")
                .iconbutton("disable");
        });

        $('#extras_dlg').on('dlg-initialise', function () {
            var $dlg = $(this);

            $dlg.squirrelDialog("control", "theme")
                .on("selectmenuchange", function () {
                    Squirrel.theme($(this)
                        .val());
                })
                .selectmenu();

            $dlg.squirrelDialog("control", "autosave")
                .on("change", function () {
                    Squirrel.autosave($(this)
                        .prop("checked"));
                });

            $dlg.squirrelDialog("control", "hidevalues")
                .on("change", function () {
                    $("#sites-node")
                        .tree("hide_values", $(this)
                            .prop("checked"));
                });

            $dlg.squirrelDialog("control", "chpw")
                .on($.getTapEvent(), function () {
                    $dlg.squirrelDialog("close");
                    $("#chpw_dlg")
                        .squirrelDialog("open");
                });

            $dlg.squirrelDialog("control", "chss")
                .on($.getTapEvent(), function () {
                    $dlg.squirrelDialog("close");
                    $("#store_settings_dlg")
                        .squirrelDialog("open");
                });

            $dlg.squirrelDialog("control", "theme")
                .on($.getTapEvent(), function () {
                    $dlg.squirrelDialog("close");
                    $("#theme_dlg")
                        .squirrelDialog("open");
                });

            $dlg.squirrelDialog("control", "json")
                .on($.getTapEvent(), function () {
                    $dlg.squirrelDialog("close");
                    $("#json_dlg")
                        .squirrelDialog("open");
                });

            $dlg.squirrelDialog("control", "optimise")
                .on($.getTapEvent(), function () {
                    $dlg.squirrelDialog("close");
                    $("#optimise_dlg")
                        .squirrelDialog("open");
                });

            $dlg.squirrelDialog("control", "bigger")
                .on("click", function () {
                    Squirrel.zoom(1.25);
                });

            $dlg.squirrelDialog("control", "smaller")
                .on("click", function () {
                    Squirrel.zoom(0.8);
                });

            $dlg.squirrelDialog("control", "about")
                .on($.getTapEvent(), function () {
                    $dlg.squirrelDialog("close");
                    $("#about_dlg")
                        .squirrelDialog("open");
                });

            $dlg.squirrelDialog("control", "language")
                .on("change", function () {
                    var fresh = $dlg.squirrelDialog("control", "language").val();
                    var stale = TX.language(fresh);
                    if (fresh !== stale)
                        // Re-translate for new language
                        TX.init();
                });
        });

        $('#extras_dlg').on('dlg-open', function () {
            var $dlg = $(this);

            if (!(Squirrel.USE_STEGANOGRAPHY ||
                    Squirrel.getCloud()
                    .store &&
                    Squirrel.getCloud()
                    .store.options()
                    .needs_path)) {
                $dlg.squirrelDialog("control", "chss")
                    .hide();
            }

            $dlg.squirrelDialog("control", "autosave")
                .prop("checked", Squirrel.autosave());

            $dlg.squirrelDialog("control", "hidevalues")
                .prop("checked", $("#sites-node")
                    .tree("hide_values"));

            $dlg.squirrelDialog("control", "theme")
                .find("option:selected")
                .prop("selected", false);
            $dlg.squirrelDialog("control", "theme")
                .find("option[value='" + Squirrel.theme() + "']")
                .prop("selected", true);

            $dlg.squirrelDialog("control", "language")
                .val(TX.language());

        });

        /* Helper for add, check wrapping node for same key value  */
        function _validateUniqueKey($dlg) {
            // Disable OK if key value exists or is invalid
            var $input = $dlg.squirrelDialog("control", "key");
            var val = $input.val();
            var enabled = true;

            if (!/\S/.test(val)) // empty?
                enabled = false;
            else {
                var $ul = $dlg.data("parent")
                    .find("ul")
                    .first();
                $ul.children(".tree-node")
                    .each(function () {
                        if (Squirrel.compare($(this)
                                .data("key"), val) == 0) {
                            enabled = false;
                            return false;
                        }
                    });
            }

            if (enabled) {
                $dlg.squirrelDialog("control", "ok")
                    .iconbutton("enable");
                $input
                    .removeClass("dlg-disabled")
                    .attr("title", TX.tx("Enter new name"));
            } else {
                $dlg.squirrelDialog("control", "ok")
                    .iconbutton("disable");
                $input
                    .addClass("dlg-disabled")
                    .attr("title", TX.tx("Name is already in use"));
            }
        }

        $('#insert_dlg').on('dlg-initialise', function () {
            var $dlg = $(this);

            $dlg.squirrelDialog("control", "key")
                .on("input", function () {
                    _validateUniqueKey($dlg);
                });
            $dlg.squirrelDialog("control", "ok")
                .on($.getTapEvent(), function () {
                    $dlg.squirrelDialog("close");
                    Squirrel.add_child_node($dlg.data("parent"),
                        $dlg.squirrelDialog("control", "key")
                        .val(),
                        $dlg.data("data"));
                });
        });

        $('#insert_dlg').on('dlg-open', function (e, options) {
            var $dlg = $(this);
            if (global.DEBUG) console.debug("Pasting");
            var $parent = options.$node;
            $dlg.data("parent", $parent);
            $dlg.data("data", options.data);
            var base = TX.tx("A copy");
            var name = new RegExp("^" + base + " ?(\\d*)$");
            var i = -1;
            $parent.find("ul")
                .first()
                .children(".tree-node")
                .each(function () {
                    var m = name.exec($(this)
                        .data("key"));
                    if (m)
                        i = Math.max(i, m[1] ? parseInt(m[1]) : 0);
                });
            $dlg.squirrelDialog("control", "key")
                .val(base + (i >= 0 ? (" " + (i + 1)) : ""));
        });

        $('#add_dlg').on('dlg-initialise', function () {
            var $dlg = $(this);

            function ok_dialog() {
                $dlg.squirrelDialog("close");
                var $parent = $dlg.data("parent");
                Squirrel.add_child_node(
                    $parent, $dlg.squirrelDialog("control", "key")
                    .val(),
                    $dlg.data("adding_value") ?
                    $dlg.squirrelDialog("control", "value")
                    .val() : undefined);
                return false;
            }

            $dlg.squirrelDialog("control", "key")
                .on("input", function () {
                    _validateUniqueKey($dlg);
                })
                .on("change", ok_dialog)
                .autocomplete({
                    source: [
                        TX.tx("User"), TX.tx("Pass")]
                });

            $dlg.squirrelDialog("control", "ok")
                .on($.getTapEvent(), ok_dialog);
        });

        $('#add_dlg').on('dlg-open', function (e, options) {
            var $dlg = $(this);
            var $parent = options.$node;
            var is_value = options.is_value;
            $dlg.data("parent", $parent);
            $dlg.data("adding_value", is_value);

            $dlg.squirrelDialog("control", "path")
                .text($parent.tree("getPath")
                    .join("↘") + "↘");
            if (is_value) {
                $dlg.squirrelDialog("control", "value_help")
                    .show();
                $dlg.squirrelDialog("control", "folder_help")
                    .hide();
                $dlg.squirrelDialog("control", "value_parts")
                    .show();
                $dlg.squirrelDialog("control", "key")
                    .autocomplete("enable")
                    .select();
                $dlg.squirrelDialog("control", "value")
                    .val("");
            } else {
                $dlg.squirrelDialog("control", "value_help")
                    .hide();
                $dlg.squirrelDialog("control", "folder_help")
                    .show();
                $dlg.squirrelDialog("control", "value_parts")
                    .hide();
                $dlg.squirrelDialog("control", "key")
                    .autocomplete("disable")
                    .select();
            }

            _validateUniqueKey($dlg);
        });

        $('#optimise_dlg').on('dlg-initialise', function () {
            var $dlg = $(this);

            $dlg.squirrelDialog("control", "optimise")
                .on($.getTapEvent(), function () {
                    Squirrel.getClient()
                        .hoard.clear_actions();
                    Squirrel.construct_new_cloud(function () {
                        $dlg.squirrelDialog("close");
                    });
                    // Local actions will now be reflected in the cloud,
                    // so we can clear them
                    return false;
                });
        });

        $('#optimise_dlg').on('dlg-open', function () {
            var $dlg = $(this);

            $dlg.squirrelDialog("control", "existing")
                .template(
                    "expand",
                    Squirrel.getCloud()
                    .hoard.actions.length);
            $dlg.squirrelDialog("control", "study").hide();
            $dlg.squirrelDialog("control", "pointless").hide();
            $dlg.squirrelDialog("control", "optimise")
                .iconbutton("disable");
            $dlg.squirrelDialog("control", "calculating")
                .show()
                .toggle("pulsate", 101);

            var hoard = Squirrel.getClient()
                .hoard;
            var counts = {
                "N": 0,
                "A": 0,
                "X": 0
            };
            hoard.actions_from_hierarchy(
                hoard.cache,
                function (e, follow) {
                    counts[e.type]++;
                    if (follow)
                        follow();
                },
                null,
                function () {
                    $dlg.squirrelDialog("control", "calculating").hide();
                    $dlg.squirrelDialog("control", "study")
                        .template(
                            "expand",
                            counts.N, counts.A, counts.X,
                            counts.N + counts.A + counts.X)
                        .show();
                    if (counts.N + counts.A + counts.X <
                        Squirrel.getCloud().hoard.actions.length)
                        $dlg.squirrelDialog("control", "optimise").iconbutton("enable");
                    else
                        $dlg.squirrelDialog("control", "pointless").show()
                });
        });
    });
})(jQuery);