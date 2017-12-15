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

    /* Helper for add, check wrapping node for same key value  */
    widget._validateUniqueKey = function () {
        // Disable OK if key value exists or is invalid
        var $input = this.get("key");
        var val = $input.val();
        var enabled = true;

        if (!/\S/.test(val)) // empty?
            enabled = false;
        else {
            var $ul = this.element.data("parent")
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
            this.get("ok")
                .button("enable");
            $input
                .removeClass("dlg-disabled")
                .attr("title", TX.tx("Enter new name"));
        } else {
            this.get("ok")
                .button("disable");
            $input
                .addClass("dlg-disabled")
                .attr("title", TX.tx("Name is already in use"));
        }
    }

    widget.get = function (name) {
        return this.element.find("[data-id='" + name + "']");
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
            this.get("cancel")
                .on($.getTapEvent(), function () {
                    $dlg.squirrelDialog("close");
                    return false;
                });
            fn = this["_init_" + id];
            if (typeof fn !== "undefined")
                fn.call(this, $dlg)
        }

        fn = this["_open_" + id];
        if (typeof fn !== "undefined")
            fn.call(this, $dlg, options);

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
    widget._open_login = function ($dlg, options) {
        this.get("uReq")
            .toggle(options.user_required);
        this.get("pReq")
            .toggle(options.pass_required);

        var $user = this.get("user");
        var $pass = this.get("pass");
        var $signin = this.get("signin");

        var sign_in = function () {
            $dlg.squirrelDialog("close");
            $signin.off($.getTapEvent());
            $user.off("change");
            $pass.off("change");
            options.on_signin.call(options.store,
                $user.val(),
                $pass.val());
            return true;
        };

        $signin
            .off($.getTapEvent())
            .on($.getTapEvent(), "p", sign_in);

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
            this.get("foruser")
                .toggle(options.store.user() !== null)
                .text(options.store.user() || "");
            $pass.attr("autofocus", "autofocus");
            if (options.user_required) {
                $pass.on("change", function () {
                    $signin.focus();
                });
            } else {
                $pass.focus();
                $pass.on("change", sign_in);
            }
        }
    };

    /**
     * Confirm deletion of a node
     */
    widget._init_delete = function ($dlg) {
        this.get("ok")
            .on($.getTapEvent(), function () {
                $dlg.squirrelDialog("close");
                S.playAction({
                    type: "D",
                    path: $dlg.data("node")
                        .tree("getPath")
                });
                return true;
            });
        this.get("cancel")
            .on($.getTapEvent(), function () {
                $dlg.squirrelDialog("close");
                return false;
            });
    };

    widget._open_delete = function ($dlg, options) {
        var $node = options.$node;
        $dlg.data("node", $node);
        this.get("path")
            .text(
                $node.tree("getPath")
                .join("↘"));
        this.get("coll")
            .toggle(!$node.hasClass("tree-leaf"));
    };

    widget._init_pick = function ($dlg) {
        this.get("clear")
            .on($.getTapEvent(), function () {
                $dlg.find(".dlg-picked")
                    .removeClass("dlg-picked");
            });
    };

    widget._open_pick = function ($dlg, options) {
        var $node = options.$node;

        var val = $node.data("value");
        var $which = this.get("which");
        var $from = this.get("from");
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
    widget._init_randomise = function ($dlg) {
        var self = this;
        this.get("again")
            .on($.getTapEvent(), function () {
                self.get("idea")
                    .text(Utils.generate_password({
                        length: self.get("len")
                            .val(),
                        charset: self.get("chs")
                            .val()
                    }));
                return false;
            });
        this.get("use")
            .on($.getTapEvent(), function () {
                $dlg.squirrelDialog("close");
                S.playAction({
                    type: "E",
                    path: $dlg.data("node")
                        .tree("getPath"),
                    data: self.get("idea")
                        .text()
                });
                return true;
            });
        this.get("len")
            .on("input", function () {
                self.get("remember")
                    .show();
            });
        this.get("chs")
            .on("input", function () {
                self.get("remember")
                    .show();
            });
        this.get("remember")
            .on($.getTapEvent(), function () {
                var constraints = self.get("len")
                    .val() +
                    ';' + self.get("chs")
                    .val();
                S.playAction({
                    type: "X",
                    path: $dlg.data("node")
                        .tree("getPath"),
                    data: constraints
                });
                $(this)
                    .hide();
            });
    };

    widget._open_randomise = function ($dlg, options) {
        var self = this;
        var $node = options.$node;
        var my_key = $node.data("key");
        $dlg.data("node", $node);

        var c = $node.data("constraints");
        if (c) {
            c = c.split(";", 2);
            self.get("len")
                .val(c[0]);
            self.get("chs")
                .val(c[1]);
        }

        var path = $node.tree("getPath");
        this.get("path")
            .text(path.join("↘"));
        this.get("key")
            .text(my_key);
        this.get("again")
            .trigger($.getTapEvent());
        this.get("remember")
            .hide();
    };

    widget._init_search = function ($dlg) {
        var self = this;
        this.get("ok")
            .on($.getTapEvent(), function () {
                $dlg.squirrelDialog("close");
                S.search(self.get("string")
                    .val());
            });
        this.get("string")
            .on("change", function () {
                self.get("ok")
                    .trigger($.getTapEvent());
            });
    };

    /**
     * Reminder setting dialog
     */

    /* Helper */
    widget._updateNext = function () {
        var numb = this.get("number")
            .val();
        // Convert to days
        numb = numb * Utils.TIMEUNITS[this.get("units")
            .val()].days;
        var alarmd = new Date(Date.now() + numb * Utils.MSPERDAY);
        this.get("nextmod")
            .template(
                "expand",
                Utils.deltaTimeString(alarmd),
                alarmd.toLocaleDateString());
    };

    widget._init_alarm = function ($dlg) {
        var self = this;

        self.get("units")
            .on("change", function () {
                self._updateNext();
            });

        self.get("number")
            .on("change", function () {
                self._updateNext();
            });

        self.get("remind")
            .on($.getTapEvent(), function () {
                $dlg.squirrelDialog("close");
                var numb = self.get("number")
                    .val() *
                    Utils.TIMEUNITS[self.get("units")
                        .val()].days;
                S.playAction({
                    type: "A",
                    path: $dlg.data("node")
                        .tree("getPath"),
                    data: numb
                });
                return false;
            });

        self.get("clear")
            .on($.getTapEvent(), function () {
                $dlg.squirrelDialog("close");
                S.playAction({
                    type: "C",
                    path: $dlg.data("node")
                        .tree("getPath")
                });
                return false;
            });
    };

    widget._open_alarm = function ($dlg, options) {
        var $node = options.$node;

        this.get("path")
            .text($node.tree("getPath")
                .join("↘"));

        $dlg.data("node", $node);
        var lastmod = $node.data("last-time-changed");
        this.get("lastmod")
            .template(
                "expand",
                new Date(lastmod)
                .toLocaleString());

        if (typeof $node.data("alarm") !== "undefined") {
            var alarm = new Date(
                lastmod + $node.data("alarm") * Utils.MSPERDAY);
            this.get("current")
                .template(
                    "expand",
                    Utils.deltaTimeString(alarm),
                    alarm.toLocaleDateString())
                .show();
            this.get("clear")
                .show();
        } else {
            this.get("current")
                .hide();
            this.get("clear")
                .hide();
        }

        this._updateNext();
    };

    /* Helper */
    widget._change_image = function () {
        var self = this;

        var fail = function (e) {
            self.get("message")
                .template("pick", "cui")
                .template("expand", e);
        };
        var file = self.get("file")[0].files[0];
        Utils.read_file(
            file,
            function (data) {
                data = "data:" + file.type + ";base64," +
                    Utils.ArrayBufferToBase64(data);
                if (data !== self.get("steg_image")
                    .attr("src", data)) {
                    self.get("steg_image")
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
                            self.get("ok")
                                .button("enable");
                            var h = this.naturalHeight;
                            var w = this.naturalWidth;
                            this.height = 100;
                            self.get("message")
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

    widget._init_store_settings = function ($dlg) {
        var self = this;
        self.get("file")
            .hide()
            .on($.getTapEvent(), function () {
                self._change_image();
            });

        self.get("image")
            .on($.getTapEvent(), function (e) {
                self.get("file")
                    .trigger("change", e);
            });

        self.get("storepath")
            .on("keyup", function () {
                if (self.get("storepath")
                    .val() === "") {
                    self.get("message")
                        .template("pick", "mnbe");
                    return false;
                }
                if (S.getClient()
                    .hoard.options.store_path !==
                    self.get("storepath")
                    .val()) {
                    S.getClient()
                        .hoard.options.store_path =
                        self.get("storepath")
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
            .on("change", function() {
                self.get("ok").trigger($.getTapEvent());
            });

        self.get("ok")
            .on($.getTapEvent(), function () {
                if (self.get("storepath")
                    .val() === "") {
                    self.get("message")
                        .template("pick", "mnbe");
                    return false;
                }
                $dlg.squirrelDialog("close");
                var cb = $dlg.data("callback");
                if (typeof cb === "function")
                    cb();
            });
    };

    widget._open_store_settings = function ($dlg, chain) {
        this.get("message")
            .hide();
        $dlg.data("callback", chain);
        this.get("storepath")
            .focus()
            .val(
                S.getClient()
                .hoard.options.store_path);
    };

    /**
     * Master password change dialog
     */
    widget._init_chpw = function ($dlg) {
        var self = this;

        self.get("show")
            .on("change", function () {
                if (self.get("show")
                    .prop("checked")) {
                    self.get("pass")
                        .attr("type", "text");
                    self.get("conf")
                        .attr("type", "text");
                } else {
                    self.get("pass")
                        .attr("type", "password");
                    self.get("conf")
                        .attr("type", "password");
                }
            });

        $dlg.data("validate", function () {
            var p = self.get("pass")
                .val(),
                c = self.get("conf")
                .val();

            self.get("nomatch")
                .toggle(p !== c);
            return (p === c);
        });

        self.get("conf")
            .on("change", function () {
                $dlg.data("validate")
                    .call();
            });

        self.get("set")
            .on($.getTapEvent(), function () {
                if (!$dlg.data("validate")
                    .call())
                    return false;
                $dlg.squirrelDialog("close");
                var p = self.get("pass")
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

    widget._open_chpw = function ($dlg) {
        $dlg.data("validate")
            .call();
    };

    widget._init_json = function ($dlg) {
        var self = this;

        self.get("text")
            .on("input", function () {
                self.get("ok")
                    .button("enable");
            });

        self.get("ok")
            .on($.getTapEvent(), function () {
                $dlg.squirrelDialog("close");
                var datum;
                try {
                    datum = JSON.parse(self.get("text")
                        .val());
                } catch (e) {
                    S.squeak({
                        title: TX.tx("JSON could not be parsed"),
                        severity: "error",
                        message: e
                    });
                    return false;
                }
                self.get("ok")
                    .button("disable");
                if (global.DEBUG) console.debug("Importing...");
                S.insert_data([], datum);
                return true;
            });
    };

    widget._open_json = function () {
        var data = S.getClient()
            .hoard.JSON();
        this.get("text")
            .text(data)
            .select();
        this.get("ok")
            .button("disable");
    };

    widget._init_extras = function ($dlg) {
        var self = this;

        self.get("theme")
            .on("change", function () {
                S.theme($(this)
                    .val());
            });

        self.get("autosave")
            .on("change", function () {
                S.autosave($(this)
                    .prop("checked"));
            });

        self.get("hidevalues")
            .on("change", function () {
                S.hideValues($(this)
                    .prop("checked"));
            });

        self.get("chpw")
            .on($.getTapEvent(), function () {
                $dlg.squirrelDialog("close");
                $("#chpw_dlg")
                    .squirrelDialog("open");
            });

        self.get("chss")
            .on($.getTapEvent(), function () {
                $dlg.squirrelDialog("close");
                $("#store_settings_dlg")
                    .squirrelDialog("open");
            });

        self.get("theme")
            .on($.getTapEvent(), function () {
                $dlg.squirrelDialog("close");
                $("#theme_dlg")
                    .squirrelDialog("open");
            });

        self.get("json")
            .on($.getTapEvent(), function () {
                $dlg.squirrelDialog("close");
                $("#json_dlg")
                    .squirrelDialog("open");
            });

        self.get("optimise")
            .on($.getTapEvent(), function () {
                $dlg.squirrelDialog("close");
                $("#optimise_dlg")
                    .squirrelDialog("open");
            });

        self.get("bigger")
            .on("click", function () {
                S.zoom(1.25);
            });

        self.get("smaller")
            .on("click", function () {
                S.zoom(0.8);
            });

        self.get("about")
            .on($.getTapEvent(), function () {
                $dlg.squirrelDialog("close");
                $("#about_dlg")
                    .squirrelDialog("open");
            });
    };

    widget._open_extras = function () {
        var self = this;

        if (!(S.USE_STEGANOGRAPHY ||
                S.getCloud()
                .store &&
                S.getCloud()
                .store.options()
                .needs_path)) {
            self.get("chss")
                .hide();
        }

        self.get("autosave")
            .prop("checked", S.autosave());

        self.get("hidevalues")
            .prop("checked", S.hideValues());

        self.get("theme")
            .find("option:selected")
            .prop("selected", false);
        self.get("theme")
            .find("option[value='" + S.theme() + "']")
            .prop("selected", true);
    };

    widget._init_insert = function ($dlg) {
        var self = this;

        self.get("key")
            .on("input", function () {
                self._validateUniqueKey();
            });
        self.get("ok")
            .on($.getTapEvent(), function () {
                $dlg.squirrelDialog("close");
                S.add_child_node($dlg.data("parent"),
                    self.get("key")
                    .val(),
                    $dlg.data("data"));
            });
    };

    widget._open_insert = function ($dlg, options) {
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
        this.get("key")
            .val(base + (i >= 0 ? (" " + (i + 1)) : ""));
    };

    widget._init_add = function ($dlg) {
        var self = this;

        self.get("key")
            .on("input", function () {
                self._validateUniqueKey();
            })
            .autocomplete({
                source: [
                TX.tx("User"), TX.tx("Pass")]
            });

        self.get("ok")
            .on($.getTapEvent(), function () {
                $dlg.squirrelDialog("close");
                var $parent = $dlg.data("parent");
                S.add_child_node(
                    $parent, self.get("key")
                    .val(),
                    $dlg.data("adding_value") ?
                    self.get("value")
                    .val() : undefined);
                return false;
            });
    };

    widget._open_add = function ($dlg, options) {
        var $parent = options.$node;
        var is_value = options.is_value;
        $dlg.data("parent", $parent);
        $dlg.data("adding_value", is_value);

        this.get("path")
            .text($parent.tree("getPath")
                .join("↘") + "↘");
        if (is_value) {
            this.get("value_help")
                .show();
            this.get("folder_help")
                .hide();
            this.get("value_parts")
                .show();
            this.get("key")
                .autocomplete("enable");
        } else {
            this.get("value_help")
                .hide();
            this.get("folder_help")
                .show();
            this.get("value_parts")
                .hide();
            this.get("key")
                .autocomplete("disable");
        }

        this._validateUniqueKey();
    };

    widget._init_optimise = function ($dlg) {
        var self = this;

        self.get("optimise")
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
        var self = this;

        self.get("existing")
            .template(
                "expand",
                S.getCloud()
                .hoard.actions.length);
        self.get("study")
            .hide()
        self.get("optimise")
            .button("disable");

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
                self.get("study")
                    .show()
                    .template(
                        "expand",
                        counts.N, counts.A, counts.X,
                        counts.N + counts.A + counts.X);

                self.get("optimise")
                    .button("enable");
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
    widget._init_squeak = function ($dlg) {
        this.get("close")
            .on($.getTapEvent(), function () {
                var ac = $dlg.data("after_close");
                $dlg.removeData("after_close");
                $dlg.squirrelDialog("close");
                if (typeof ac === "function")
                    ac();
                return false;
            });
    };

    widget._open_squeak = function ($dlg, p) {
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
