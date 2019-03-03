/*@preserve Copyright (C) 2015-2018 Crawford Currie http://c-dot.co.uk license MIT*/
/* eslint-env browser */

define(["jquery", "js/Utils", "js/Steganographer", "js/Translator", "js/Hoard", "js/Tree", "jsjq/icon_button", "jsjq/squirrel_dialog"], function($, Utils, Steganographer, Translator, Hoard, Tree) {

    let TX = Translator.instance();

    // Handlers for Squirrel dialogs.
    $(function () {

        // Timeout intervals, milliseconds
        const MSPERDAY = 24 * 60 * 60 * 1000;

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
            let $dlg = $(this);
            $dlg.squirrel_dialog("control", "uReq")
                .toggle(options.user_required);
            $dlg.squirrel_dialog("control", "pReq")
                .toggle(options.pass_required);

            let $user = $dlg.squirrel_dialog("control", "user");
            let $pass = $dlg.squirrel_dialog("control", "pass");
            let $signin = $dlg.squirrel_dialog("control", "signin");

            let sign_in = function () {
                if ($dlg.squirrel_dialog("isOpen")) {
                    $dlg.squirrel_dialog("close");
                    $signin.off($.getTapEvent());
                    $user.off("change");
                    $pass.off("change");
                    options.on_signin.call(
                        $user.val(),
                        $pass.data("hidden_pass"));
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

        /**
         * Confirm deletion of a node
         */
        $('#delete_dlg')
            .on('dlg-initialise', function () {
                let $dlg = $(this);
                $dlg.squirrel_dialog("control", "ok")
                    .on($.getTapEvent(), function () {
                        $dlg.squirrel_dialog("close");
                        $dlg.squirrel_dialog("squirrel").playAction(Hoard.new_action(
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
                let $dlg = $(this);
                $dlg.squirrel_dialog("control", "path")
                    .text(
                        $dlg.data("node").tree("getPath")
                            .join("↘"));
                $dlg.squirrel_dialog("control", "coll")
                    .toggle(!$dlg.data("node").hasClass("tree-leaf"));
            });

        $('#pick_dlg')
            .on('dlg-initialise', function () {
                let $dlg = $(this);
                $dlg.squirrel_dialog("control", "clear")
                    .on($.getTapEvent(), function () {
                        $dlg.find(".dlg-picked")
                            .removeClass("dlg-picked");
                    });
            })
            .on('dlg-open', function () {
                let $dlg = $(this);

                let $node = $dlg.data("node");
                let val = $node.data("value");
                let $which = $dlg.squirrel_dialog("control", "which");
                let $from = $dlg.squirrel_dialog("control", "from");
                let i, $f;

                $dlg.find(".dlg-pick-cell")
                    .remove();

                let item_clicked = function () {
                    let ii = $(this)
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
            let $node = $dlg.data("node");
            let nc = $node.data("constraints");
            if (typeof nc !== "undefined")
                nc = nc.split(/;/, 2);
            else
                nc = [DEFAULT_RANDOM_LEN, DEFAULT_RANDOM_CHS];
            let dlg_l = $dlg.squirrel_dialog("control", "len").val();
            let dlg_c = $dlg.squirrel_dialog("control", "chs").val();

            if (dlg_l !== nc[0] || dlg_c !== nc[1])
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
            let $dlg = $(this);

            $dlg.squirrel_dialog("control", "again")
                .on($.getTapEvent(), function () {
                    $dlg.squirrel_dialog("control", "idea")
                        .text(Utils.generatePassword({
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
                    $dlg.squirrel_dialog("squirrel").playAction(Hoard.new_action(
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
                    $dlg.squirrel_dialog("squirrel").playAction(Hoard.new_action(
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
            let $dlg = $(this);
            let $node = $dlg.data("node");
            let my_key = $node.data("key");
            let c = $node.data("constraints");

            if (c) {
                c = c.split(";", 2);
                $dlg.squirrel_dialog("control", "len").val(c[0]);
                $dlg.squirrel_dialog("control", "chs").val(c[1]);
            }

            let path = $node.tree("getPath");
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
            let $dlg = $(this);
            $dlg.squirrel_dialog("control", "ok")
                .on($.getTapEvent(), function () {
                    $dlg.squirrel_dialog("close");
                    $dlg.squirrel_dialog("squirrel").search($dlg.squirrel_dialog("control", "string")
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
            let numb = $dlg.squirrel_dialog("control", "number")
                .val();
            // Convert to days
            numb = numb * Utils.TIMEUNITS[$dlg.squirrel_dialog("control", "units")
                                          .val()].days;
            let alarmd = new Date(Date.now() + numb * MSPERDAY);
            $dlg.squirrel_dialog("control", "nextmod")
                .template(
                    "expand",
                    Utils.deltaTimeString(alarmd),
                    alarmd.toLocaleDateString());
        }

        $('#alarm_dlg').on('dlg-initialise', function () {
            let $dlg = $(this);

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
                    let numb = $dlg.squirrel_dialog("control", "number")
                        .val() *
                        Utils.TIMEUNITS[$dlg.squirrel_dialog("control", "units")
                                        .val()].days;
                    $dlg.squirrel_dialog("squirrel").playAction(Hoard.new_action(
                        "A", $dlg.data("node").tree("getPath"), Date.now(),
                        numb));
                    return false;
                });

            $dlg.squirrel_dialog("control", "clear")
                .on($.getTapEvent(), function () {
                    $dlg.squirrel_dialog("close");
                    $dlg.squirrel_dialog("squirrel").playAction(Hoard.new_action(
                        "C", $dlg.data("node").tree("getPath"), Date.now()));
                    return false;
                });
        });

        $('#alarm_dlg').on('dlg-open', function () {
            let $dlg = $(this);
            let $node = $dlg.data("node");

            $dlg.squirrel_dialog("control", "path")
                .text($node.tree("getPath")
                      .join("↘"));

            $dlg.data("node", $node);
            let lastmod = $node.data("last-time-changed");
            $dlg.squirrel_dialog("control", "lastmod")
                .template(
                    "expand",
                    new Date(lastmod)
                        .toLocaleString());

            if (typeof $node.data("alarm") !== "undefined") {
                let alarm = new Date(
                    lastmod + $node.data("alarm") * MSPERDAY);
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
            let s = $dlg.squirrel_dialog("squirrel");
            let file = $dlg.squirrel_dialog("control", "image_file")[0].files[0];
            Utils.readFile(
                file, "arraybuffer")
                .then((data) => {
                    data = "data:" + file.type + ";base64," +
                        Utils.Uint8ArrayToBase64(data);
                    if (data !== $dlg.squirrel_dialog("control", "steg_image")
                        .attr("src", data)) {
                        $dlg.squirrel_dialog("control", "steg_image")
                            .attr("src", data)
                            .off("load")
                            .on("load", function () {
                                $(this)
                                    .off("load");
                                // Check that we can use the image.
                                let steg = new Steganographer({image:this});
                                steg.inject("tada");
                                $dlg.squirrel_dialog("control", "ok")
                                    .icon_button("enable");
                                let h = this.naturalHeight;
                                let w = this.naturalWidth;
                                this.height = 100;
                                $dlg.squirrel_dialog("control", "message")
                                    .template("pick", "xbyy")
                                    .template("expand", w, h);
                                if (s.client
                                    .status === s.IS_LOADED)
                                    s.client
                                    .status = s.NEW_SETTINGS;
                                if (s.cloud
                                    .status === s.IS_LOADED)
                                    s.cloud
                                    .status = s.NEW_SETTINGS;
                                s.trigger("update_save");
                            });
                    }
                }).catch((e) => {
                    $dlg.squirrel_dialog("control", "message")
                        .template("pick", "cui")
                        .template("expand", e);
                });
        }

        $('#store_settings_dlg').on('dlg-initialise', function () {
            let $dlg = $(this);

            $dlg.squirrel_dialog("control", "image_file")
                .hide()
                .on($.getTapEvent(), function () {
                    _changeImage($dlg);
                });

            $dlg.squirrel_dialog("control", "image")
                .hide()
                .on($.getTapEvent(), function (e) {
                    $dlg.squirrel_dialog("control", "image_file")
                        .trigger("change", e);
                });

            $dlg.squirrel_dialog("control", "storepath")
                .on("keyup", function () {
                    let app = $dlg.squirrel_dialog("squirrel");
                    if ($dlg.squirrel_dialog("control", "storepath")
                        .val() === "") {
                        $dlg.squirrel_dialog("control", "message")
                            .template("pick", "mnbe");
                        return false;
                    }
                    if (app.client
                        .hoard.options.store_path !==
                        $dlg.squirrel_dialog("control", "storepath")
                        .val()) {
                        app.client
                            .hoard.options.store_path =
                            $dlg.squirrel_dialog("control", "storepath")
                            .val();
                        if (app.client
                            .status === app.IS_LOADED)
                            app.client
                            .status = app.NEW_SETTINGS;
                        // No - the cloud isn't affected by the store path,
                        // so don't mark it as changed
                        // if ($dlg.squirrel_dialog("squirrel").cloud.status === $dlg.squirrel_dialog("squirrel").IS_LOADED)
                        //     $dlg.squirrel_dialog("squirrel").cloud.status = $dlg.squirrel_dialog("squirrel").NEW_SETTINGS;
                        app.trigger("update_save");
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

        $('#store_settings_dlg').on('dlg-open', function (options) {
            let $dlg = $(this);
            if (options.get_image)
                $dlg.find(".using_steganography").show();
            else
                $dlg.find(".using_steganography").show();
            $dlg.squirrel_dialog("control", "message")
                .hide();
            if (options.get_path)
                $dlg.squirrel_dialog("control", "storepath")
                .focus()
                .val(
                    $dlg.squirrel_dialog("squirrel").client
                        .hoard.options.store_path);
        });

        /**
         * Encryption password change dialog
         */
        $('#chpw_dlg').on('dlg-initialise', function () {
            let $dlg = $(this);

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
                let p = $dlg.squirrel_dialog("control", "pass")
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
                    let p = $dlg.squirrel_dialog("control", "pass")
                        .val();
                    let app = $dlg.squirrel_dialog("squirrel");
                    app.client
                        .store.option("pass", p);
                    app.client.status = app.NEW_SETTINGS;
                    app.cloud
                        .store.option("pass", p);
                    app.cloud.status = app.NEW_SETTINGS;
                    app.trigger("update_save");

                    return true;
                });
        });

        $('#chpw_dlg').on('dlg-open', function () {
            let $dlg = $(this);
            $dlg.data("validate")
                .call();
        });

        $('#json_dlg').on('dlg-initialise', function () {
            let $dlg = $(this);

            $dlg.squirrel_dialog("control", "text")
                .on("input", function () {
                    $dlg.squirrel_dialog("control", "ok")
                        .icon_button("enable");
                });

            $dlg.squirrel_dialog("control", "ok")
                .on($.getTapEvent(), function () {
                    $dlg.squirrel_dialog("close");
                    let datum;
                    try {
                        datum = JSON.parse($dlg.squirrel_dialog("control", "text")
                                           .val());
                    } catch (e) {
                        $dlg.squirrel_dialog("squirrel").alert({
                            title: TX.tx("JSON could not be parsed"),
                            severity: "error",
                            message: e
                        });
                        return false;
                    }
                    $dlg.squirrel_dialog("control", "ok")
                        .icon_button("disable");
                    let self = $dlg.squirrel_dialog("instance");
                    if (self.options.debug) self.options.debug("Importing...");
                    $dlg.squirrel_dialog("squirrel").insert_data([], datum);
                    return true;
                });
        });

        $('#json_dlg').on('dlg-open', function () {
            let $dlg = $(this);

            let data = $dlg.squirrel_dialog("squirrel").client
                .hoard.JSON();
            $dlg.squirrel_dialog("control", "text")
                .text(data)
                .select();
            $dlg.squirrel_dialog("control", "ok")
                .icon_button("disable");
        });

        $('#extras_dlg').on('dlg-initialise', function () {
            let $dlg = $(this);

            $dlg.squirrel_dialog("control", "theme")
                .on("selectmenuchange", function () {
                    $dlg.squirrel_dialog("squirrel").theme($(this)
                                                           .val());
                })
                .selectmenu();

            $dlg.squirrel_dialog("control", "autosave")
                .on("change", function () {
                    $dlg.squirrel_dialog("squirrel").autosave($(this)
                                                              .prop("checked"));
                });

            $dlg.squirrel_dialog("control", "hidevalues")
                .on("change", function () {
                    Tree.hidingValues = $(this).prop("checked");
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
                    $dlg.squirrel_dialog("squirrel").zoom(1.25);
                });

            $dlg.squirrel_dialog("control", "smaller")
                .on("click", function () {
                    $dlg.squirrel_dialog("squirrel").zoom(0.8);
                });

            $dlg.squirrel_dialog("control", "about")
                .on($.getTapEvent(), function () {
                    $dlg.squirrel_dialog("close");
                    $("#about_dlg")
                        .squirrel_dialog("open");
                });

            $dlg.squirrel_dialog("control", "language")
                .on("change", function () {
                    let fresh = $dlg.squirrel_dialog("control", "language").val();
                    let stale = TX.language(fresh);
                    if (fresh !== stale)
                        // Re-translate for new language
                        TX.init();
                });
        });

        $('#extras_dlg').on('dlg-open', function () {
            let $dlg = $(this);

            if (!($dlg.squirrel_dialog("squirrel").USE_STEGANOGRAPHY ||
                  $dlg.squirrel_dialog("squirrel").cloud
                  .store &&
                  $dlg.squirrel_dialog("squirrel").cloud
                  .store.option("needs_path"))) {
                $dlg.squirrel_dialog("control", "chss")
                    .hide();
            }

            $dlg.squirrel_dialog("control", "autosave")
                .prop("checked", $dlg.squirrel_dialog("squirrel").autosave());

            $dlg.squirrel_dialog("control", "hidevalues")
                .prop("checked", Tree.hidingValues);

            $dlg.squirrel_dialog("control", "theme")
                .find("option:selected")
                .prop("selected", false);
            $dlg.squirrel_dialog("control", "theme")
                .find("option[value='" + $dlg.squirrel_dialog("squirrel").theme() + "']")
                .prop("selected", true);

            TX.language().then((lingo) => {
                $dlg.squirrel_dialog("control", "language")
                    .val(lingo);
            });

        });

        /* Helper for add, check wrapping node for same key value  */
        function _validateUniqueKey($dlg) {
            // Disable OK if key value exists or is invalid
            let $input = $dlg.squirrel_dialog("control", "key");
            let val = $input.val();
            let enabled = true;

            if (!/\S/.test(val)) // empty?
                enabled = false;
            else {
                let $ul = $dlg.data("parent")
                    .find("ul")
                    .first();
                $ul.children(".tree-node")
                    .each(function () {
                        if ($dlg.squirrel_dialog("squirrel").compare($(this)
                                                                     .data("key"), val) === 0) {
                            enabled = false;
                            return false;
                        }
                    });
            }

            if (enabled) {
                $dlg.squirrel_dialog("control", "ok")
                    .icon_button("enable");
                $input
                    .removeClass("dlg-disabled")
                    .attr("title", TX.tx("Enter new name"));
            } else {
                $dlg.squirrel_dialog("control", "ok")
                    .icon_button("disable");
                $input
                    .addClass("dlg-disabled")
                    .attr("title", TX.tx("Name is already in use"));
            }
        }

        $('#insert_dlg').on('dlg-initialise', function () {
            let $dlg = $(this);

            $dlg.squirrel_dialog("control", "key")
                .on("input", function () {
                    _validateUniqueKey($dlg);
                });
            $dlg.squirrel_dialog("control", "ok")
                .on($.getTapEvent(), function () {
                    $dlg.squirrel_dialog("close");
                    $dlg.squirrel_dialog("squirrel").add_child_node($dlg.data("parent"),
                                                                    $dlg.squirrel_dialog("control", "key")
                                                                    .val(),
                                                                    $dlg.data("data"));
                });
        });

        $('#insert_dlg').on('dlg-open', function (e, options) {
            let $dlg = $(this);
            if (global.DEBUG) console.debug("Pasting");
            let $parent = options.$node;
            $dlg.data("parent", $parent);
            $dlg.data("data", options.data);
            let base = TX.tx("A copy");
            let name = new RegExp("^" + base + " ?(\\d*)$");
            let i = -1;
            $parent.find("ul")
                .first()
                .children(".tree-node")
                .each(function () {
                    let m = name.exec($(this)
                                      .data("key"));
                    if (m)
                        i = Math.max(i, m[1] ? parseInt(m[1]) : 0);
                });
            $dlg.squirrel_dialog("control", "key")
                .val(base + (i >= 0 ? (" " + (i + 1)) : ""));
        });

        $('#add_dlg').on('dlg-initialise', function () {
            let $dlg = $(this);

            function ok_dialog() {
                $dlg.squirrel_dialog("close");
                let $parent = $dlg.data("parent");
                $dlg.squirrel_dialog("squirrel").add_child_node(
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
            let $dlg = $(this);
            let $parent = options.$node;
            let is_value = options.is_value;
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
            let $dlg = $(this);

            $dlg.squirrel_dialog("control", "optimise")
                .on($.getTapEvent(), function () {
                    $dlg.squirrel_dialog("squirrel").client
                        .hoard.clear_actions();
                    $dlg.squirrel_dialog("squirrel").construct_new_cloud(function () {
                        $dlg.squirrel_dialog("close");
                    });
                    // Local actions will now be reflected in the cloud,
                    // so we can clear them
                    return false;
                });
        });

        $('#optimise_dlg').on('dlg-open', function () {
            let $dlg = $(this);

            $dlg.squirrel_dialog("control", "existing")
                .template(
                    "expand",
                    $dlg.squirrel_dialog("squirrel").cloud
                        .hoard.actions.length);
            $dlg.squirrel_dialog("control", "study").hide();
            $dlg.squirrel_dialog("control", "pointless").hide();
            $dlg.squirrel_dialog("control", "optimise")
                .icon_button("disable");
            $dlg.squirrel_dialog("control", "calculating")
                .show()
                .toggle("pulsate", 101);

            let hoard = $dlg.squirrel_dialog("squirrel").client.hoard;
            let counts = {
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
                        $dlg.squirrel_dialog("squirrel").cloud.hoard.actions.length)
                        $dlg.squirrel_dialog("control", "optimise").icon_button("enable");
                    else
                        $dlg.squirrel_dialog("control", "pointless").show();
                });
        });
    });
});
