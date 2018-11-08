/*@preserve Copyright (C) 2015-2017 Crawford Currie http://c-dot.co.uk license MIT*/

/* eslint-env jquery */
/* global Utils */
/* global TX */
/* global global */
/* global Steganographer */
/* global Squirrel */

/**
 * Common code for dialogs. This is enhanced by mixins in the mobile
 * and desktop domains.
 */

(function ($, S) {
    "use strict";

    var widget = {};
    const DEFAULT_RANDOM_LEN = 30;
    const DEFAULT_RANDOM_CHS = "A-Za-z0-9!%^&*_$+-=;:@#~,./?";

    /* Helper for add, check wrapping node for same key value  */
    widget._validateUniqueKey = function () {
        // Disable OK if key value exists or is invalid
        var w = this;
        var $input = w.control("key");
        var val = $input.val();
        var enabled = true;

        if (!/\S/.test(val)) // empty?
            enabled = false;
        else {
            var $ul = w.data("parent")
                .find("ul")
                .first();
            $ul.children(".tree-node")
                .each(function () {
                    if (S.compare($(this)
                            .data("key"), val) == 0) {
                        enabled = false;
                        return false;
                    }
                });
        }

        if (enabled) {
            this.control("ok")
                .iconbutton("enable");
            $input
                .removeClass("dlg-disabled")
                .attr("title", TX.tx("Enter new name"));
        } else {
            this.control("ok")
                .iconbutton("disable");
            $input
                .addClass("dlg-disabled")
                .attr("title", TX.tx("Name is already in use"));
        }
    }

    widget.control = function (name) {
        return this.element.find("[data-id='" + name + "']");
    };

    widget.data = function (name, val) {
        return this.element.data(name, val);
    };

    widget.open = function (options) {
        var $dlg = this.element;
        var id = $dlg.attr("id")
            .replace(/_dlg$/, "");
        var fn;

        if (!$dlg.hasClass("dlg-initialised")) {
            //var title = this.option("title");
            //$dlg.find(".ui-dialog-title").text(title);
            $dlg.addClass("dlg-initialised");
            this.control("cancel")
                .on($.getTapEvent(), function () {
                    $dlg.squirrelDialog("close");
                    return false;
                });
            fn = this["_init_" + id];
            if (typeof fn !== "undefined")
                fn.call(this)
        }

        fn = this["_open_" + id];
        if (typeof fn !== "undefined") {
            var $node = options.$node;
            if ($node)
                $dlg.data("node", $node);
            fn.call(this, options);
        }

        if ($.isTouchCapable() && !this.options.position) {
            this.options.position = {
                my: "left top",
                at: "left top",
                of: $("body")
            };
        }
        this.options.modal = true;
        this.options.width = "auto";
        this.options.closeOnEscape = false;

        return this._super();
    };

    /**
     * options:
     * ok - function called on dialog closed, passing the user and password
     *      and with this set to the options.store
     * user_required - set true if the store requires a username
     * pass_required - set true if the store requires a password
     * store - store we are logging in to
     */
    widget._open_login = function (options) {
        var $dlg = this.element;
        this.control("uReq")
            .toggle(options.user_required);
        this.control("pReq")
            .toggle(options.pass_required);

        var $user = this.control("user");
        var $pass = this.control("pass");
        var skip_pass_change = 0;
        var $signin = this.control("signin");
        var pass_hidden = true,
            hidden_pass = '';

        var sign_in = function () {
            $dlg.squirrelDialog("close");
            $signin.off($.getTapEvent());
            $user.off("change");
            $pass.off("change");
            options.on_signin.call(
                options.store,
                $user.val(),
                pass_hidden ? hidden_pass : $pass.val());
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
            this.control("showpass")
                .on("click", function () {
                    if (pass_hidden) {
                        skip_pass_change++;
                        $pass.val(hidden_pass);
                        pass_hidden = false;
                    } else {
                        hidden_pass = $pass.val();
                        skip_pass_change++;
                        $pass.val(hidden_pass.replace(/./g, "•"));
                        pass_hidden = true;
                    }
                })
                .prop("checked", false);

            // <input type="password"> doesn't work for me on firefox;
            // simulate it
            $pass.on("input", function (e) {
                if (pass_hidden) {
                    var v = $pass.val();
                    if (v.length > hidden_pass.length) {
                        var c = v.substring(v.length - 1);
                        hidden_pass = hidden_pass + c;
                        skip_pass_change++;
                        $pass.val(v.substring(0, v.length - 1) + "•");
                    } else {
                        hidden_pass = hidden_pass.substring(
                            0, hidden_pass.length - 1)
                    }
                }
                return false;
            });

            this.control("foruser")
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
                    if (skip_pass_change > 0) {
                        skip_pass_change--;
                        return false;
                    }
                    if ($pass.data("invisible-pass"))
                        $pass.val($pass.data("invisible-pass"));
                    return sign_in();
                });
            }
        }
    };

    /**
     * Confirm deletion of a node
     */
    widget._init_delete = function () {
        var $dlg = this.element;
        this.control("ok")
            .on($.getTapEvent(), function () {
                $dlg.squirrelDialog("close");
                S.playAction(Hoard.new_action(
                    "D", $dlg.data("node").tree("getPath"), Date.now()));
                return true;
            });
        this.control("cancel")
            .on($.getTapEvent(), function () {
                $dlg.squirrelDialog("close");
                return false;
            });
    };

    widget._open_delete = function (options) {
        var $dlg = this.element;
        this.control("path")
            .text(
                $dlg.data("node").tree("getPath")
                .join("↘"));
        this.control("coll")
            .toggle(!$node.hasClass("tree-leaf"));
    };

    widget._init_pick = function () {
        var $dlg = this.element;
        this.control("clear")
            .on($.getTapEvent(), function () {
                $dlg.find(".dlg-picked")
                    .removeClass("dlg-picked");
            });
    };

    widget._open_pick = function (options) {
        var $dlg = this.element;

        var $node = $dlg.data("node");
        var val = $node.data("value");
        var $which = this.control("which");
        var $from = this.control("from");
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
    };

    /**
     * Password generation for the given leaf node
     */
    function constraints_changed(widgt) {
        var $node = widgt.element.data("node");
        var nc = $node.data("constraints");
        if (typeof nc !== "undefined")
            nc = nc.split(/;/, 2);
        else
            nc = [DEFAULT_RANDOM_LEN, DEFAULT_RANDOM_CHS];
        var dlg_l = widgt.control("len").val();
        var dlg_c = widgt.control("chs").val();

        if (dlg_l != nc[0] || dlg_c != nc[1])
            widgt.control("remember").show();
        else
            widgt.control("remember").hide();

        if (dlg_l !== DEFAULT_RANDOM_LEN || dlg_c !== DEFAULT_RANDOM_CHS)
            widgt.control("reset").show();
        else
            widgt.control("reset").hide();

        widgt.control("again")
            .trigger($.getTapEvent());
    }

    function reset_constraints(widgt) {
        widgt.control("len").val(DEFAULT_RANDOM_LEN);
        widgt.control("chs").val(DEFAULT_RANDOM_CHS);
        constraints_changed(widgt);
    }

    widget._init_randomise = function () {
        var widgt = this;
        var $dlg = widgt.element;

        this.control("again")
            .on($.getTapEvent(), function () {
                widgt.control("idea")
                    .text(Utils.generate_password({
                        length: widgt.control("len")
                            .val(),
                        charset: widgt.control("chs")
                            .val()
                    }));
                return false;
            });
        this.control("use")
            .on($.getTapEvent(), function () {
                $dlg.squirrelDialog("close");
                S.playAction(Hoard.new_action(
                    "E", $dlg.data("node").tree("getPath"), Date.now(),
                    widgt.control("idea").text()));
                return true;
            });
        this.control("len")
            .on("change", function () {
                constraints_changed(widgt);
            });
        this.control("chs")
            .on("change", function () {
                constraints_changed(widgt);
            });
        this.control("remember")
            .on($.getTapEvent(), function () {
                S.playAction(Hoard.new_action(
                    "X", $dlg.data("node").tree("getPath"), Date.now(),
                    widgt.control("len").val() + ";" +
                    widgt.control("chs").val()));
                constraints_changed(widgt);
            });
        this.control("reset")
            .on($.getTapEvent(), function () {
                reset_constraints(widgt);
            });
    };

    widget._open_randomise = function (options) {
        var widgt = this;
        var $dlg = this.element;
        var $node = $dlg.data("node");
        var my_key = $node.data("key");
        var c = $node.data("constraints");

        if (c) {
            c = c.split(";", 2);
            widgt.control("len").val(c[0]);
            widgt.control("chs").val(c[1]);
        }

        var path = $node.tree("getPath");
        this.control("path")
            .text(path.join("↘"));
        this.control("key")
            .text(my_key);
        this.control("again")
            .trigger($.getTapEvent());

        this.control("remember")
            .hide();

        constraints_changed(this);
    };

    widget._init_search = function () {
        var widgt = this;
        var $dlg = this.element;
        this.control("ok")
            .on($.getTapEvent(), function () {
                $dlg.squirrelDialog("close");
                S.search(widgt.control("string")
                    .val());
            });
        this.control("string")
            .on("change", function () {
                widgt.control("ok")
                    .trigger($.getTapEvent());
            });
    };

    /**
     * Reminder setting dialog
     */

    /* Helper */
    widget._updateNext = function () {
        var numb = this.control("number")
            .val();
        // Convert to days
        numb = numb * Utils.TIMEUNITS[this.control("units")
            .val()].days;
        var alarmd = new Date(Date.now() + numb * Utils.MSPERDAY);
        this.control("nextmod")
            .template(
                "expand",
                Utils.deltaTimeString(alarmd),
                alarmd.toLocaleDateString());
    };

    widget._init_alarm = function () {
        var widgt = this;
        var $dlg = this.element;

        widgt.control("units")
            .on("change", function () {
                widgt._updateNext();
            });

        widgt.control("number")
            .on("change", function () {
                widgt._updateNext();
            });

        widgt.control("remind")
            .on($.getTapEvent(), function () {
                $dlg.squirrelDialog("close");
                var numb = widgt.control("number")
                    .val() *
                    Utils.TIMEUNITS[widgt.control("units")
                        .val()].days;
                S.playAction(Hoard.new_action(
                    "A", $dlg.data("node").tree("getPath"), Date.now(),
                    numb));
                return false;
            });

        widgt.control("clear")
            .on($.getTapEvent(), function () {
                $dlg.squirrelDialog("close");
                S.playAction(Hoard.new_action(
                    "C", $dlg.data("node").tree("getPath"), Date.now()));
                return false;
            });
    };

    widget._open_alarm = function (options) {
        var $dlg = this.element;
        var $node = $dlg.data("node");

        this.control("path")
            .text($node.tree("getPath")
                .join("↘"));

        $dlg.data("node", $node);
        var lastmod = $node.data("last-time-changed");
        this.control("lastmod")
            .template(
                "expand",
                new Date(lastmod)
                .toLocaleString());

        if (typeof $node.data("alarm") !== "undefined") {
            var alarm = new Date(
                lastmod + $node.data("alarm") * Utils.MSPERDAY);
            this.control("current")
                .template(
                    "expand",
                    Utils.deltaTimeString(alarm),
                    alarm.toLocaleDateString())
                .show();
            this.control("clear")
                .show();
        } else {
            this.control("current")
                .hide();
            this.control("clear")
                .hide();
        }

        this._updateNext();
    };

    /* Helper */
    widget._change_image = function () {
        var widgt = this;

        var fail = function (e) {
            widgt.control("message")
                .template("pick", "cui")
                .template("expand", e);
        };
        var file = widgt.control("file")[0].files[0];
        Utils.read_file(
            file,
            function (data) {
                data = "data:" + file.type + ";base64," +
                    Utils.ArrayBufferToBase64(data);
                if (data !== widgt.control("steg_image")
                    .attr("src", data)) {
                    widgt.control("steg_image")
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
                            widgt.control("ok")
                                .iconbutton("enable");
                            var h = this.naturalHeight;
                            var w = this.naturalWidth;
                            this.height = 100;
                            widgt.control("message")
                                .template("pick", "xbyy")
                                .template("expand", w, h);
                            if (S.getClient()
                                .status === S.IS_LOADED)
                                S.getClient()
                                .status = S.NEW_SETTINGS;
                            if (S.getCloud()
                                .status === S.IS_LOADED)
                                S.getCloud()
                                .status = S.NEW_SETTINGS;
                            Utils.sometime("update_save");
                        });
                }
            },
            fail,
            "arraybuffer");
    };

    widget._init_store_settings = function () {
        var widgt = this;
        var $dlg = this.element;

        widgt.control("file")
            .hide()
            .on($.getTapEvent(), function () {
                widgt._change_image();
            });

        widgt.control("image")
            .on($.getTapEvent(), function (e) {
                widgt.control("file")
                    .trigger("change", e);
            });

        widgt.control("storepath")
            .on("keyup", function () {
                if (widgt.control("storepath")
                    .val() === "") {
                    widgt.control("message")
                        .template("pick", "mnbe");
                    return false;
                }
                if (S.getClient()
                    .hoard.options.store_path !==
                    widgt.control("storepath")
                    .val()) {
                    S.getClient()
                        .hoard.options.store_path =
                        widgt.control("storepath")
                        .val();
                    if (S.getClient()
                        .status === S.IS_LOADED)
                        S.getClient()
                        .status = S.NEW_SETTINGS;
                    // No - the cloud isn't affected by the store path,
                    // so don't mark it as changed
                    // if (S.getCloud().status === S.IS_LOADED)
                    //     S.getCloud().status = S.NEW_SETTINGS;
                    Utils.sometime("update_save");
                }
                return true;
            })
            .on("change", function () {
                widgt.control("ok")
                    .trigger($.getTapEvent());
            });

        widgt.control("ok")
            .on($.getTapEvent(), function () {
                if (widgt.control("storepath")
                    .val() === "") {
                    widgt.control("message")
                        .template("pick", "mnbe");
                    return false;
                }
                $dlg.squirrelDialog("close");
                var cb = $dlg.data("callback");
                if (typeof cb === "function")
                    cb();
            });
    };

    widget._open_store_settings = function (chain) {
        var $dlg = this.element;
        this.control("message")
            .hide();
        $dlg.data("callback", chain);
        this.control("storepath")
            .focus()
            .val(
                S.getClient()
                .hoard.options.store_path);
    };

    /**
     * Master password change dialog
     */
    widget._init_chpw = function () {
        var widgt = this;
        var $dlg = this.element;

        widgt.control("show")
            .on("change", function () {
                if (widgt.control("show")
                    .prop("checked")) {
                    widgt.control("pass")
                        .attr("type", "text");
                    widgt.control("conf")
                        .attr("type", "text");
                } else {
                    widgt.control("pass")
                        .attr("type", "password");
                    widgt.control("conf")
                        .attr("type", "password");
                }
            });

        $dlg.data("validate", function () {
            var p = widgt.control("pass")
                .val(),
                c = widgt.control("conf")
                .val();

            widgt.control("nomatch")
                .toggle(p !== c);
            return (p === c);
        });

        widgt.control("conf")
            .on("change", function () {
                $dlg.data("validate")
                    .call();
            });

        widgt.control("set")
            .on($.getTapEvent(), function () {
                if (!$dlg.data("validate")
                    .call())
                    return false;
                $dlg.squirrelDialog("close");
                var p = widgt.control("pass")
                    .val();
                S.getClient()
                    .store.pass(p);
                S.getClient()
                    .status = S.NEW_SETTINGS;
                S.getCloud()
                    .store.pass(p);
                S.getCloud()
                    .status = S.NEW_SETTINGS;
                Utils.sometime("update_save");

                return true;
            });
    };

    widget._open_chpw = function () {
        var $dlg = this.element;
        $dlg.data("validate")
            .call();
    };

    widget._init_json = function () {
        var widgt = this;
        var $dlg = this.element;

        widgt.control("text")
            .on("input", function () {
                widgt.control("ok")
                    .iconbutton("enable");
            });

        widgt.control("ok")
            .on($.getTapEvent(), function () {
                $dlg.squirrelDialog("close");
                var datum;
                try {
                    datum = JSON.parse(widgt.control("text")
                        .val());
                } catch (e) {
                    S.squeak({
                        title: TX.tx("JSON could not be parsed"),
                        severity: "error",
                        message: e
                    });
                    return false;
                }
                widgt.control("ok")
                    .iconbutton("disable");
                if (global.DEBUG) console.debug("Importing...");
                S.insert_data([], datum);
                return true;
            });
    };

    widget._open_json = function () {
        var data = S.getClient()
            .hoard.JSON();
        this.control("text")
            .text(data)
            .select();
        this.control("ok")
            .iconbutton("disable");
    };

    widget._init_extras = function () {
        var widgt = this;
        var $dlg = this.element;

        widgt.control("theme")
            .on("change", function () {
                S.theme($(this)
                    .val());
            });

        widgt.control("autosave")
            .on("change", function () {
                S.autosave($(this)
                    .prop("checked"));
            });

        widgt.control("hidevalues")
            .on("change", function () {
                $("#sites-node")
                    .tree("hide_values", $(this)
                        .prop("checked"));
            });

        widgt.control("chpw")
            .on($.getTapEvent(), function () {
                $dlg.squirrelDialog("close");
                $("#chpw_dlg")
                    .squirrelDialog("open");
            });

        widgt.control("chss")
            .on($.getTapEvent(), function () {
                $dlg.squirrelDialog("close");
                $("#store_settings_dlg")
                    .squirrelDialog("open");
            });

        widgt.control("theme")
            .on($.getTapEvent(), function () {
                $dlg.squirrelDialog("close");
                $("#theme_dlg")
                    .squirrelDialog("open");
            });

        widgt.control("json")
            .on($.getTapEvent(), function () {
                $dlg.squirrelDialog("close");
                $("#json_dlg")
                    .squirrelDialog("open");
            });

        widgt.control("optimise")
            .on($.getTapEvent(), function () {
                $dlg.squirrelDialog("close");
                $("#optimise_dlg")
                    .squirrelDialog("open");
            });

        widgt.control("bigger")
            .on("click", function () {
                S.zoom(1.25);
            });

        widgt.control("smaller")
            .on("click", function () {
                S.zoom(0.8);
            });

        widgt.control("about")
            .on($.getTapEvent(), function () {
                $dlg.squirrelDialog("close");
                $("#about_dlg")
                    .squirrelDialog("open");
            });

        widgt.control("change_language")
            .on($.getTapEvent(), function () {
                var fresh = widgt.control("language").val();
                var stale = TX.language(fresh);
                if (fresh !== stale)
                    // Re-translate for new language
                    TX.init();
            });
    };

    widget._open_extras = function () {
        var widgt = this;

        if (!(S.USE_STEGANOGRAPHY ||
                S.getCloud()
                .store &&
                S.getCloud()
                .store.options()
                .needs_path)) {
            widgt.control("chss")
                .hide();
        }

        widgt.control("autosave")
            .prop("checked", S.autosave());

        widgt.control("hidevalues")
            .prop("checked", $("#sites-node")
                .tree("hide_values"));

        widgt.control("theme")
            .find("option:selected")
            .prop("selected", false);
        widgt.control("theme")
            .find("option[value='" + S.theme() + "']")
            .prop("selected", true);

        widgt.control("language")
            .val(TX.language());

    };

    widget._init_insert = function () {
        var widgt = this;
        var $dlg = this.element;

        widgt.control("key")
            .on("input", function () {
                widgt._validateUniqueKey();
            });
        widgt.control("ok")
            .on($.getTapEvent(), function () {
                $dlg.squirrelDialog("close");
                S.add_child_node($dlg.data("parent"),
                    widgt.control("key")
                    .val(),
                    $dlg.data("data"));
            });
    };

    widget._open_insert = function (options) {
        var $dlg = this.element;
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
        this.control("key")
            .val(base + (i >= 0 ? (" " + (i + 1)) : ""));
    };

    widget._init_add = function () {
        var widgt = this;
        var $dlg = this.element;

        widgt.control("key")
            .on("input", function () {
                widgt._validateUniqueKey();
            })
            .autocomplete({
                source: [
                TX.tx("User"), TX.tx("Pass")]
            });

        widgt.control("ok")
            .on($.getTapEvent(), function () {
                $dlg.squirrelDialog("close");
                var $parent = $dlg.data("parent");
                S.add_child_node(
                    $parent, widgt.control("key")
                    .val(),
                    $dlg.data("adding_value") ?
                    widgt.control("value")
                    .val() : undefined);
                return false;
            });
    };

    widget._open_add = function (options) {
        var $dlg = this.element;
        var $parent = options.$node;
        var is_value = options.is_value;
        $dlg.data("parent", $parent);
        $dlg.data("adding_value", is_value);

        this.control("path")
            .text($parent.tree("getPath")
                .join("↘") + "↘");
        if (is_value) {
            this.control("value_help")
                .show();
            this.control("folder_help")
                .hide();
            this.control("value_parts")
                .show();
            this.control("key")
                .autocomplete("enable")
                .select();
            this.control("value")
                .val("");
        } else {
            this.control("value_help")
                .hide();
            this.control("folder_help")
                .show();
            this.control("value_parts")
                .hide();
            this.control("key")
                .autocomplete("disable")
                .select();
        }

        this._validateUniqueKey();
    };

    widget._init_optimise = function () {
        var widgt = this;
        var $dlg = this.element;

        widgt.control("optimise")
            .on($.getTapEvent(), function () {
                S.getClient()
                    .hoard.clear_actions();
                S.construct_new_cloud(function () {
                    $dlg.squirrelDialog("close");
                });
                // Local actions will now be reflected in the cloud,
                // so we can clear them
                return false;
            });
    };

    widget._open_optimise = function () {
        var widgt = this;

        widgt.control("existing")
            .template(
                "expand",
                S.getCloud()
                .hoard.actions.length);
        widgt.control("study")
            .hide()
        widgt.control("optimise")
            .iconbutton("disable");

        var hoard = S.getClient()
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
                widgt.control("study")
                    .show()
                    .template(
                        "expand",
                        counts.N, counts.A, counts.X,
                        counts.N + counts.A + counts.X);

                widgt.control("optimise")
                    .iconbutton("enable");
            });
    };

    /**
     * Generate a modal alert dialog
     * @param p either a string message, or a structure containing:
     *  title - dialog title
     *  message - (string or $object or elem)
     *  severity - may be one of notice (default), warning, error
     *  after_close - callback on dialog closed
     */
    widget._init_squeak = function () {
        var $dlg = this.element;
        this.control("close")
            .on($.getTapEvent(), function () {
                var ac = $dlg.data("after_close");
                $dlg.removeData("after_close");
                $dlg.squirrelDialog("close");
                if (typeof ac === "function")
                    ac();
                return false;
            });
    };

    widget._open_squeak = function (p) {
        if (typeof p === "string")
            p = {
                message: p,
                severity: "notice"
            };

        $dlg.data("after_close", p.after_close);

        this.element.find(".messages")
            .empty();
        this.squeakAdd(p);

        var options = {
            close: function () {
                if (typeof p.after_close === "function")
                    p.after_close();
            }
        };
        if (p.title)
            options.title = p.title;
    };

    widget.squeakAdd = function (p) {
        var $dlg = this.element;

        $dlg.find(".dlg-while")
            .remove();
        if (typeof p === "string")
            p = {
                message: p,
                severity: "notice"
            };

        if (!p.severity)
            p.severity = "notice";

        $dlg.find(".messages")
            .append(
                $("<div class='dlg-" + p.severity + "'></div>")
                .append(p.message));
    };

    $.widget("squirrel.squirrelDialog", $.ui.dialog, widget);

})(jQuery, Squirrel);
