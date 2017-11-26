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
        $(".squeak-while").remove();
        if (typeof p === "string")
            p = { message: p, severity: "notice" };

        if (!p.severity)
            p.severity = "notice";

        $("#squeak_message").append(
            $("<div class='squeak-" + p.severity + "'></div>")
                .append(p.message));
    };

    SD.play_action = function(action) {
        var res = S.client.hoard.record_action(
            action,
            function(e) {
                S.Tree.action(
                    e,
                    function() {
                        Utils.sometime("update_save");
                    }, true);
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

        var sign_in = function(evt) {
            SD.close_dialog($dlg);
            $signin.off(SD.click);
            $user.off("change");
            $pass.off("change");
            options.on_signin.call(options.store,
                                   $user.val(),
                                   $pass.val());
            return true;
        };

        $signin
            .off(SD.click)
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
        /** desktop old
            $dlg.dialog({
            modal: true,
            width: "auto",
            closeOnEscape: false,
            open: function() {
            $dlg.parent().find(".ui-dialog-titlebar-close").hide();
            }
            });
        */

        if ($dlg.hasClass("hidden"))
            SD.init_dialog($dlg);

        SD.open_dialog($dlg);
    };

    /**
     * Confirm deletion of a node
     */
    SD.delete_node = function($node) {
        var $dlg = $("#delete_node");
        $dlg.data("node", $node);

        if ($dlg.hasClass("hidden")) {
            $("#delete_node_ok")
                .on($.getTapEvent(), function() {
                    SD.close_dialog($dlg);
                    var res = S.client.hoard.record_action(
                        {
                            type: "D",
                            path: $dlg.data("node").treenode("get_path")
                        },
                        function(e) {
                            ST.action(
                                e,
                                function() {
                                    Utils.sometime("update_save");
                                }, true);
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
            $("#delete_node_cancel")
                .on($.getTapEvent(), function(/*evt*/) {
                    SD.close_dialog($dlg);
                    return false;
                });
            SD.init_dialog($dlg);
        }
        $("#delete_node_path").text(
            $node.treenode("get_path").join("/"));
        $("#delete_node_coll").toggle(!$node.hasClass("treenode-leaf"));
        
        SD.open_dialog($dlg);
    };

    SD.about = function($node) {
        var $dlg = $("#about");
        if ($dlg.hasClass("hidden"))
            SD.init_dialog($dlg);
        SD.open_dialog($dlg);
    };

    SD.pick = function($node) {
        var $dlg = $("#pick");

        if ($dlg.hasClass("hidden")) {
            $("#pick_clear")
                .on($.getTapEvent(), function() {
                    $dlg.find(".picked").removeClass("picked");
                });
            
            $dlg
                .removeClass("hidden")
                .popup({ history: false });
        }

        var val = $node.find(".value:first").text();
        var $which = $("#pick_which");
        var $from = $("#pick_from");
        var i, $f;

        $("#pick").find(".pick_cell").remove();

        var item_clicked = function() {
            var ii = $(this).data("i");
            $dlg
                .find("td.i" + ii)
                .addClass("picked");
        };

        for (i = 0; i < val.length; i++) {
            $f = $from.children("td.i" + i);
            if ($f.length === 0) {
                $("<td></td>")
                    .data("i", i)
                    .addClass("pick_cell i" + i)
                    .text(i + 1)
                    .on($.getTapEvent(), item_clicked)
                    .appendTo($which);
                $f = $("<td></td>")
                    .data("i", i)
                    .addClass("pick_cell i" + i)
                    .on($.getTapEvent(), item_clicked)
                    .appendTo($from);
            }
            $f.text(val.charAt(i));
        }

        while (i < $from.children("td").length) {
            $from.children("td").last().remove();
            i++;
        }

        $dlg.find(".picked").removeClass("picked");
        
        SD.open_dialog($dlg);
    };

    /**
     * Password generation for the given leaf node
     */
    SD.randomise = function($node) {
        var $dlg = $("#randomise");
        $dlg.data("node", $node);

        if ($dlg.hasClass("hidden")) {
            $("#randomise_again")
                .on($.getTapEvent(), function() {
                    $("#randomise_idea").text(Utils.generate_password(
                        {
                            length: $("#randomise_len").val(),
                            charset: $("#randomise_chs").val()
                        }));
                    return false;
                });
            $("#randomise_use")
                .on($.getTapEvent(), function() {
                    SD.close_dialog($dlg);
                    SD.play_action(
                        { 
                            type: "E",
                            path: $dlg.data("node").treenode("get_path"),
                            data: $("#randomise_idea").text()
                        });
                    return true;
                });

            SD.init_dialog($dlg);
        }

        var path = $node.treenode("get_path");

        $("#randomise_path").text(path.join("/"));
        $("#randomise_key").text($node.find(".key:first").text());
        $("#randomise_again").trigger("click");

        SD.open_dialog($dlg);
    };

    SD.search = function() {
        var $dlg = $("#search");

        if ($dlg.hasClass("hidden")) {
            $("#search_ok")
                .on($.getTapEvent(), function() {
                    SD.close_dialog($dlg);
                    S.search($("#search_string").val());
                });
            $("#search_string")
                .on("change", function() {
                    $("#search_ok").trigger(SD.click);
                });
            SD.init_dialog($dlg);
        }
        SD.open_dialog($dlg);
    };

    /**
     * Reminder setting dialog
     */
    SD.alarm = function($node) {
        var $dlg = $("#alarm");

        if ($dlg.hasClass("hidden")) {
            $dlg.data("update_next", function() {
                var numb = $("#alarm_number").val();
                // Convert to days
                numb = numb * Utils.TIMEUNITS[$("#alarm_units").val()].days;
                var last_time = $dlg.data("node").data("last-time");
                var alarmd = new Date(last_time + numb * Utils.MSPERDAY);
                $('#alarm_when').text(alarmd.toLocaleDateString());
                $("#alarm_next").text(Utils.deltaTimeString(alarmd));
            });

            $("#alarm_units")
                .on("change", function() {
                    $dlg.data("update_next").call();
                });

            $("#alarm_number")
                .on("change", function() {
                    $dlg.data("update_next").call();
                });

            $("#alarm_set")
                .on($.getTapEvent(), function() {
                    SD.close_dialog($dlg);
                    var numb = $("#alarm_number").val()
                        * Utils.TIMEUNITS[$("#alarm_units").val()].days;
                    SD.play_action(
                        { type: "A",
                          path: $dlg.data("node").treenode("get_path"),
                          data: numb
                        });
                    return false;
                });

            $("#alarm_clear")
                .on($.getTapEvent(), function() {
                    SD.play_action(
                        { type: "C",
                          path: $dlg.data("node").treenode("get_path")
                        });
                    SD.close_dialog($dlg);
                    return false;
                });

            SD.init_dialog($dlg);
        }
        
        $("#alarm_path").text($node.treenode("get_path").join("/"));

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

        if ($dlg.hasClass("hidden")) {
            $("#store_settings_file")
                .hide()
                .on($.getTapEvent(), function (e) {
                    SD.ss_change_image();
                });

            $("#store_settings_choose_image")
                .on($.getTapEvent(), function(e) {
                    $("#store_settings_file").trigger("change", e);
                });

            $("#store_settings_storepath").on("keyup", function(e) {
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

            $("#store_settings_ok")
                .on($.getTapEvent(), function (e) {
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

            SD.init_dialog($dlg);
        }

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

        if ($dlg.hasClass("hidden")) {

            $("#chpw_show")
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

            $("#chpw_conf").on("change", function() {
                $dlg.data("validate").call();
            });

            SD.init_dialog($dlg);
        }

        $dlg.data("validate").call();

        $("#chpw_set")
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

        SD.open_dialog($dlg);
    };

    SD.json = function() {
        var $dlg = $("#json");

        if ($dlg.hasClass("hidden")) {
            $("#json_text")
                .on("input", function () {
                    $("#json_ok").prop("disabled", false);
                });

            $("#json_ok")
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

            $("#json_close")
                .on($.getTapEvent(), function() {
                    SD.close_dialog($dlg);
                });

            SD.init_dialog($dlg);
        }

        var data = S.client.hoard.JSON();
        $("#json_text")
            .text(data)
            .select();
        $("#json_ok").prop("disabled", true);

        SD.open_dialog($dlg);
    };

    SD.extras = function() {
        var $dlg = $("#extras");

        if ($dlg.hasClass("hidden")) {
            $("#extras_autosave")
                .on("change", function(e) {
                    S.client.hoard.options.autosave =
                        ($("#extras_autosave").val() === "on");
                    Utils.sometime("update_save");
                });

            $("#extras_chpw").on($.getTapEvent(), function() {
                SD.close_dialog($dlg);
                SD.chpw();
            });

            $("#extras_chss").on($.getTapEvent(), function() {
                SD.close_dialog($dlg);
                SD.store_settings();
            });

            $("#extras_json").on($.getTapEvent(), function() {
                SD.close_dialog($dlg);
                SD.json();
            });

            $("#extras_about").on($.getTapEvent(), function() {
                SD.close_dialog($dlg);
                SD.about();
            });
            SD.init_dialog($dlg);
        }

        if (!(S.USE_STEGANOGRAPHY
              || S.cloud.store
              && S.cloud.store.options().needs_path)) {
            $("#extras_chss").hide();
        }
        $("#extras_autosave").val(
            S.client.hoard.options.autosave ? "on" : "off");

        SD.open_dialog($dlg);
    };

    SD.init_dialog = function($dlg) {
        $("#" + $dlg.attr("id") + "_cancel")
            .button()
            .on($.getTapEvent(), function() {
                $dlg.dialog("close");
                return false;
            });
    };

    SD.open_dialog = function($dlg) {
        $dlg.dialog({
            modal: true,
            width: "auto",
            closeOnEscape: false
        });
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
        if ($dlg.hasClass("hidden")) {
            $("#squeak_close")
                .button()
                .on($.getTapEvent(), function(e) {
                    var ac = $dlg.data("after_close");
                    $dlg.removeData("after_close");
                    $dlg.dialog("close");
                    if (typeof ac === "function")
                        ac();
                    return false;
                });
            $dlg.removeClass("hidden");
        }

        $("#squeak_message").empty();
        SD.squeak_more(p);

        var options = {
            modal: true,
            close: function() {
                if (!called_back) {
                    if (typeof p.after_close === "function")
                        p.after_close();
                }
            }
        };
        if (p.title)
            options.title = p.title;

        $dlg.dialog(options);
    };
})(jQuery, Squirrel);
