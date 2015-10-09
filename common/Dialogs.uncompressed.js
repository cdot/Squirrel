/* Copyright (C) 2015 Crawford Currie http://c-dot.co.uk / MIT */

// Common code for dialogs
Squirrel.Dialog = {};

// The code below requires the environment to define the following
// extra methods in the namespace:
//
// squeak
//    title
//    message (string or $object or element)
//    after_close
// init_dialog
// open_dialog
// close_dialog
Squirrel.Dialog.squeak_more = function(mess) {
    $("#activity_message").append(mess);
};

Squirrel.Dialog.play_action = function(action) {
    "use strict";

    var res = Squirrel.client.hoard.record_action(
        action,
        function(e) {
            Squirrel.Tree.action(
                e,
                function() {
                    Utils.sometime("update_save");
                }, true);
        });
    if (res !== null)
        Squirrel.Dialog.squeak({
            title: TX.tx("Error"),
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
Squirrel.Dialog.login = function(options) {
    "use strict";

    var $dlg = $("#login");

    $("#login_uReq").toggle(options.user_required);
    $("#login_pReq").toggle(options.pass_required);

    var $user = $("#login_user");
    var $pass = $("#login_pass");
    var $signin = $("#login_signin");

    var sign_in = function(evt) {
        Squirrel.Dialog.close_dialog($dlg);
        $signin.off(Squirrel.Dialog.click);
        $user.off("change");
        $pass.off("change");
        options.on_signin.call(options.store,
                               $user.val(),
                               $pass.val());
        return true;
    };

    $signin
        .off(Squirrel.Dialog.click)
        .click("p", sign_in);

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
        Squirrel.Dialog.init_dialog($dlg);

    Squirrel.Dialog.open_dialog($dlg);
};

/**
 * Confirm deletion of a node
 */
Squirrel.Dialog.delete_node = function($node) {
    var $dlg = $("#delete_node");
    $dlg.data("node", $node);

    if ($dlg.hasClass("hidden")) {
        $("#delete_node_ok")
            .click(function() {
                Squirrel.Dialog.close_dialog($dlg);
                var res = Squirrel.client.hoard.record_action(
                    {
                        type: "D",
                        path: $dlg.data("node").treenode("get_path")
                    },
                    function(e) {
                        Tree.action(
                            e,
                            function() {
                                Utils.sometime("update_save");
                                Utils.sometime("update_tree");
                            }, true);
                    });
                if (res !== null) {
                    Squirrel.Dialog.squeak({
                        title: TX.tx("Error"),
                        message: res.message
                    });
                    return false;
                }
                return true;
            });
        $("#delete_node_cancel")
            .button()
            .on("click", function(/*evt*/) {
                Squirrel.Dialog.close_dialog($dlg);
                return false;
            });
        Squirrel.Dialog.init_dialog($dlg);
    }
    $("#delete_node_path").text(
        $node.treenode("get_path").join("/"));
    $("#delete_node_coll").toggle(!$node.hasClass("treenode-leaf"));
 
    Squirrel.Dialog.open_dialog($dlg);
};

Squirrel.Dialog.about = function($node) {
    var $dlg = $("#about");
    if ($dlg.hasClass("hidden"))
        Squirrel.Dialog.init_dialog($dlg);
    Squirrel.Dialog.open_dialog($dlg);
};

Squirrel.Dialog.pick = function($node) {
    var $dlg = $("#pick");

    if ($dlg.hasClass("hidden")) {
        $("#pick_clear")
            .click(function() {
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
                .click(item_clicked)
                .appendTo($which);
            $f = $("<td></td>")
                .data("i", i)
                .addClass("pick_cell i" + i)
                .click(item_clicked)
                .appendTo($from);
        }
        $f.text(val.charAt(i));
    }

    while (i < $from.children("td").length) {
        $from.children("td").last().remove();
        i++;
    }

    $dlg.find(".picked").removeClass("picked");
    
    Squirrel.Dialog.open_dialog($dlg);
};

/**
 * Password generation for the given leaf node
 */
Squirrel.Dialog.randomise = function($node) {
    var $dlg = $("#randomise");
    $dlg.data("node", $node);

    if ($dlg.hasClass("hidden")) {
        $("#randomise_again")
            .click(function() {
                $("#randomise_idea").text(Utils.generate_password(
                    {
                        length: $("#randomise_len").val(),
                        charset: $("#randomise_chs").val()
                    }));
                return false;
            });
        $("#randomise_use")
            .click(function() {
                Squirrel.Dialog.close_dialog($dlg);
                Squirrel.Dialog.play_action(
                    { 
                        type: "E",
                        path: $dlg.data("node").treenode("get_path"),
                        data: $("#randomise_idea").text()
                    });
                return true;
            });

        Squirrel.Dialog.init_dialog($dlg);
    }

    var path = $node.treenode("get_path");

    $("#randomise_path").text(path.join("/"));
    $("#randomise_key").text($node.find(".key:first").text());
    $("#randomise_again").trigger('click');

    Squirrel.Dialog.open_dialog($dlg);
};

Squirrel.Dialog.search = function() {
    var $dlg = $("#search");

    if ($dlg.hasClass("hidden")) {
        $("#search_ok")
            .click(function() {
                Squirrel.Dialog.close_dialog($dlg);
                Squirrel.search($("#search_string").val());
            });
        $("#search_string")
            .on("change", function() {
                $("#search_ok").trigger(Squirrel.Dialog.click);
            });
        Squirrel.Dialog.init_dialog($dlg);
    }
    Squirrel.Dialog.open_dialog($dlg);
};

const unit_names = [ 'y', 'm', 'w', 'd' ];
const units_days = {
    'y': 365,
    'm': 30,
    'w': 7,
    'd': 1
};

const ms_in_day = 24 * 60 * 60 * 1000;

/**
 * Reminder setting dialog
 */
Squirrel.Dialog.alarm = function($node) {
    var $dlg = $("#alarm");

    if ($dlg.hasClass("hidden")) {
        $dlg.data("update_next", function() {
            var numb = $("#alarm_number").val();
            // Convert to days
            numb = numb * units_days[$("#alarm_units").val()];
            var elapsed = Math.round(
                (Date.now() - $dlg.data("node").data("last-time")) / ms_in_day);
            if (elapsed < numb)
                numb -= elapsed;
            $dlg.find(".alarm_next").hide();

            // Find largest unit for text message
            var uns = "d";
            for (var i = 0; i < unit_names.length; i++) {
                var n = units_days[unit_names[i]];
                if (numb % n == 0) {
                    numb /= n;
                    uns = unit_names[i];
                    break;
                }
            }
            $("#alarm_next").text(numb);
            $dlg.find(".alarm_next." + uns).show();
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
            .click(function() {
                Squirrel.Dialog.close_dialog($dlg);
                var numb = $("#alarm_number").val()
                    * units_days[$("#alarm_units").val()];
                Squirrel.Dialog.play_action(
                    { type: "A",
                      path: $dlg.data("node").treenode("get_path"),
                      data: numb
                    });
                return false;
            });

        $("#alarm_clear")
            .click(function() {
                if ($alarm) {
                    Squirrel.Dialog.play_action(
                        { type: "C",
                          path: $dlg.data("node").treenode("get_path")
                        });
                }
                Squirrel.Dialog.close_dialog($dlg);
                return false;
            });

        Squirrel.Dialog.init_dialog($dlg);
    }
    
    var number = 6;
    var units = "m";

    if (typeof $node.data("alarm") !== "undefined") {
        number = $node.data("alarm");
        units = "d";
        for (var i = 0; i < unit_names.length; i++) {
            var n = units_days[unit_names[i]];
            if (number % n == 0) {
                number /= n;
                units = unit_names[i];
                break;
            }
        }
    }

    $("#alarm_path").text($node.treenode("get_path").join("/"));
    $("#alarm_number").val(number);
    $("#alarm_units option[value='" + units + "']")
        .attr("selected", "selected");

    $dlg.data("node", $node);
    $dlg.data("update_next").call();

    Squirrel.Dialog.open_dialog($dlg);
};

/* Helper */
Squirrel.Dialog.ss_change_image = function() {
    "use strict";

    var fail = function(e) {
        $("#store_settings_message").text(TX.tx(
            "Cannot use this image because of this error: $1", e));
    };
    $("#store_settings_ok").attr("disabled", true);
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
                        if (Squirrel.client.status === Squirrel.IS_LOADED)
                            Squirrel.client.status = Squirrel.NEW_SETTINGS;
                        if (Squirrel.cloud.status === Squirrel.IS_LOADED)
                            Squirrel.cloud.status = Squirrel.NEW_SETTINGS;
                        Utils.sometime("update_save");
                    });
            }
        },
        fail,
        "arraybuffer");
};

Squirrel.Dialog.store_settings = function(store) {
    var $dlg = $("#store_settings");

    if ($dlg.hasClass("hidden")) {
        if (USE_STEGANOGRAPHY) {
            $("#store_settings_file")
                .hide()
                .click(function (e) {
                    Squirrel.Dialog.ss_change_image();
                });

            $("#store_settings_choose_image")
                .click(function(e) {
                    $("#store_settings_file").trigger("change", e);
                });
        }
        Squirrel.Dialog.init_dialog($dlg);
    };

    $("#store_settings_message").empty();

    $("#store_settings_storepath").val(
        Squirrel.client.hoard.options.store_path);

    options.on_ok = function(e) {
        if ($("#store_settings_storepath").val() === "") {
            $("#store_settings_message").text(TX.tx(
                "Store path may not be empty"));
            return false;
        }                
        if (Squirrel.client.hoard.options.store_path !==
            $("#store_settings_storepath").val()) {
            Squirrel.client.hoard.options.store_path =
                $("#store_settings_storepath").val();
            if (Squirrel.client.status === Squirrel.IS_LOADED)
                Squirrel.client.status = Squirrel.NEW_SETTINGS;
            if (Squirrel.cloud.status === Squirrel.IS_LOADED)
                Squirrel.cloud.status = Squirrel.NEW_SETTINGS;
        }
        return true;
    };
};

/**
 * Master password change dialog
 */
Squirrel.Dialog.chpw = function() {
    "use strict";

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

            $("#chpw_nomatch").toggle(p != c);
            return (p == c);
        });

        $("#chpw_conf").on("change", function() {
            $dlg.data("validate").call();
        });

        Squirrel.Dialog.init_dialog($dlg);
    };

    $dlg.data("validate").call();

    $("#chpw_ok")
        .click(function () {
            if (!$dlg.data("validate").call())
                return false;
            Squirrel.client.store.pass(p);
            Squirrel.client.status = Squirrel.NEW_SETTINGS;
            Squirrel.cloud.store.pass(p);
            Squirrel.cloud.status = Squirrel.NEW_SETTINGS;
            Utils.sometime("update_save");

            return true;
        });

    Squirrel.Dialog.open_dialog($dlg);
};

