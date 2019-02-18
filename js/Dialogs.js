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
            $dlg.squirrel_dialog("control", "uReq")
                .toggle(options.user_required);
            $dlg.squirrel_dialog("control", "pReq")
                .toggle(options.pass_required);

            var $user = $dlg.squirrel_dialog("control", "user");
            var $pass = $dlg.squirrel_dialog("control", "pass");
            var $signin = $dlg.squirrel_dialog("control", "signin");

            var sign_in = function () {
                if ($dlg.squirrel_dialog("isOpen")) {
                    $dlg.squirrel_dialog("close");
                    $signin.off($.getTapEvent());
                    $user.off("change");
                    $pass.off("change");
                    options.on_signin.call(
                        options.store,
                        $user.val(),
                        $pass.data("hidden_pass"));
                }
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
                $dlg.squirrel_dialog("control", "foruser")
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
                $dlg.squirrel_dialog("control", "ok")
                    .on($.getTapEvent(), function () {
                        $dlg.squirrel_dialog("close");
                        Squirrel.playAction(Hoard.new_action(
                            "D", $dlg.data("node").tree("getPath"), Date.now()));
                        return true;
                    });
                $dlg.squirrel_dialog("control", "cancel")
                    .on($.getTapEvent(), function () {
                        $dlg.squirrel_dialog("close");
                        return false;
                    });
            })
            .on('dlg-open', function () {
                var $dlg = $(this);
                $dlg.squirrel_dialog("control", "path")
                    .text(
                        $dlg.data("node").tree("getPath")
                        .join("↘"));
                $dlg.squirrel_dialog("control", "coll")
                    .toggle(!$dlg.data("node").hasClass("tree-leaf"));
            });

        $('#pick_dlg')
            .on('dlg-initialise', function () {
                var $dlg = $(this);
                $dlg.squirrel_dialog("control", "clear")
                    .on($.getTapEvent(), function () {
                        $dlg.find(".dlg-picked")
                            .removeClass("dlg-picked");
                    });
            })
            .on('dlg-open', function () {
                var $dlg = $(this);

                var $node = $dlg.data("node");
                var val = $node.data("value");
                var $which = $dlg.squirrel_dialog("control", "which");
                var $from = $dlg.squirrel_dialog("control", "from");
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
            var dlg_l = $dlg.squirrel_dialog("control", "len").val();
            var dlg_c = $dlg.squirrel_dialog("control", "chs").val();

            if (dlg_l != nc[0] || dlg_c != nc[1])
                $dlg.squirrel_dialog("control", "remember").show();
            else
                $dlg.squirrel_dialog("control", "remember").hide();

            if (dlg_l !== DEFAULT_RANDOM_LEN || dlg_c !== DEFAULT_RANDOM_CHS)
                $dlg.squirrel_dialog("control", "reset").show();
            else
                $dlg.squirrel_dialog("control", "reset").hide();

            $dlg.squirrel_dialog("control", "again")
                .trigger($.getTapEvent());
        }

        function reset_constraints($dlg) {
            $dlg.squirrel_dialog("control", "len").val(DEFAULT_RANDOM_LEN);
            $dlg.squirrel_dialog("control", "chs").val(DEFAULT_RANDOM_CHS);
            constraints_changed($dlg);
        }

        $('#randomise_dlg').on('dlg-initialise', function () {
            var $dlg = $(this);

            $dlg.squirrel_dialog("control", "again")
                .on($.getTapEvent(), function () {
                    $dlg.squirrel_dialog("control", "idea")
                        .text(Utils.generate_password({
                            length: $dlg.squirrel_dialog("control", "len")
                                .val(),
                            charset: $dlg.squirrel_dialog("control", "chs")
                                .val()
                        }));
                    return false;
                });
            $dlg.squirrel_dialog("control", "use")
                .on($.getTapEvent(), function () {
                    $dlg.squirrel_dialog("close");
                    Squirrel.playAction(Hoard.new_action(
                        "E", $dlg.data("node").tree("getPath"), Date.now(),
                        $dlg.squirrel_dialog("control", "idea").text()));
                    return true;
                });
            $dlg.squirrel_dialog("control", "len")
                .on("change", function () {
                    constraints_changed($dlg);
                });
            $dlg.squirrel_dialog("control", "chs")
                .on("change", function () {
                    constraints_changed($dlg);
                });
            $dlg.squirrel_dialog("control", "remember")
                .on($.getTapEvent(), function () {
                    Squirrel.playAction(Hoard.new_action(
                        "X", $dlg.data("node").tree("getPath"), Date.now(),
                        $dlg.squirrel_dialog("control", "len").val() + ";" +
                        $dlg.squirrel_dialog("control", "chs").val()));
                    constraints_changed($dlg);
                });
            $dlg.squirrel_dialog("control", "reset")
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
                $dlg.squirrel_dialog("control", "len").val(c[0]);
                $dlg.squirrel_dialog("control", "chs").val(c[1]);
            }

            var path = $node.tree("getPath");
            $dlg.squirrel_dialog("control", "path")
                .text(path.join("↘"));
            $dlg.squirrel_dialog("control", "key")
                .text(my_key);
            $dlg.squirrel_dialog("control", "again")
                .trigger($.getTapEvent());

            $dlg.squirrel_dialog("control", "remember")
                .hide();

            constraints_changed($dlg);
        });

        $('#search_dlg').on('dlg-initialise', function () {
            var $dlg = $(this);
            $dlg.squirrel_dialog("control", "ok")
                .on($.getTapEvent(), function () {
                    $dlg.squirrel_dialog("close");
                    Squirrel.search($dlg.squirrel_dialog("control", "string")
                        .val());
                });
            $dlg.squirrel_dialog("control", "string")
                .on("change", function () {
                    $dlg.squirrel_dialog("control", "ok")
                        .trigger($.getTapEvent());
                });
        });

        /**
         * Reminder setting dialog
         */

        /* Helper */
        function _updateNext($dlg) {
            var numb = $dlg.squirrel_dialog("control", "number")
                .val();
            // Convert to days
            numb = numb * Utils.TIMEUNITS[$dlg.squirrel_dialog("control", "units")
                .val()].days;
            var alarmd = new Date(Date.now() + numb * Utils.MSPERDAY);
            $dlg.squirrel_dialog("control", "nextmod")
                .template(
                    "expand",
                    Utils.deltaTimeString(alarmd),
                    alarmd.toLocaleDateString());
        }

        $('#alarm_dlg').on('dlg-initialise', function () {
            var $dlg = $(this);

            $dlg.squirrel_dialog("control", "units")
                .on("change", function () {
                    _updateNext($dlg);
                });

            $dlg.squirrel_dialog("control", "number")
                .on("change", function () {
                    _updateNext($dlg);
                });

            $dlg.squirrel_dialog("control", "remind")
                .on($.getTapEvent(), function () {
                    $dlg.squirrel_dialog("close");
                    var numb = $dlg.squirrel_dialog("control", "number")
                        .val() *
                        Utils.TIMEUNITS[$dlg.squirrel_dialog("control", "units")
                            .val()].days;
                    Squirrel.playAction(Hoard.new_action(
                        "A", $dlg.data("node").tree("getPath"), Date.now(),
                        numb));
                    return false;
                });

            $dlg.squirrel_dialog("control", "clear")
                .on($.getTapEvent(), function () {
                    $dlg.squirrel_dialog("close");
                    Squirrel.playAction(Hoard.new_action(
                        "C", $dlg.data("node").tree("getPath"), Date.now()));
                    return false;
                });
        });

        $('#alarm_dlg').on('dlg-open', function () {
            var $dlg = $(this);
            var $node = $dlg.data("node");

            $dlg.squirrel_dialog("control", "path")
                .text($node.tree("getPath")
                    .join("↘"));

            $dlg.data("node", $node);
            var lastmod = $node.data("last-time-changed");
            $dlg.squirrel_dialog("control", "lastmod")
                .template(
                    "expand",
                    new Date(lastmod)
                    .toLocaleString());

            if (typeof $node.data("alarm") !== "undefined") {
                var alarm = new Date(
                    lastmod + $node.data("alarm") * Utils.MSPERDAY);
                $dlg.squirrel_dialog("control", "current")
                    .template(
                        "expand",
                        Utils.deltaTimeString(alarm),
                        alarm.toLocaleDateString())
                    .show();
                $dlg.squirrel_dialog("control", "clear")
                    .show();
            } else {
                $dlg.squirrel_dialog("control", "current")
                    .hide();
                $dlg.squirrel_dialog("control", "clear")
                    .hide();
            }

            _updateNext(this);
        });

        /* Helper */
        function _changeImage($dlg) {
            var file = $dlg.squirrel_dialog("control", "file")[0].files[0];
            Utils.read_file(
                file, "arraybuffer")
                .then((data) => {
                    data = "data:" + file.type + ";base64," +
                        Utils.ArrayBufferToBase64(data);
                    if (data !== $dlg.squirrel_dialog("control", "steg_image")
                        .attr("src", data)) {
                        $dlg.squirrel_dialog("control", "steg_image")
                            .attr("src", data)
                            .off("load")
                            .on("load", function () {
                                $(this)
                                    .off("load");
                                // Check that we can use the image.
                                try {
                                    let steg = new Steganographer({image:this});
                                    steg.inject("tada");
                                } catch (e) {
                                    if (global.DEBUG) console.debug("Caught " + e);
                                    fail(e);
                                    return;
                                }
                                $dlg.squirrel_dialog("control", "ok")
                                    .icon_button("enable");
                                var h = this.naturalHeight;
                                var w = this.naturalWidth;
                                this.height = 100;
                                $dlg.squirrel_dialog("control", "message")
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
                }).catch((e) => {
                    $dlg.squirrel_dialog("control", "message")
                        .template("pick", "cui")
                        .template("expand", e);
                });
        }

        $('#store_settings_dlg').on('dlg-initialise', function () {
            var $dlg = $(this);

            $dlg.squirrel_dialog("control", "file")
                .hide()
                .on($.getTapEvent(), function () {
                    _changeImage($dlg);
                });

            $dlg.squirrel_dialog("control", "image")
                .on($.getTapEvent(), function (e) {
                    $dlg.squirrel_dialog("control", "file")
                        .trigger("change", e);
                });

            $dlg.squirrel_dialog("control", "storepath")
                .on("keyup", function () {
                    if ($dlg.squirrel_dialog("control", "storepath")
                        .val() === "") {
                        $dlg.squirrel_dialog("control", "message")
                            .template("pick", "mnbe");
                        return false;
                    }
                    if (Squirrel.getClient()
                        .hoard.options.store_path !==
                        $dlg.squirrel_dialog("control", "storepath")
                        .val()) {
                        Squirrel.getClient()
                            .hoard.options.store_path =
                            $dlg.squirrel_dialog("control", "storepath")
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
                    $dlg.squirrel_dialog("control", "ok")
                        .trigger($.getTapEvent());
                });

            $dlg.squirrel_dialog("control", "ok")
                .on($.getTapEvent(), function () {
                    if ($dlg.squirrel_dialog("control", "storepath")
                        .val() === "") {
                        $dlg.squirrel_dialog("control", "message")
                            .template("pick", "mnbe");
                        return false;
                    }
                    $dlg.squirrel_dialog("close");
                });
        });

        $('#store_settings_dlg').on('dlg-open', function () {
            var $dlg = $(this);
            $dlg.squirrel_dialog("control", "message")
                .hide();
            $dlg.squirrel_dialog("control", "storepath")
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

            $dlg.squirrel_dialog("control", "show")
                .on("change", function () {
                    if ($dlg.squirrel_dialog("control", "show")
                        .prop("checked")) {
                        $dlg.squirrel_dialog("control", "pass")
                            .attr("type", "text");
                        $dlg.squirrel_dialog("control", "conf")
                            .attr("type", "text");
                    } else {
                        $dlg.squirrel_dialog("control", "pass")
                            .attr("type", "password");
                        $dlg.squirrel_dialog("control", "conf")
                            .attr("type", "password");
                    }
                });

            $dlg.data("validate", function () {
                var p = $dlg.squirrel_dialog("control", "pass")
                    .val(),
                    c = $dlg.squirrel_dialog("control", "conf")
                    .val();

                $dlg.squirrel_dialog("control", "nomatch")
                    .toggle(p !== c);
                return (p === c);
            });

            $dlg.squirrel_dialog("control", "conf")
                .on("change", function () {
                    $dlg.data("validate")
                        .call();
                });

            $dlg.squirrel_dialog("control", "set")
                .on($.getTapEvent(), function () {
                    if (!$dlg.data("validate")
                        .call())
                        return false;
                    $dlg.squirrel_dialog("close");
                    var p = $dlg.squirrel_dialog("control", "pass")
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

            $dlg.squirrel_dialog("control", "text")
                .on("input", function () {
                    $dlg.squirrel_dialog("control", "ok")
                        .icon_button("enable");
                });

            $dlg.squirrel_dialog("control", "ok")
                .on($.getTapEvent(), function () {
                    $dlg.squirrel_dialog("close");
                    var datum;
                    try {
                        datum = JSON.parse($dlg.squirrel_dialog("control", "text")
                            .val());
                    } catch (e) {
                        Squirrel.alert({
                            title: TX.tx("JSON could not be parsed"),
                            severity: "error",
                            message: e
                        });
                        return false;
                    }
                    $dlg.squirrel_dialog("control", "ok")
                        .icon_button("disable");
                    if (global.DEBUG) console.debug("Importing...");
                    Squirrel.insert_data([], datum);
                    return true;
                });
        });

        $('#json_dlg').on('dlg-open', function () {
            var $dlg = $(this);

            var data = Squirrel.getClient()
                .hoard.JSON();
            $dlg.squirrel_dialog("control", "text")
                .text(data)
                .select();
            $dlg.squirrel_dialog("control", "ok")
                .icon_button("disable");
        });

        $('#extras_dlg').on('dlg-initialise', function () {
            var $dlg = $(this);

            $dlg.squirrel_dialog("control", "theme")
                .on("selectmenuchange", function () {
                    Squirrel.theme($(this)
                        .val());
                })
                .selectmenu();

            $dlg.squirrel_dialog("control", "autosave")
                .on("change", function () {
                    Squirrel.autosave($(this)
                        .prop("checked"));
                });

            $dlg.squirrel_dialog("control", "hidevalues")
                .on("change", function () {
                    $("#sites-node")
                        .tree("hide_values", $(this)
                            .prop("checked"));
                });

            $dlg.squirrel_dialog("control", "chpw")
                .on($.getTapEvent(), function () {
                    $dlg.squirrel_dialog("close");
                    $("#chpw_dlg")
                        .squirrel_dialog("open");
                });

            $dlg.squirrel_dialog("control", "chss")
                .on($.getTapEvent(), function () {
                    $dlg.squirrel_dialog("close");
                    $("#store_settings_dlg")
                        .squirrel_dialog("open");
                });

            $dlg.squirrel_dialog("control", "theme")
                .on($.getTapEvent(), function () {
                    $dlg.squirrel_dialog("close");
                    $("#theme_dlg")
                        .squirrel_dialog("open");
                });

            $dlg.squirrel_dialog("control", "json")
                .on($.getTapEvent(), function () {
                    $dlg.squirrel_dialog("close");
                    $("#json_dlg")
                        .squirrel_dialog("open");
                });

            $dlg.squirrel_dialog("control", "optimise")
                .on($.getTapEvent(), function () {
                    $dlg.squirrel_dialog("close");
                    $("#optimise_dlg")
                        .squirrel_dialog("open");
                });

            $dlg.squirrel_dialog("control", "bigger")
                .on("click", function () {
                    Squirrel.zoom(1.25);
                });

            $dlg.squirrel_dialog("control", "smaller")
                .on("click", function () {
                    Squirrel.zoom(0.8);
                });

            $dlg.squirrel_dialog("control", "about")
                .on($.getTapEvent(), function () {
                    $dlg.squirrel_dialog("close");
                    $("#about_dlg")
                        .squirrel_dialog("open");
                });

            $dlg.squirrel_dialog("control", "language")
                .on("change", function () {
                    var fresh = $dlg.squirrel_dialog("control", "language").val();
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
                $dlg.squirrel_dialog("control", "chss")
                    .hide();
            }

            $dlg.squirrel_dialog("control", "autosave")
                .prop("checked", Squirrel.autosave());

            $dlg.squirrel_dialog("control", "hidevalues")
                .prop("checked", $("#sites-node")
                    .tree("hide_values"));

            $dlg.squirrel_dialog("control", "theme")
                .find("option:selected")
                .prop("selected", false);
            $dlg.squirrel_dialog("control", "theme")
                .find("option[value='" + Squirrel.theme() + "']")
                .prop("selected", true);

            $dlg.squirrel_dialog("control", "language")
                .val(TX.language());

        });

        /* Helper for add, check wrapping node for same key value  */
        function _validateUniqueKey($dlg) {
            // Disable OK if key value exists or is invalid
            var $input = $dlg.squirrel_dialog("control", "key");
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
                $dlg.squirrel_dialog("control", "ok")
                    .iconbutton("enable");
                $input
                    .removeClass("dlg-disabled")
                    .attr("title", TX.tx("Enter new name"));
            } else {
                $dlg.squirrel_dialog("control", "ok")
                    .iconbutton("disable");
                $input
                    .addClass("dlg-disabled")
                    .attr("title", TX.tx("Name is already in use"));
            }
        }

        $('#insert_dlg').on('dlg-initialise', function () {
            var $dlg = $(this);

            $dlg.squirrel_dialog("control", "key")
                .on("input", function () {
                    _validateUniqueKey($dlg);
                });
            $dlg.squirrel_dialog("control", "ok")
                .on($.getTapEvent(), function () {
                    $dlg.squirrel_dialog("close");
                    Squirrel.add_child_node($dlg.data("parent"),
                        $dlg.squirrel_dialog("control", "key")
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
            $dlg.squirrel_dialog("control", "key")
                .val(base + (i >= 0 ? (" " + (i + 1)) : ""));
        });

        $('#add_dlg').on('dlg-initialise', function () {
            var $dlg = $(this);

            function ok_dialog() {
                $dlg.squirrel_dialog("close");
                var $parent = $dlg.data("parent");
                Squirrel.add_child_node(
                    $parent, $dlg.squirrel_dialog("control", "key")
                    .val(),
                    $dlg.data("adding_value") ?
                    $dlg.squirrel_dialog("control", "value")
                    .val() : undefined);
                return false;
            }

            $dlg.squirrel_dialog("control", "key")
                .on("input", function () {
                    _validateUniqueKey($dlg);
                })
                .on("change", ok_dialog)
                .autocomplete({
                    source: [
                        TX.tx("User"), TX.tx("Pass")]
                });

            $dlg.squirrel_dialog("control", "ok")
                .on($.getTapEvent(), ok_dialog);
        });

        $('#add_dlg').on('dlg-open', function (e, options) {
            var $dlg = $(this);
            var $parent = options.$node;
            var is_value = options.is_value;
            $dlg.data("parent", $parent);
            $dlg.data("adding_value", is_value);

            $dlg.squirrel_dialog("control", "path")
                .text($parent.tree("getPath")
                    .join("↘") + "↘");
            if (is_value) {
                $dlg.squirrel_dialog("control", "value_help")
                    .show();
                $dlg.squirrel_dialog("control", "folder_help")
                    .hide();
                $dlg.squirrel_dialog("control", "value_parts")
                    .show();
                $dlg.squirrel_dialog("control", "key")
                    .autocomplete("enable")
                    .select();
                $dlg.squirrel_dialog("control", "value")
                    .val("");
            } else {
                $dlg.squirrel_dialog("control", "value_help")
                    .hide();
                $dlg.squirrel_dialog("control", "folder_help")
                    .show();
                $dlg.squirrel_dialog("control", "value_parts")
                    .hide();
                $dlg.squirrel_dialog("control", "key")
                    .autocomplete("disable")
                    .select();
            }

            _validateUniqueKey($dlg);
        });

        $('#optimise_dlg').on('dlg-initialise', function () {
            var $dlg = $(this);

            $dlg.squirrel_dialog("control", "optimise")
                .on($.getTapEvent(), function () {
                    Squirrel.getClient()
                        .hoard.clear_actions();
                    Squirrel.construct_new_cloud(function () {
                        $dlg.squirrel_dialog("close");
                    });
                    // Local actions will now be reflected in the cloud,
                    // so we can clear them
                    return false;
                });
        });

        $('#optimise_dlg').on('dlg-open', function () {
            var $dlg = $(this);

            $dlg.squirrel_dialog("control", "existing")
                .template(
                    "expand",
                    Squirrel.getCloud()
                    .hoard.actions.length);
            $dlg.squirrel_dialog("control", "study").hide();
            $dlg.squirrel_dialog("control", "pointless").hide();
            $dlg.squirrel_dialog("control", "optimise")
                .iconbutton("disable");
            $dlg.squirrel_dialog("control", "calculating")
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
                    $dlg.squirrel_dialog("control", "calculating").hide();
                    $dlg.squirrel_dialog("control", "study")
                        .template(
                            "expand",
                            counts.N, counts.A, counts.X,
                            counts.N + counts.A + counts.X)
                        .show();
                    if (counts.N + counts.A + counts.X <
                        Squirrel.getCloud().hoard.actions.length)
                        $dlg.squirrel_dialog("control", "optimise").iconbutton("enable");
                    else
                        $dlg.squirrel_dialog("control", "pointless").show()
                });
        });
    });
})(jQuery);
