/*@preserve Copyright (C) 2015-2017 Crawford Currie http://c-dot.co.uk license MIT*/

/* eslint-env jquery */
/* global Utils */
/* global TX */
/* global DEBUG:true */
/* global Steganographer */
/* global Squirrel */

/**
 * Common code for dialogs. This is enhanced by mixins in the mobile
 * and desktop domains.
*/

(function($, S) {
    "use strict";
    var SD = S.Dialog;
    var ST = S.Tree;

    // The code below requires the environment to define the following
    // extra methods in the namespace:
    //
    // SD.squeak(p) where p is a string or a structure:
    //    title
    //    severity (error, warning, notice, while)
    //    message (string or $object or element)
    //    after_close
    // SD.init_open($dlg)
    // SD.open_open($dlg)

    var widget = {};
    
    function play_action(action, more) {
        var res = S.client.hoard.record_action(
            action,
            function(e) {
                ST.action(
                    e,
                    true,
                    function($node) {
                        if (more)
                            more($node);
                        Utils.sometime("update_save");
                    });
            });
        if (res !== null)
            SD.squeak({
                title: TX.error(),
                severity: "error",
                message: res.message
            });
    }

    /* Helper for add, check wrapping node for same key value  */
    widget._validateUniqueKey = function() {
        // Disable OK if key value exists or is invalid
        var $input = this.get("key");
        var val = $input.val();
        var enabled = true;

        if (!/\S/.test(val)) // empty?
            enabled = false;
        else {
            var $ul =  this.element.data("parent").find("ul:first");
            $ul.children(".tree-node").each(function() {
                if (ST.compare($(this).data("key"), val) == 0) {
                    enabled = false;
                    return false;
                }
            });
        }
            
        if (enabled) {
            this.get("ok").button("enable");
            $input
                .removeClass("dlg-disabled")
                .attr("title", TX.tx("Enter new name"));
        } else {
            this.get("ok").button("disable");
            $input
                .addClass("dlg-disabled")
                .attr("title", TX.tx("Name is already in use"));
        }
    }
    
    widget.get = function(name) {
        return this.element.find("[data-id='" + name + "']");
    };

    widget.open = function(options) {
        var $dlg = this.element;
        var id = $dlg.attr("id");
        var fn;

        if (!$dlg.hasClass("dlg-initialised")) {
            $dlg.addClass("dlg-initialised");
            this.get("cancel")
                .button()
                .on($.getTapEvent(), function() {
                    $dlg.dialog("close");
                    return false;
                });
            fn = this["_init_" + id];
            if (typeof fn !== "undefined")
                fn.call(this, $dlg)
        }
        
        fn = this["_open_" + id];
        if (typeof fn !== "undefined")
            fn.call(this, $dlg, options);

        if (!options)
            options = {};
        
        $.extend(options, {
            modal: true,
            width: "auto",
            closeOnEscape: false
        });
        
        if ($.isTouchCapable()) {
            $.extend(options, {
                my: "left top",
                at: "left top",
                of: $("body")
            });
        }
        
        $dlg.dialog(options);
    };
    
    /**
     * options:
     * ok - function called on dialog closed, passing the user and password
     *      and with this set to the options.store
     * user_required - set true if the store requires a username
     * pass_required - set true if the store requires a password
     * store - store we are logging in to
     */
    widget._open_login = function($dlg, options) {
        this.get("uReq").toggle(options.user_required);
        this.get("pReq").toggle(options.pass_required);

        var $user = this.get("user");
        var $pass = this.get("pass");
        var $signin = this.get("signin");

        var sign_in = function() {
            $dlg.dialog("close");
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

        $user.off("change").val(options.store.user());
        $pass.off("change").val(options.store.pass());

        if (options.user_required) {
            $user.attr("autofocus", "autofocus");
            if (options.pass_required) {
                $user
                    .off("change")
                    .on("change", function() {
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
                $pass.on("change", function() {
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
    widget._init_delete = function($dlg) {
        this.get("ok").on($.getTapEvent(), function() {
            $dlg.dialog("close");
            var res = S.client.hoard.record_action(
                {
                    type: "D",
                    path: $dlg.data("node").tree("getPath")
                },
                function(e) {
                    ST.action(
                        e, true,
                        function() {
                            Utils.sometime("update_save");
                        });
                });
            if (res !== null) {
                SD.squeak({
                    title: TX.error(),
                    severity: "error",
                    message: res.message
                });
                return false;
            }
            return true;
        });
        this.get("cancel").on($.getTapEvent(), function() {
            $dlg.dialog("close");
            return false;
        });
    };

    widget._open_delete = function($dlg, options) {
        var $node = options.$node;
        $dlg.data("node", $node);
        this.get("path").text(
            $node.tree("getPath").join("/"));
        this.get("coll").toggle(!$node.hasClass("tree-leaf"));
    };

    widget._init_pick = function($dlg) {
        $dlg.find(".clear")
            .on($.getTapEvent(), function() {
                $dlg.find(".dlg-picked").removeClass("dlg-picked");
            });
    };

    widget._open_pick = function($dlg, options) {
        var $node = options.$node;
        
        var val = $node.find(".tree-value:first").text();
        var $which = this.get("which");
        var $from = this.get("from");
        var i, $f;

        $dlg.find(".dlg-pick-cell").remove();

        var item_clicked = function() {
            var ii = $(this).data("i");
            $dlg
                .find("td.i" + ii)
                .addClass("dlg-picked");
        };

        for (i = 0; i < val.length; i++) {
            $f = $from.children("td.i" + i);
            if ($f.length === 0) {
                $("<td></td>")
                    .data("i", i)
                    .addClass("dlg-pick-cell i" + i)
                    .text(i + 1)
                    .on($.getTapEvent(), item_clicked)
                    .appendTo($which);
                $f = $("<td></td>")
                    .data("i", i)
                    .addClass("dlg-pick-cell i" + i)
                    .on($.getTapEvent(), item_clicked)
                    .appendTo($from);
            }
            $f.text(val.charAt(i));
        }

        while (i < $from.children("td").length) {
            $from.children("td").last().remove();
            i++;
        }

        $dlg.find(".dlg-picked").removeClass("dlg-picked");
    };

    /**
     * Password generation for the given leaf node
     */
    widget._init_randomise = function($dlg) {
        var self = this;
        this.get("again").on($.getTapEvent(), function() {
            self.get("idea").text(Utils.generate_password(
                {
                    length: self.get("len").val(),
                    charset: self.get("chs").val()
                }));
            return false;
        });
        this.get("use").on($.getTapEvent(), function() {
            $dlg.dialog("close");
            play_action(
                { 
                    type: "E",
                    path: $dlg.data("node").tree("getPath"),
                    data: self.get("idea").text()
                });
            return true;
        });
        this.get("remember").on($.getTapEvent(), function() {
            var constraints = self.get("len").val() +
                TX.tx(" characters from ") +
                '[' + self.get("chs").val() + ']';
            var $ibling = $dlg.data("constraints");
            if ($ibling) {
                if (constraints != $ibling.data("value")) {
                    play_action(
                        { 
                            type: "E",
                            path: $ibling.tree("getPath"),
                            data: constraints
                        }, function() {
                            $ibling.data("value", constraints);
                        });
                }
            } else {
                var $node = $dlg.data("node");
                var p = $node.tree("getPath");
                var k = TX.tx("$1 constraints", p.pop());
                p.push(k); 
                play_action(
                    { 
                        type: "N",
                        path: p,
                        data: constraints
                    }, function($new) {
                        $dlg.data("constraints", $new);
                    });
            }
        });
    };

    widget._open_randomise = function($dlg, options) {
        var self = this;
        var $node = options.$node;
        var my_key = $node.data("key");
        $dlg.data("node", $node);

        var constraints_key = TX.tx("$1 constraints", $node.data("key"));
        var vre = new RegExp(
            "(\\d+)" +
                TX.tx(" characters from ")
                .replace(/[-\/\\^$*+?.()|\[\]\{\}]/g, "\\$&")
                + "\\[(.*)\\]");
        $dlg.removeData("constraints");
        $node.parent().children(".tree-leaf").each(function() {
            var $ibling = $(this);
            var k = $ibling.data("key");
            if (k == constraints_key) {
                var v = $ibling.data("value");
                var m = vre.exec(v);
                if (m) {
                    $dlg.data("constraints", $ibling);
                    self.get("len").val(m[1]);
                    self.get("chs").val(m[2]);
                }
            }
        });

        var path = $node.tree("getPath");
        this.get("path").text(path.join("/"));
        this.get("key").text(my_key);
        this.get("again").trigger("click");
    };

    widget._init_search = function($dlg) {
        var self = this;
        this.get("ok")
            .on($.getTapEvent(), function() {
                $dlg.dialog("close");
                S.search(self.get("string").val());
            });
        this.get("string")
            .on("change", function() {
                self.get("ok").trigger($.getTapEvent());
            });
    };

    /**
     * Reminder setting dialog
     */

    /* Helper */
    widget._updateNext = function() {
        var numb = this.get("number").val();
        // Convert to days
        numb = numb * Utils.TIMEUNITS[this.get("units").val()].days;
        var alarmd = new Date(Date.now() + numb * Utils.MSPERDAY);
        this.get('when').text(alarmd.toLocaleDateString());
        this.get("next")
            .text(Utils.deltaTimeString(alarmd))
            .show();
    };
    
    widget._init_alarm = function($dlg) {
        var self = this;

        self.get("units")
            .on("change", function() {
                self._updateNext();
            });

        self.get("number")
            .on("change", function() {
                self._updateNext().call();
            });

        self.get("set")
            .on($.getTapEvent(), function() {
                $dlg.dialog("close");
                var numb = self.get("number").val()
                    * Utils.TIMEUNITS[self.get("units").val()].days;
                play_action(
                    { type: "A",
                      path: $dlg.data("node").tree("getPath"),
                      data: numb
                    });
                return false;
            });

        self.get("clear")
            .on($.getTapEvent(), function() {
                play_action(
                    { type: "C",
                      path: $dlg.data("node").tree("getPath")
                    });
                $dlg.dialog("close");
                return false;
            });

    };
    
    widget._open_alarm = function($dlg, options) {
        var $node = options.$node;
        this.get("path").text($node.tree("getPath").join("/"));
        $dlg.data("node", $node);
        this._updateNext();
    };

    /* Helper */
    widget._change_image = function() {
        var self = this;
        
        var fail = function(e) {
            self.get("message").text(TX.tx(
                "Cannot use this image because of this error: $1", e));
        };
        var file = self.get("file")[0].files[0];
        Utils.read_file(
            file,
            function(data) {
                data = "data:" + file.type + ";base64,"
                    + Utils.ArrayBufferToBase64(data);
                if (data !== self.get("steg_image").attr("src", data)) {
                    self.get("steg_image")
                        .attr("src", data)
                        .off("load")
                        .on("load", function() {
                            $(this).off("load");
                            // Check that we can use the image.
                            var steg = new Steganographer(this);
                            try {
                                steg.inject("tada");
                            } catch (e) {
                                if (DEBUG) console.debug("Caught " + e);
                                fail(e);
                                return;
                            }
                            self.get("ok").attr("disabled", false);
                            var h = this.naturalHeight;
                            var w = this.naturalWidth;
                            this.height = 100;
                            self.get("message")
                                .html("<br>" + w + " x " + h);
                            if (S.client.status === S.IS_LOADED)
                                S.client.status = S.NEW_SETTINGS;
                            if (S.cloud.status === S.IS_LOADED)
                                S.cloud.status = S.NEW_SETTINGS;
                            Utils.sometime("update_save");
                        });
                }
            },
            fail,
            "arraybuffer");
    };

    widget._init_store_settings = function($dlg) {
        var self = this;
        self.get("file")
            .hide()
            .on($.getTapEvent(), function () {
                self._change_image();
            });

        self.get("image")
            .on($.getTapEvent(), function(e) {
                self.get("file").trigger("change", e);
            });

        self.get("storepath").on("keyup", function() {
            if (self.get("storepath").val() === "") {
                self.get("message").text(TX.tx(
                    "Store path may not be empty"));
                return false;
            }
            if (S.client.hoard.options.store_path !==
                self.get("storepath").val()) {
                S.client.hoard.options.store_path =
                    self.get("storepath").val();
                if (S.client.status === S.IS_LOADED)
                    S.client.status = S.NEW_SETTINGS;
                // No - the cloud isn't affected by the store path,
                // so don't mark it as changed
                // if (S.cloud.status === S.IS_LOADED)
                //     S.cloud.status = S.NEW_SETTINGS;
                Utils.sometime("update_save");
            }
            return true;
        });

        self.get("ok")
            .on($.getTapEvent(), function () {
                if (self.get("storepath").val() === "") {
                    self.get("message").text(TX.tx(
                        "Store path may not be empty"));
                    return false;
                }
                $dlg.dialog("close");
                var cb = $dlg.data("callback");
                if (typeof cb === "function")
                    cb();
            });
    };

    widget._open_store_settings = function($dlg, chain) {
        this.get("message").empty();
        $dlg.data("callback", chain);
        this.get("storepath").val(
            S.client.hoard.options.store_path);
    };

    /**
     * Master password change dialog
     */
    widget._init_chpw = function($dlg) {
        var self = this;
        
        self.get("show")
            .on("change", function() {
                if (self.get("show").prop("checked")) {
                    self.get("pass").attr("type", "text");
                    self.get("conf").attr("type", "text");
                } else {
                    self.get("pass").attr("type", "password");
                    self.get("conf").attr("type", "password");
                }
            });

        $dlg.data("validate", function() {
            var p = self.get("pass").val(),
                c = self.get("conf").val();

            self.get("nomatch").toggle(p !== c);
            return (p === c);
        });

        self.get("conf").on("change", function() {
            $dlg.data("validate").call();
        });

        self.get("set")
            .on($.getTapEvent(), function () {
                if (!$dlg.data("validate").call())
                    return false;
                $dlg.dialog("close");
                var p = self.get("pass").val();
                S.client.store.pass(p);
                S.client.status = S.NEW_SETTINGS;
                S.cloud.store.pass(p);
                S.cloud.status = S.NEW_SETTINGS;
                Utils.sometime("update_save");

                return true;
            });
    };

    widget._open_chpw = function($dlg) {
        $dlg.data("validate").call();
    };
    
    widget._init_json = function($dlg) {
        var self = this;
        
        self.get("text")
            .on("input", function () {
                self.get("ok").prop("disabled", false);
            });

        self.get("ok")
            .on($.getTapEvent(), function () {
                $dlg.dialog("close");
                var datum;
                try {
                    datum = JSON.parse(self.get("text").val());
                } catch (e) {
                    SD.squeak({
                        title: TX.tx("JSON could not be parsed"),
                        severity: "error",
                        message: e
                    });
                    return false;
                }
                self.get("ok").prop("disabled", true);
                if (DEBUG) console.debug("Importing...");
                S.insert_data([], datum);
                return true;
            });
    };

    widget._open_json = function() {
        var data = S.client.hoard.JSON();
        this.get("text")
            .text(data)
            .select();
        this.get("ok").prop("disabled", true);
    };

    widget._init_theme = function() {
        var self = this;
        self.get("select")
            .on("change", function () {
                S.setTheme($(this).val());
            });
    };

    widget._init_extras = function($dlg) {
        var self = this;
        self.get("autosave")
            .on("change", function() {
                S.client.hoard.options.autosave =
                    (self.get("autosave").val() === "on");
                Utils.sometime("update_save");
            });

        self.get("chpw").on($.getTapEvent(), function() {
            $dlg.dialog("close");
            $("#chpw").squirrelDialog("open");
        });

        self.get("chss").on($.getTapEvent(), function() {
            $dlg.dialog("close");
            $("#store_settings").squirrelDialog("open");
        });
        self.get("theme").on($.getTapEvent(), function() {
            $dlg.dialog("close");
            $("#theme").squirrelDialog("open");
        });

        self.get("json").on($.getTapEvent(), function() {
            $dlg.dialog("close");
            $("#json").squirrelDialog("open");
        });

        self.get("about").on($.getTapEvent(), function() {
            $dlg.dialog("close");
            $("#about").squirrelDialog("open");
        });
    };

    widget._open_extras = function() {
        var self = this;
        
        if (!(S.USE_STEGANOGRAPHY
              || S.cloud.store
              && S.cloud.store.options().needs_path)) {
            self.get("chss").hide();
        }

        self.get("autosave").val(
            S.client.hoard.options.autosave ? "on" : "off");
    };

    widget._init_insert = function($dlg) {
        var self = this;
        
        self.get("key")
            .on("input", function() { self._validateUniqueKey(); });
        self.get("ok")
            .button()
            .on($.getTapEvent(), function() {
                $dlg.dialog("close");
                S.add_child_node($dlg.data("parent"),
                                 self.get("key").val(),
                                 $dlg.data("data"));
            });
    };

    widget._open_insert = function($dlg, options) {
        if (DEBUG) console.debug("Pasting");
        var $parent = options.$node;
        $dlg.data("parent", $parent);
        $dlg.data("data", options.data);
        var base = TX.tx("A copy");
        var name = new RegExp("^" + base + " ?(\\d*)$");
        var i = -1;
        $parent.find("ul:first").children(".tree-node").each(function() {
            var m = name.exec($(this).data("key"));
            if (m)
                i = Math.max(i, m[1] ? parseInt(m[1]) : 0);
        });
        this.get("key").val(base + (i >= 0 ? (" " + (i + 1)) : ""));
    };
    
    widget._init_add = function($dlg) {
        var self = this;
        
        self.get("key")
            .on("input", function() { self._validateUniqueKey(); })
            .autocomplete({ source: [
                TX.tx("User"), TX.tx("Pass") ]});

        self.get("ok")
            .button()
            .on($.getTapEvent(), function() {
                $dlg.dialog("close");
                var $parent = $dlg.data("parent");
                S.add_child_node(
                    $parent, self.get("key").val(),
                    $dlg.data("adding_value") ?
                        self.get("value").val() : undefined);
                return false;
            });
    };

    widget._open_add = function($dlg, options) {
        var $parent = options.$node;
        var is_value = options.is_value;
        $dlg.data("parent", $parent);
        $dlg.data("adding_value", is_value);

        this.get("path").text($parent.tree("getPath").join(" > ") + " > ");
        if (is_value) {
            $dlg.attr("title", TX.tx("Add value"));
            this.get("help").text(TX.tx(
                "Enter the name and value for the new entry"));
            this.get("value_parts").show();
            this.get("key").autocomplete("enable");
        } else {
            $dlg.attr("title", TX.tx("Add folder"));
            this.get("help").text(TX.tx(
                "Enter the name for the new folder"));
            this.get("value_parts").hide();
            this.get("key").autocomplete("disable");
        }

        this._validateUniqueKey();
    };
    
    /**
     * Generate a modal alert dialog
     * @param p either a string message, or a structure containing:
     *  title - dialog title
     *  message - (string or $object or elem)
     *  severity - may be one of notice (default), warning, error
     *  after_close - callback on dialog closed
     */
    widget._init_squeak = function($dlg) {
        this.get("close")
            .button()
            .on($.getTapEvent(), function() {
                var ac = $dlg.data("after_close");
                $dlg.removeData("after_close");
                $dlg.dialog("close");
                if (typeof ac === "function")
                    ac();
                return false;
            });
    };

    widget._open_squeak = function($dlg, p) {
        if (typeof p === "string")
            p = { message: p, severity: "notice" };

        $dlg.data("after_close", p.after_close);

        this.get("message").empty();
        this.squeakAdd(p);

        var options = {
            close: function() {
                if (!called_back) {
                    if (typeof p.after_close === "function")
                        p.after_close();
                }
            }
        };
        if (p.title)
            options.title = p.title;
    };

    widget.squeakAdd = function(p) {
        var $dlg = this.element;
        
        $dlg.find(".dlg-while").remove();
        if (typeof p === "string")
            p = { message: p, severity: "notice" };

        if (!p.severity)
            p.severity = "notice";

        $dlg.find(".messages").append(
            $("<div class='dlg-" + p.severity + "'></div>")
                .append(p.message));
    };

    $.widget("squirrel.squirrelDialog", $.ui.dialog, widget);
    
})(jQuery, Squirrel);
