Squirrel.Dialog = {};

/**
 * @private
 */
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
        Squirrel.Dialog.squeak(res.message);
};

/**
 * Generate a modal alert dialog with optional "OK" and "Cancel" buttons
 * @param e message (HTML)
 * @param ok callback on OK button press, or dialog closed
 * when there is no cancel callback
 * @param cancel callback on Cancel press, or dialog closed and there is a
 * cancel callback
 */
Squirrel.Dialog.squeak = function(p) {
    "use strict";

    var e, ok, cancel;
    if (typeof p === "string")
        e = p;
    else {
        e = p.message;
        ok = p.after_close;
        cancel = p.on_cancel;
    }

    var $dlg = $("#dlg_alert");

    if (typeof e === "string")
        $("#dlg_alert_message").html(e);
    else
        $("#dlg_alert_message").empty().append(e);

    var called_back = false;
    if (typeof $dlg.dialog("instance") === "undefined") {
        $("#dlg_alert_ok")
            .button()
            .on("click", function(/*e*/) {
                if (typeof ok !== "undefined") {
                    ok();
                    called_back = true;
                }
                $dlg.dialog("close");
                return false;
            });
        $("#dlg_alert_cancel")
            .button()
            .on("click", function(/*e*/) {
                if (typeof cancel !== "undefined") {
                    cancel();
                    called_back = true;
                }
                $dlg.dialog("close");
                return false;
            });
    }

    $("#dlg_alert_ok").toggle(typeof ok !== "undefined");
    $("#dlg_alert_cancel").toggle(typeof cancel !== "undefined");
        
    $dlg.dialog({
        modal: true,
        close: function() {
            if (!called_back) {
                if (typeof cancel !== "undefined")
                    cancel();
                else if (typeof ok !== "undefined")
                    ok();
            }
        }
    });
};

Squirrel.Dialog.squeak_more = function(mess) {
    $("#dlg_alert_message").append(mess);
};

/**
 * Squirrel dialog handlers.
 * Requires the Squirrel namespace to be already set up.
 */

/**
 * Confirm deletion of a node
 */
Squirrel.Dialog.confirm_delete = function($node) {
    "use strict";

    var $dlg = $("#dlg_delconf"),
    p = $node.treenode("get_path");

    $dlg.data("path", p);

    $("#dlg_delconf_message").text(p.join("/"));
    $("#dlg_delconf_coll").toggle($node.hasClass("treenode-collection"));

    if (typeof $dlg.dialog("instance") === "undefined") {
        $("#dlg_delconf_delete")
            .button()
            .on("click", function(/*evt*/) {
                var $ddlg = $("#dlg_delconf");
                $ddlg.dialog("close");
                var res = Squirrel.client.hoard.record_action(
                    {
                        type: "D",
                        path: $ddlg.data("path")
                    },
                    function(e) {
                        Squirrel.Tree.action(
                            e,
                            function() {
                                Utils.sometime("update_save");
                                Utils.sometime("update_tree");
                            }, true);
                    });
                if (res !== null)
                    Squirrel.Dialog.squeak(res.message);
                return false;
            });

        $("#dlg_delconf_cancel")
            .button()
            .on("click", function(/*evt*/) {
                $("#dlg_delconf").dialog("close");
                return false;
            });
    }

    $dlg.dialog({
        modal: true,
        width: "auto"
    });
};

/**
 * Password generation for the given leaf node
 */
Squirrel.Dialog.make_random = function($node) {
    "use strict";

    var $dlg = $("#dlg_gen_rand");
    var opts = {
        length: $("#dlg_gen_rand_len").val(),
        charset: $("#dlg_gen_rand_chs").val()
    };

    $("#dlg_gen_rand_key").text(
        $node.find(".key").first().text());
    $("#dlg_gen_rand_idea").text(Utils.generate_password(opts));

    $dlg.data("node", $node);
    $dlg.data("opts", opts);

    if (typeof $dlg.dialog("instance") === "undefined") {
        $("#dlg_gen_rand_use")
            .button()
            .on("click", function() {
                var $ddlg = $("#dlg_gen_rand");
                $ddlg.dialog("close");
                var pw = $("#dlg_gen_rand_idea").text();
                var old_path = $ddlg.data("node").treenode("get_path");
                Squirrel.Dialog.play_action(
                    { type: "E",
                      path: old_path,
                      data: pw });
                return false;
            });

        $("#dlg_gen_rand_again")
            .button()
            .on("click", function() {
                var $ddlg = $("#dlg_gen_rand");
                opts = $ddlg.data("opts");
                opts.length = $("#dlg_gen_rand_len").val();
                opts.charset = $("#dlg_gen_rand_chs").val();
                $("#dlg_gen_rand_idea").text(Utils.generate_password(opts));
                return false;
            });

        $("#dlg_gen_rand_cancel")
            .button()
            .on("click", function() {
                $("#dlg_gen_rand").dialog("close");
                return false;
            });
    }

    $dlg.dialog({
        width: "auto",
        modal: true
    });
};

