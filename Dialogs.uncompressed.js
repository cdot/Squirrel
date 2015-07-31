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
Squirrel.Dialog.squeak = function(e, ok, cancel) {
    "use strict";

    var $dlg = $("#dlg_alert");

    if (typeof e === "string")
        $("#dlg_alert_message").html(e);
    else
        $("#dlg_alert_message").empty().append(e);

    var called_back = false;
    if (!$dlg.data("squirrel_ready")) {
        $("#dlg_alert_ok")
            .button()
            .on("click", function(/*e*/) {
                if (typeof ok !== "undefined") {
                    ok();
                    called_back = true;
                }
                $dlg.popup("close");
                return false;
            });
        $("#dlg_alert_cancel")
            .button()
            .on("click", function(/*e*/) {
                if (typeof cancel !== "undefined") {
                    cancel();
                    called_back = true;
                }
                $dlg.popup("close");
                return false;
            });
        $dlg.data("squirrel_ready", true);
    }

    $("#dlg_alert_ok").toggle(typeof ok !== "undefined");
    $("#dlg_alert_cancel").toggle(typeof cancel !== "undefined");
        
    $dlg.popup({
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
    p = Squirrel.Tree.path($node);

    $dlg.data("path", p);

    $("#dlg_delconf_message").text(p.join("/"));
    $("#dlg_delconf_coll").toggle($node.hasClass("treecollection"));

    if (!$dlg.data("squirrel_ready")) {
        $("#dlg_delconf_delete")
            .button()
            .on("click", function(/*evt*/) {
                var $ddlg = $("#dlg_delconf");
                $ddlg.popup("close");
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
                $("#dlg_delconf").popup("close");
                return false;
            });
        $dlg.data("squirrel_ready", true);
    }

    $dlg.popup("open");
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
        $node.children(".node_div").children(".key").text());
    $("#dlg_gen_rand_idea").text(Utils.generate_password(opts));

    $dlg.data("node", $node);
    $dlg.data("opts", opts);

    if (!$dlg.data("squirrel_ready")) {
        $("#dlg_gen_rand_use")
            .button()
            .on("click", function() {
                var $ddlg = $("#dlg_gen_rand");
                $ddlg.popup("close");
                var pw = $("#dlg_gen_rand_idea").text();
                var old_path = Squirrel.Tree.path($ddlg.data("node"));
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
                $("#dlg_gen_rand").popup("close");
                return false;
            });
        $dlg.data("squirrel_ready", true);
    }

    $dlg.popup("open");
};

/**
 * Master password change dialog
 */
Squirrel.Dialog.change_password = function() {
    "use strict";

    var $dlg = $("#dlg_chpw");

    if (!$dlg.data("squirrel_ready")) {
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
                    $("#dlg_chpw").popup("close");
                    Utils.sometime("update_save");
                }
                return false;
            });
        $dlg.data("squirrel_ready", true);
    }

    $dlg.popup("open");
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
Squirrel.Dialog.login = function(store, ok, fail, uReq, pReq) {
    "use strict";

    $("#login_uReq").toggle(uReq);
    $("#login_pReq").toggle(pReq);

    var $user = $("#login_user");
    var $pass = $("#login_pass");
    var $signin = $("#login_signin");

    var sign_in = function(/*evt*/) {
        Squirrel.pop_page(function() {
            ok.call(store,
                    $user.val(),
                    $pass.val());
        });
        return false;
    };

    $signin.on("click", sign_in);

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
        $("#login_foruser")
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

    Squirrel.push_page("login");
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
Squirrel.Dialog.alarm = function($node) {
    "use strict";

    var $dlg = $("#dlg_alarm");
    var $alarm = $node.children(".alarm");
    var path = Squirrel.Tree.path($node);
    var number = 6;
    var units = "m";
    var is_new = (!$dlg.data("squirrel_ready"));

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

    if ($alarm.length > 0) {
        number = $alarm.data("alarm");
        if (number % units_days.y === 0) {
            number /= units_days.y; units = "y";
        } else if (number % units_days.m === 0) {
            number /= units_days.m; units = "m";
        } else if (number % units_days.w === 0) {
            number /= units_days.w; units = "w";
        } else
            units = "d";
    }

    $dlg.data("path", path);
    $("#dlg_alarm_number").val(number);
    $("#dlg_alarm_units").val(units);
    update_next();

    $dlg.popup("open");

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
                $dlg.popup("close");

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
                $dlg.popup("close");
                if ($alarm) {
                    Squirrel.Dialog.play_action(
                        { type: "C",
                          path: $dlg.data("path")
                        });
                }
                return false;
            });

        // Hack around http://bugs.jqueryui.com/ticket/10543
        $dlg.parent().css("overflow", "visible");
        $dlg.data("squirrel_ready", true);
    }
};

Squirrel.Dialog.pick_from = function($node) {
    "use strict";

    var $dlg = $("#dlg_pick"),
    val = $node.children(".node_div").children(".value").text(),
    $which = $("#dlg_pick_which"),
    $from = $("#dlg_pick_from"), i, $f,

    item_clicked = function() {
        var ii = $(this).data("i");
        $dlg
            .find("td.i" + ii)
            .addClass("picked");
    };

    if (!$dlg.data("squirrel_ready")) {
        $("#dlg_pick_clear")
            .button()
            .on("click", function() {
                $dlg.find(".picked").removeClass("picked");
            });
        $dlg.data("squirrel_ready", true);
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

    $dlg.popup("open");
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
                        $("#store_settings_ok").attr("disabled", false);
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

Squirrel.Dialog.store_settings = function(ok, reason) {
    "use strict";

    var $dlg = $("#store_settings");

    if (!$dlg.data("squirrel_ready")) {

        $("#store_settings_file")
            .hide()
            .on("change", Squirrel.Dialog.ss_change_image);

        $("#store_settings_choose").button().click(function(e) {
            $("#store_settings_file").trigger("click", e);
        });

        $("#store_settings_ok")
            .button()
            .on("click", function(/*e*/) {
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

                Squirrel.pop_page(ok);
                return false;
            });
        $dlg.data("squirrel_ready", true);
    }

    $("#store_settings_storepath").val(Squirrel.client.hoard.options.store_path);
    $("#store_settings_message").empty();

    Squirrel.push_page("store_settings");
};
