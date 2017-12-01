/*@preserve Copyright (C) 2015 Crawford Currie http://c-dot.co.uk license MIT*/

/* eslint-env jquery */
/* global Utils */
/* global TX */
/* global DEBUG */
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
    // SD.init_dialog($dlg)
    // SD.open_dialog($dlg)
    // SD.close_dialog($dlg)

    SD.squeak_more = function(p) {
        $(".dlg-while").remove();
        if (typeof p === "string")
            p = { message: p, severity: "notice" };

        if (!p.severity)
            p.severity = "notice";

        $("#squeak_message").append(
            $("<div class='dlg-" + p.severity + "'></div>")
                .append(p.message));
    };

    SD.play_action = function(action, more) {
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
    };

    /**
     * options:
     * ok - function called on dialog closed, passing the user and password
     *      and with this set to the options.store
     * user_required - set true if the store requires a username
     * pass_required - set true if the store requires a password
     * store - store we are logging in to
     */
    SD.login = function(options) {
        var $dlg = $("#login");

        $("#login_uReq").toggle(options.user_required);
        $("#login_pReq").toggle(options.pass_required);

        var $user = $("#login_user");
        var $pass = $("#login_pass");
        var $signin = $("#login_signin");

        var sign_in = function() {
            SD.close_dialog($dlg);
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
        }
        if (options.pass_required) {
            $("#login_foruser")
                .toggle(options.store.user() !== null)
                .text(options.store.user() || "");
            $pass.attr("autofocus", "autofocus");
            if (options.user_required) {
                $pass.on("change", function() {
                    $signin.focus();
                });
            } else {
                $pass.on("change", sign_in);
            }
        }

        SD.init_dialog($dlg);

        SD.open_dialog($dlg);
    };

    /**
     * Confirm deletion of a node
     */
    SD.delete_node = function($node) {
        var $dlg = $("#delete_node");
        $dlg.data("node", $node);

        SD.init_dialog(
            $dlg,
            function($dlg, id) {
                $(id + "ok").on($.getTapEvent(), function() {
                    SD.close_dialog($dlg);
                    var res = S.client.hoard.record_action(
                        {
                            type: "D",
                            path: ST.get_path($dlg.data("node"))
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
                $("#delete_node_cancel").on($.getTapEvent(), function() {
                    SD.close_dialog($dlg);
                    return false;
                });
            });

        $("#delete_node_path").text(
            ST.get_path($node).join("/"));
        $("#delete_node_coll").toggle(!$node.hasClass("tree-leaf"));
        
        SD.open_dialog($dlg);
    };

    SD.about = function() {
        var $dlg = $("#about");
        SD.init_dialog($dlg);
        SD.open_dialog($dlg);
    };

    SD.pick = function($node) {
        var $dlg = $("#pick");

        SD.init_dialog($dlg, function($dlg, id) {
            $(id + "clear")
                .on($.getTapEvent(), function() {
                    $dlg.find(".dlg-picked").removeClass("dlg-picked");
                });
        });

        var val = $node.find(".tree-value:first").text();
        var $which = $("#pick_which");
        var $from = $("#pick_from");
        var i, $f;

        $("#pick").find(".dlg-pick-cell").remove();

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
        
        SD.open_dialog($dlg);
    };

    /**
     * Password generation for the given leaf node
     */
    SD.randomise = function($node) {
        var id = "#randomise";
        var $dlg = $(id);

        SD.init_dialog(
            $dlg,
            function($dlg, id) {
                $(id + "_again").on($.getTapEvent(), function() {
                    $(id + "_idea").text(Utils.generate_password(
                        {
                            length: $(id + "_len").val(),
                            charset: $(id + "_chs").val()
                        }));
                    return false;
                });
                $(id + "_use").on($.getTapEvent(), function() {
                    SD.close_dialog($dlg);
                    SD.play_action(
                        { 
                            type: "E",
                            path: ST.get_path($dlg.data("node")),
                            data: $(id + "_idea").text()
                        });
                    return true;
                });
                $(id + "_remember").on($.getTapEvent(), function() {
                    var constraints = $(id + "_len").val() +
                        TX.tx(" characters from ") +
                        '[' + $(id + "_chs").val() + ']';
                    var $ibling = $dlg.data("constraints");
                    if ($ibling) {
                        if (constraints != $ibling.data("value")) {
                            SD.play_action(
                                { 
                                    type: "E",
                                    path: ST.get_path($ibling),
                                    data: constraints
                                }, function() {
                                    $ibling.data("value", constraints);
                                });
                        }
                    } else {
                        var $node = $dlg.data("node");
                        var p = ST.get_path($node).slice();
                        var k = TX.tx("$1 constraints", p.pop());
                        p.push(k); 
                        SD.play_action(
                            { 
                                type: "N",
                                path: p,
                                data: constraints
                            }, function($new) {
                                $dlg.data("constraints", $new);
                            });
                    }
                });
            });

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
                    $(id + "_len").val(m[1]);
                    $(id + "_chs").val(m[2]);
                }
            }
        });

        var path = ST.get_path($node);
        $(id + "_path").text(path.join("/"));
        $(id + "_key").text(my_key);
        $(id + "_again").trigger("click");

        SD.open_dialog($dlg);
    };

    SD.search = function() {
        var $dlg = $("#search");

        SD.init_dialog(
            $dlg,
            function ($dlg, id) {
                $(id + "_ok")
                    .on($.getTapEvent(), function() {
                        SD.close_dialog($dlg);
                        S.search($("#search_string").val());
                    });
                $(id + "_string")
                    .on("change", function() {
                        $("#search_ok").trigger($.getTapEvent());
                    });
            });
        SD.open_dialog($dlg);
    };

    /**
     * Reminder setting dialog
     */
    SD.alarm = function($node) {
        var $dlg = $("#alarm");

        SD.init_dialog($dlg, function($dlg, id) {
 
            $dlg.data("update_next", function() {
                var numb = $(id + "_number").val();
                // Convert to days
                numb = numb * Utils.TIMEUNITS[$(id + "_units").val()].days;
                var last_time = $dlg.data("node").data("last-time");
                var alarmd = new Date(last_time + numb * Utils.MSPERDAY);
                $('#alarm_when').text(alarmd.toLocaleDateString());
                $(id + "_next").text(Utils.deltaTimeString(alarmd));
            });

            $(id + "_units")
                .on("change", function() {
                    $dlg.data("update_next").call();
                });

            $(id + "_number")
                .on("change", function() {
                    $dlg.data("update_next").call();
                });

            $(id + "_set")
                .on($.getTapEvent(), function() {
                    SD.close_dialog($dlg);
                    var numb = $(id + "_number").val()
                        * Utils.TIMEUNITS[$(id + "_units").val()].days;
                    SD.play_action(
                        { type: "A",
                          path: ST.get_path($dlg.data("node")),
                          data: numb
                        });
                    return false;
                });

            $(id + "_clear")
                .on($.getTapEvent(), function() {
                    SD.play_action(
                        { type: "C",
                          path: ST.get_path($dlg.data("node"))
                        });
                    SD.close_dialog($dlg);
                    return false;
                });

        });
        
        $("#alarm_path").text(ST.get_path($node).join("/"));

        $dlg.data("node", $node);
        $dlg.data("update_next").call();

        SD.open_dialog($dlg);
    };

    /* Helper */
    SD.ss_change_image = function() {
        var fail = function(e) {
            $("#store_settings_message").text(TX.tx(
                "Cannot use this image because of this error: $1", e));
        };
        var file = $(this)[0].files[0];
        Utils.read_file(
            file,
            function(data) {
                data = "data:" + file.type + ";base64,"
                    + Utils.ArrayBufferToBase64(data);
                if (data !== $("#stegamage").attr("src", data)) {
                    $("#stegamage")
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
                            $("#store_settings #ok").attr("disabled", false);
                            var h = this.naturalHeight;
                            var w = this.naturalWidth;
                            this.height = 100;
                            $("#store_settings_message")
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

    SD.store_settings = function(chain) {
        var $dlg = $("#store_settings");

        SD.init_dialog($dlg, function($dlg, id) {
            $(id + "_file")
                .hide()
                .on($.getTapEvent(), function () {
                    SD.ss_change_image();
                });

            $(id + "_image")
                .on($.getTapEvent(), function(e) {
                    $("#store_settings_file").trigger("change", e);
                });

            $(id + "_storepath").on("keyup", function() {
                if ($("#store_settings_storepath").val() === "") {
                    $("#store_settings_message").text(TX.tx(
                        "Store path may not be empty"));
                    return false;
                }
                if (S.client.hoard.options.store_path !==
                    $("#store_settings_storepath").val()) {
                    S.client.hoard.options.store_path =
                        $("#store_settings_storepath").val();
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

            $(id + "_ok")
                .on($.getTapEvent(), function () {
                    if ($("#store_settings_storepath").val() === "") {
                        $("#store_settings_message").text(TX.tx(
                            "Store path may not be empty"));
                        return false;
                    }
                    SD.close_dialog($dlg);
                    var cb = $dlg.data("callback");
                    if (typeof cb === "function")
                        cb();
                });
        });

        $("#store_settings_message").empty();
        $dlg.data("callback", chain);
        $("#store_settings_storepath").val(
            S.client.hoard.options.store_path);

        SD.open_dialog($dlg);
    };

    /**
     * Master password change dialog
     */
    SD.chpw = function() {
        var $dlg = $("#chpw");

        SD.init_dialog($dlg, function($dlg, id) {
            $(id + "_show")
                .on("change", function() {
                    if ($("#chpw_show").prop("checked")) {
                        $("#chpw_pass").attr("type", "text");
                        $("#chpw_conf").attr("type", "text");
                    } else {
                        $("#chpw_pass").attr("type", "password");
                        $("#chpw_conf").attr("type", "password");
                    }
                });

            $dlg.data("validate", function() {
                var p = $("#chpw_pass").val(),
                c = $("#chpw_conf").val();

                $("#chpw_nomatch").toggle(p !== c);
                return (p === c);
            });

            $(id + "_conf").on("change", function() {
                $dlg.data("validate").call();
            });

            $(id + "_set")
                .on($.getTapEvent(), function () {
                    if (!$dlg.data("validate").call())
                        return false;
                    SD.close_dialog($dlg);
                    var p = $("#chpw_pass").val();
                    S.client.store.pass(p);
                    S.client.status = S.NEW_SETTINGS;
                    S.cloud.store.pass(p);
                    S.cloud.status = S.NEW_SETTINGS;
                    Utils.sometime("update_save");

                    return true;
                });
        });

        $dlg.data("validate").call();

        SD.open_dialog($dlg);
    };

    SD.json = function() {
        var $dlg = $("#json");

        SD.init_dialog($dlg, function($dlg, id) {
            $(id + "_text")
                .on("input", function () {
                    $("#json_ok").prop("disabled", false);
                });

            $(id + "_ok")
                .on($.getTapEvent(), function () {
                    SD.close_dialog($dlg);
                    var datum;
                    try {
                        datum = JSON.parse($("#json_text").val());
                    } catch (e) {
                        SD.squeak({
                            title: TX.tx("JSON could not be parsed"),
                            severity: "error",
                            message: e
                        });
                        return false;
                    }
                    $("#json_ok").prop("disabled", true);
                    if (DEBUG) console.debug("Importing...");
                    S.insert_data([], datum);
                    return true;
                });
        });

        var data = S.client.hoard.JSON();
        $("#json_text")
            .text(data)
            .select();
        $("#json_ok").prop("disabled", true);

        SD.open_dialog($dlg);
    };

    SD.theme = function() {
        var $dlg = $("#theme");

        SD.init_dialog($dlg, function($dlg, id) {
            $(id + "_select")
                .on("change", function () {
                    var theme = $(this).val();
                    $("link").filter(function() {
                        return this.href && this.href.indexOf('/themes/') > 0;
                    }).each(function() {
                        this.href = this.href.replace(
                                /\/themes\/[^\/]+/, "/themes/" + theme);
                        $(this).replaceWith($(this));
                        Utils.sometime("reset_styling");
                    });

                });
        });

        SD.open_dialog($dlg);
    };

    SD.extras = function() {
        var $dlg = $("#extras");

        SD.init_dialog($dlg, function($dlg, id) {
            $(id + "_autosave")
                .on("change", function() {
                    S.client.hoard.options.autosave =
                        ($("#extras_autosave").val() === "on");
                    Utils.sometime("update_save");
                });

            $(id + "_chpw").on($.getTapEvent(), function() {
                SD.close_dialog($dlg);
                SD.chpw();
            });

            $(id + "_chss").on($.getTapEvent(), function() {
                SD.close_dialog($dlg);
                SD.store_settings();
            });
            $(id + "_theme").on($.getTapEvent(), function() {
                SD.close_dialog($dlg);
                SD.theme();
            });

            $(id + "_json").on($.getTapEvent(), function() {
                SD.close_dialog($dlg);
                SD.json();
            });

            $(id + "_about").on($.getTapEvent(), function() {
                SD.close_dialog($dlg);
                SD.about();
            });
        });

        if (!(S.USE_STEGANOGRAPHY
              || S.cloud.store
              && S.cloud.store.options().needs_path)) {
            $("#extras_chss").hide();
        }

        $("#extras_autosave").val(
            S.client.hoard.options.autosave ? "on" : "off");

        SD.open_dialog($dlg);
    };

    function validate_unique($node, $input, id) {
        // Disable OK if key value exists or is invalid
        var $ul = $node.find("ul:first");
        var enabled = true;
        var val = $input.val();

        if (!/\S/.test(val)) // empty?
            enabled = false;
        else {
            $ul.children(".tree-node").each(function() {
                if (ST.compare($(this).data("key"), val) == 0) {
                    enabled = false;
                    return false;
                }
            });
        }
            
        if (enabled) {
            $(id + "_ok").button("enable");
            $input
                .removeClass("dlg-disabled")
                .attr("title", TX.tx("Enter new name"));
        } else {
            $(id + "_ok").button("disable");
            $input
                .addClass("dlg-disabled")
                .attr("title", TX.tx("Name is already in use"));
        }
    };
    
    SD.insert = function($parent, data) {
        var id = "#insert";
        var $dlg = $(id);

        SD.init_dialog($dlg, function($dlg, id) {
            $(id + "_key")
                .on("input", function() {
                    validate_unique($dlg.data("parent"), $(this), id);
                });
            $(id + "_ok")
                .button()
                .on($.getTapEvent(), function() {
                    $dlg.dialog("close");
                    S.add_child_node($dlg.data("parent"), $(id + "_key").val(), data.data);
                });
        });

        if (DEBUG) console.debug("Pasting");
        $dlg.data("parent", $parent);
        var base = TX.tx("A copy");
        var name = new RegExp("^" + base + " ?(\\d*)$");
        var i = -1;
        $parent.find("ul:first").children(".tree-node").each(function() {
            var m = name.exec($(this).data("key"));
            if (m)
                i = Math.max(i, m[1] ? parseInt(m[1]) : 0);
        });
        $(id + "_key").val(base + (i >= 0 ? (" " + (i + 1)) : ""));
        
        SD.open_dialog($dlg);
    };
    
    SD.add = function($parent, is_value) {
        var id = "#add"
        var $dlg = $(id);

        $dlg.data("parent", $parent);
        $dlg.data("adding_value", is_value);
        var $ul = $parent.find("ul:first");

        SD.init_dialog($dlg, function($dlg, id) {
            $(id + "_key")
                .on("input", function() { validate_unique($parent, $(this), id); })
                .autocomplete({ source: [
                    TX.tx("User"), TX.tx("Pass") ]});

            $(id + "_ok")
                .button()
                .on($.getTapEvent(), function() {
                    $dlg.dialog("close");
                    var $parent = $dlg.data("parent");
                    S.add_child_node(
                        $parent, $(id + "_key").val(),
                        $dlg.data("adding_value") ?
                            $(id + "_value").val() : undefined);
                    return false;
                });
        });

        $(id + "_path").text(ST.get_path($parent).join(" > ") + " > ");
        if (is_value) {
            $dlg.attr("title", TX.tx("Add value"));
            $(id + "_help").text(TX.tx(
                "Enter the name and value for the new entry"));
            $(id + "_value_parts").show();
            $(id + "_key").autocomplete("enable");
        } else {
            $dlg.attr("title", TX.tx("Add folder"));
            $(id + "_help").text(TX.tx(
                "Enter the name for the new folder"));
            $(id + "_value_parts").hide();
            $(id + "_key").autocomplete("disable");
        }

        validate_unique($parent, $(id + "_key"), id);

        SD.open_dialog($dlg);
    };
    
    SD.init_dialog = function($dlg, extra) {
        if ($dlg.hasClass("dlg-initialised"))
            return;
        $dlg.addClass("dlg-initialised");
        var id = "#" + $dlg.attr("id");
        $(id + "_cancel")
            .button()
            .on($.getTapEvent(), function() {
                $dlg.dialog("close");
                return false;
            });
        if (extra)
            extra($dlg, id);
    };

    SD.open_dialog = function($dlg, opts) {
        var options = {
            modal: true,
            width: "auto",
            closeOnEscape: false
        };
        if ($.isTouchCapable()) {
            options.position = {
                my: "left top",
                at: "left top",
                of: $("body")
            }
        }
        if (opts)
            $.extend(options, opts);
        
        $dlg.dialog(options);
    };

    SD.close_dialog = function($dlg) {
        $dlg.dialog("close");
    };

    /**
     * Generate a modal alert dialog
     * @param p either a string message, or a structure containing:
     *  title - dialog title
     *  message - (string or $object or elem)
     *  severity - may be one of notice (default), warning, error
     *  after_close - callback on dialog closed
     */
    SD.squeak = function(p) {
        var $dlg = $("#squeak");
        if (typeof p === "string")
            p = { message: p, severity: "notice" };

        $dlg.data("after_close", p.after_close);

        var called_back = false;
        SD.init_dialog($dlg, function($dlg, id) {
            $(id + "_close")
                .button()
                .on($.getTapEvent(), function() {
                    var ac = $dlg.data("after_close");
                    $dlg.removeData("after_close");
                    $dlg.dialog("close");
                    if (typeof ac === "function")
                        ac();
                    return false;
                });
        });

        $("#squeak_message").empty();
        SD.squeak_more(p);

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
        
        SD.open_dialog($dlg, options);
    };
})(jQuery, Squirrel);