/**
 * Master password change dialog
 */
Squirrel.Dialog.change_password = function() {
    "use strict";

    var $dlg = $("#dlg_chpw");

    if (typeof $dlg.dialog("instance") === "undefined") {
        $("#dlg_chpw_show")
            .on("change", function() {
                if ($("#dlg_chpw_show").prop("checked")) {
                    $("#dlg_chpw_pass").attr("type", "text");
                    $("#dlg_chpw_conf").attr("type", "text");
                } else {
                    $("#dlg_chpw_pass").attr("type", "password");
                    $("#dlg_chpw_conf").attr("type", "password");
                }
            });

        $("#dlg_chpw_set").button()
            .on("click", function() {
                var p = $("#dlg_chpw_pass").val(),
                c = $("#dlg_chpw_conf").val();
                if (p !== c)
                    Squirrel.Dialog.squeak("Passwords do not match");
                else {
                    Squirrel.client.store.pass(p);
                    Squirrel.client.status = Squirrel.NEW_SETTINGS;
                    Squirrel.cloud.store.pass(p);
                    Squirrel.cloud.status = Squirrel.NEW_SETTINGS;
                    $("#dlg_chpw").dialog("close");
                    Utils.sometime("update_save");
                }
                return false;
            });
    }

    $dlg.dialog({
        modal: true,
        width: "auto"
    });
};

/**
 * The login dialog should never be called more than once. If it is,
 * then the uReq/pReq params will be ignored in the second call.
 * @param ok called on dialog closed, passing the user and password
 * and with this set to the store
 * @param fail never called, but could be used if the login failed
 * @param uReq set true if the store requires a username
 * @param pReq set true if the store requires a password
 */
Squirrel.Dialog.login = function(p) {
    "use strict";

    var store = p.store, ok = p.on_signin, uReq = p.user_required, pReq = p.pass_required;
    var $dlg = $("#dlg_login");

    if (DEBUG && typeof $dlg.dialog("instance") !== "undefined")
        throw "Internal error: Second call to dlg_login";

    $("#dlg_login_uReq").toggle(uReq);
    $("#dlg_login_pReq").toggle(pReq);

    var $user = $("#dlg_login_user");
    var $pass = $("#dlg_login_pass");
    var $signin = $("#dlg_login_signin");
    var sign_in = function(/*evt*/) {
        $dlg.dialog("close");
        ok.call(store,
                $user.val(),
                $pass.val());
        return false;
    };

    $user.val(store.user());
    $pass.val(store.pass());

    if (uReq) {
        $user.attr("autofocus", "autofocus");
        if (pReq) {
            $user.on("change", function() {
                $pass.focus();
            });
        } else {
            $user.on("change", sign_in);
        }
    }
    if (pReq) {
        $("#dlg_login_foruser")
            .toggle(store.user() !== null)
            .text(store.user() || "");
        $pass.attr("autofocus", "autofocus");
        if (uReq) {
            $pass.on("change", function() {
                $signin.focus();
            });
        } else {
            $pass.on("change", sign_in);
        }
    }

    $signin
        .button()
        .on("click", sign_in);

    $dlg.dialog({
        modal: true,
        width: "auto",
        closeOnEscape: false,
        open: function() {
            $dlg.parent().find(".ui-dialog-titlebar-close").hide();
        }
    });
};

const units_days = {
    d: 1,
    w: 7,
    m: 30,
    y: 365
};
const ms_in_day = 24 * 60 * 60 * 1000;

/**
 * Reminder setting dialog
 */
Squirrel.Dialog.alarm = function(p) {
    "use strict";

    var $node = p.node;
    var path = p.path;
    var $dlg = $("#dlg_alarm");
    var number = 6;
    var units = "m";
    var is_new = (typeof $dlg.dialog("instance") === "undefined");

    var update_next = function() {
        var numb = $("#dlg_alarm_number").val()
            * units_days[$("#dlg_alarm_units").val()];
        var elapsed = Math.round((Date.now() - $node.data("last-time"))
                                 / ms_in_day);
        if (elapsed < numb)
            numb -= elapsed;
        var uns = "d";
        if (numb % units_days.y === 0) {
            numb /= units_days.y; uns = "y";
        } else if (numb % units_days.m === 0) {
            numb /= units_days.m; uns = "m";
        } else if (numb % units_days.w === 0) {
            numb /= units_days.w; uns = "w";
        }
        $("#dlg_alarm_next").text(numb);
        $(".dlg_alarm_next").hide();
        $(".dlg_alarm_next." + uns).show();
    };

    if ($node.data("alarm")) {
        number = $node.data("alarm");
        if (number % units_days.y === 0) {
            number /= units_days.y; units = "y";
        } else if (number % units_days.m === 0) {
            number /= units_days.m; units = "m";
        } else if (number % units_days.w === 0) {
            number /= units_days.w; units = "w";
        } else
            units = "d";
        $("#dlg_alarm_cancel").show();
    } else {
        $("#dlg_alarm_cancel").hide();
    }

    $dlg.data("path", path);
    $("#dlg_alarm_number").val(number);
    $("#dlg_alarm_units").val(units);
    update_next();

    $dlg.dialog({
        modal: true,
        width: "auto"
    });

    // Doing this after the dialog is initialised, because otherwise the
    // selectmenu is covered
    if (is_new) {
        $("#dlg_alarm_units")
            .selectmenu()
            .on("change", update_next);

        $("#dlg_alarm_number")
            .spinner({
                min: 1
            })
            .on("change", update_next);

        $("#dlg_alarm_set")
            .button()
            .on("click", function() {
                $dlg.dialog("close");

                var numb = $("#dlg_alarm_number").val()
                    * units_days[$("#dlg_alarm_units").val()];

                Squirrel.Dialog.play_action(
                    { type: "A",
                      path: $dlg.data("path"),
                      data: numb
                    });
                return false;
            });

        $("#dlg_alarm_cancel")
            .button()
            .on("click", function() {
                $dlg.dialog("close");
                Squirrel.Dialog.play_action(
                    { type: "C",
                      path: $dlg.data("path")
                    });
                return false;
            });

        // Hack around http://bugs.jqueryui.com/ticket/10543
        $dlg.parent().css("overflow", "visible");
    }
};