Squirrel.Dialog.json = function() {

    var $dlg = $("#json");

    if ($dlg.hasClass("hidden")) {
        $("#json_text")
            .on("input", function () {
                $("#json_ok").prop("disabled", false);
            });

        $("#json_ok")
            .click(function () {
                Squirrel.Dialog.close_dialog($dlg);
                var data;
                try {
                    data = JSON.parse($("#json_text").val());
                } catch (e) {
                    Squirrel.Dialog.squeak({
                        title: TX.tx("JSON could not be parsed"),
                        message: e
                    });
                    return false;
                }
                $("#json_ok").prop("disabled", true);
                if (DEBUG) console.debug("Importing...");
                Squirrel.insert_data([], data);
                return true;
            });
        Squirrel.Dialog.init_dialog($dlg);
    }

    var data = Squirrel.client.hoard.cache;
    if (data)
        data = data.data;
    $("#json_text")
        .text(JSON.stringify(data))
        .select();
    $("#json_ok").prop("disabled", true);

    Squirrel.Dialog.open_dialog($dlg);
};

Squirrel.Dialog.extras = function() {
    var $dlg = $("#extras");

    if ($dlg.hasClass("hidden")) {
        $("#extras_autosave")
            .on("change", function(e) {
                Squirrel.client.hoard.options.autosave =
                    ($("#extras_autosave").val() === "on");
                Utils.sometime("update_save");
            });

        $("#extras_chpw").click(function() {
            Squirrel.Dialog.close_dialog($dlg);
            Squirrel.Dialog.chpw();
        });

        $("#extras_chss").click(function() {
            Squirrel.Dialog.close_dialog($dlg);
            Squirrel.Dialog.store_settings();
        });

        $("#extras_json").click(function() {
            Squirrel.Dialog.close_dialog($dlg);
            Squirrel.Dialog.json();
        });

        $("#extras_about").click(function() {
            Squirrel.Dialog.close_dialog($dlg);
            Squirrel.Dialog.about();
        });
        Squirrel.Dialog.init_dialog($dlg);
    }

    if (!(USE_STEGANOGRAPHY
          || Squirrel.cloud.store
          && Squirrel.cloud.store.options().needs_path)) {
        $("#extras_chss").hide();
    }
    $("#extras_autosave").val(
        Squirrel.client.hoard.options.autosave ? "on" : "off");

    Squirrel.Dialog.open_dialog($dlg);
};