Squirrel.Dialog.pick_from = function($node) {
    "use strict";

    var $dlg = $("#dlg_pick"),
    val = $node.find(".value").first().text(),
    $which = $("#dlg_pick_which"),
    $from = $("#dlg_pick_from"), i, $f,

    item_clicked = function() {
        var ii = $(this).data("i");
        $dlg
            .find("td.i" + ii)
            .addClass("picked");
    };

    if (typeof $dlg.dialog("instance") === "undefined") {
        $("#dlg_pick_clear")
            .button()
            .on("click", function() {
                $dlg.find(".picked").removeClass("picked");
            });
    }

    for (i = 0; i < val.length; i++) {
        $f = $from.children("td.i" + i);
        if ($f.length === 0) {
            $("<td></td>")
                .data("i", i)
                .addClass("pick_cell i" + i)
                .text(i + 1)
                .on("click", item_clicked)
                .appendTo($which);
            $f = $("<td></td>")
                .data("i", i)
                .addClass("pick_cell i" + i)
                .on("click", item_clicked)
                .appendTo($from);
        }
        $f.text(val.charAt(i));
    }

    while (i < $from.children("td").length) {
        $from.children("td").last().remove();
        i++;
    }

    $dlg.find(".picked").removeClass("picked");

    $dlg.dialog({
        modal: true,
        width: "auto"
    });
};

/* Helper */
Squirrel.Dialog.ss_change_image = function() {
    "use strict";

    var fail = function(e) {
        $("#dlg_ss_message").text(TX.tx(
            "Cannot use this image because of this error: $1", e));
    };
    $("#dlg_ss_ok").attr("disabled", true);
    var file = $(this)[0].files[0];
    Utils.read_file(
        file,
        function(data) {
            data = "data:" + file.type + ";base64,"
                + Utils.ArrayBufferToBase64(data);
            if (data !== $("#stegamage").attr("src", data)) {
                $("#stegamage")
                    .attr("src", data)
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
                        $("#dlg_ss_ok").attr("disabled", false);
                        var h = this.naturalHeight;
                        var w = this.naturalWidth;
                        this.height = 100;
                        $("#dlg_ss_message")
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

Squirrel.Dialog.store_settings = function(ok, reason) {
    "use strict";

    var $dlg = $("#dlg_ss");

    if (typeof $dlg.dialog("instance") === "undefined") {

        $("#dlg_ss_file")
            .hide()
            .on("change", Squirrel.Dialog.ss_change_image);

        $("#dlg_ss_choose").button().click(function(e) {
            $("#dlg_ss_file").trigger("click", e);
        });

        $("#dlg_ss_ok")
            .button()
            .on("click", function(/*e*/) {
                if ($("#dlg_ss_storepath").val() === "") {
                    $("#dlg_ss_message").text(TX.tx(
                        "Store path may not be empty"));
                    return false;
                }
                $dlg.dialog("close");

                if (Squirrel.client.hoard.options.store_path !==
                    $("#dlg_ss_storepath").val()) {
                    Squirrel.client.hoard.options.store_path =
                        $("#dlg_ss_storepath").val();
                    if (Squirrel.client.status === Squirrel.IS_LOADED)
                        Squirrel.client.status = Squirrel.NEW_SETTINGS;
                    if (Squirrel.cloud.status === Squirrel.IS_LOADED)
                        Squirrel.cloud.status = Squirrel.NEW_SETTINGS;
                }

                if (ok)
                    ok();
                return false;
            });
    }

    $("#dlg_ss_storepath").val(Squirrel.client.hoard.options.store_path);

    $("#dlg_ss_message")
        .empty();
    $dlg.dialog({
        modal: true,
        width: "auto"
    });
};
