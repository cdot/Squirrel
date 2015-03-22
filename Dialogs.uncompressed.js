Squirrel.Dialog = {};

/**
 * @private
 */
Squirrel.Dialog.play_action = function(action) {
    var res = Squirrel.client.hoard.record_action(
        action,
        function(e) {
            Squirrel.render_action(
                e,
                function() {
                    Utils.sometime("update_save");
                }, true);
        });
    if (res !== null)
        Squirrel.Dialog.squeak(res.message);
};

// Generate an alert dialog "OK" button
Squirrel.Dialog.squeak = function(e, ok) {
    "use strict";

    var $dlg = $("#dlg_alert");

    if (typeof e === "string")
        $("#dlg_alert_message").html(e);
    else
        $("#dlg_alert_message").empty().append(e);

    if (typeof $dlg.dialog("instance") === "undefined") {
        $("#dlg_alert_ok")
            .button()
            .on("click", function(/*e*/) {
                $dlg.dialog("close");
            });
    }

    $dlg.dialog({
        modal: true,
        close: function() {
            if (typeof ok !== "undefined")
                ok();
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
    p = Squirrel.get_path($node);

    $dlg.data("path", p);

    $("#dlg_delconf_message").text(p.join("/"));
    $("#dlg_delconf_coll").toggle($node.hasClass("treecollection"));

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
                        Squirrel.render_action(
                            e,
                            function() {
                                Utils.sometime("update_save");
                                Utils.sometime("update_tree");
                            }, true);
                    });
                if (res !== null)
                    Squirrel.Dialog.squeak(res.message);
            });

        $("#dlg_delconf_cancel")
            .button()
            .on("click", function(/*evt*/) {
                $("#dlg_delconf").dialog("close");
            });
    }

    $dlg.dialog({
        modal: true,
        width: "auto"
    });
};

/**
 * Dialog password generation
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

    if (typeof $dlg.dialog("instance") === "undefined") {
        $("#dlg_gen_rand_use")
            .button()
            .on("click", function() {
                var $ddlg = $("#dlg_gen_rand");
                $ddlg.dialog("close");
                var pw = $("#dlg_gen_rand_idea").text();
                var old_path = Squirrel.get_path($ddlg.data("node"));
                Squirrel.Dialog.play_action(
                    { type: "E",
                      path: old_path,
                      data: pw });
            });

        $("#dlg_gen_rand_again")
            .button()
            .on("click", function() {
                var $ddlg = $("#dlg_gen_rand");
                opts = $ddlg.data("opts");
                opts.length = $("#dlg_gen_rand_len").val();
                opts.charset = $("#dlg_gen_rand_chs").val();
                $("#dlg_gen_rand_idea").text(Utils.generate_password(opts));
            });

        $("#dlg_gen_rand_cancel")
            .button()
            .on("click", function() {
                $("#dlg_gen_rand").dialog("close");
            });
    }

    $dlg.dialog({
        width: "auto",
        modal: true
    });
};

Squirrel.Dialog.load_JSON_file = function() {
    "use strict";

    var $dlg = $("#dlg_json");
    $dlg.dialog({
        modal: true,
        width: "auto"
    });
};

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
                    // for TX: TX.tx("has a new password")
                    Squirrel.client.store.pass(p);
                    Squirrel.client.status = "has a new password";
                    Squirrel.cloud.store.pass(p);
                    Squirrel.cloud.status = "has a new password";
                    $("#dlg_chpw").dialog("close");
                    Utils.sometime("update_save");
                }
            });
    }

    $dlg.dialog({
        modal: true,
        width: "auto"
    });
};

Squirrel.read_json_file = function(file) {
    "use strict";

    Utils.read_file(
        file,
        function(data) {
            $("#dlg_options").dialog("close");
            try {
                data = JSON.parse(data);
            } catch (e) {
                Squirrel.Dialog.squeak(TX.tx("JSON could not be parsed")
                                + ": " + e);
                return;
            }
            if (DEBUG) console.debug("Importing...");
            Squirrel.insert_data([], data);
        },
        Squirrel.Dialog.squeak);
};

Squirrel.Dialog.options = function() {
    "use strict";

    var $dlg = $("#dlg_options");

    if (typeof $dlg.dialog("instance") === "undefined") {
        $("#dlg_options_autosave")
            .prop("checked", Squirrel.client.hoard.options.autosave)
            .on("change", function() {
                Squirrel.client.hoard.options.autosave =
                    $("#dlg_options_autosave").is(":checked");
                $(".autosave_warn", $dlg)
                    .toggle(!Squirrel.client.hoard.options.autosave);
                Utils.sometime("update_save");
            });

        $("#dlg_options_autosave_warn")
            .toggle(!Squirrel.client.hoard.options.autosave);

        $("#dlg_options_chpw")
            .button()
            .on("click", function () {
                $dlg.dialog("close");
                Squirrel.Dialog.change_password();
            });

        $("#dlg_options_import").button().click(function(e) {
            $("#dlg_options_jsonfile").trigger("click", e);
        });

        $("#dlg_options_copy")
            .button()
            .on("click", function() {
                $dlg.dialog("close");
            });

        var zc = new ZeroClipboard($("#dlg_options_copy"))
            .on("copy", function(event) {
                event.clipboardData.setData(
                    "text/plain",
                    JSON.stringify(Squirrel.client.hoard));
            });
        $dlg.data("ZC", zc);
    }
    $dlg.dialog({
        modal: true,
        width: "auto"
    });
};

Squirrel.Dialog.login = function(ok, fail, uReq, pReq) {
    "use strict";

    var $dlg = $("#dlg_login"), store = this,

    $uReq = $("#dlg_login_uReq").toggle(uReq).find("input"),
    $pReq = $("#dlg_login_pReq").toggle(pReq).find("input"),

    sign_in = function(/*evt*/) {
        $dlg.dialog("close");
        ok.call(store,
                uReq ? $("#dlg_login_user").val() : undefined,
                pReq ? $("#dlg_login_pass").val() : undefined);
    };
    $("#dlg_login_signin")
        .button()
        .reon("click", sign_in);
        
    if (uReq && pReq) {
        $dlg.data("foc", $uReq);
        $uReq.reon("change", function() {
            $pReq.focus();
        });
        $pReq.reon("change", sign_in);
    }
    else if (uReq) {
        $dlg.data("foc", $uReq);
        $uReq.reon("change", sign_in);
    } else if (pReq) {
        $("#dlg_login_foruser")
            .toggle(this.user() !== null)
            .text(this.user() || "");
        $dlg.data("foc", $pReq);
        $pReq.reon("change", sign_in);
    }

    $dlg.dialog({
        modal: true,
        width: "auto",
        focus: function(/*e, ui*/) {
            // "autofocus" ought to do this, but doesn't
            $dlg.data("foc").focus();
        }
    });
};

Squirrel.Dialog.alarm = function($node) {
    var $dlg = $("#dlg_alarm"),
    $alarm = $node.children(".alarm"),
    path = Squirrel.get_path($node),
    number = 6,
    units = "m";

    is_new = (typeof $dlg.dialog("instance") === "undefined");

    if ($alarm.length > 0) {
        number = $alarm.data("alarm");
        if (number % 365 === 0)
            number /= 365, units = "y";
        else if (number % 30 === 0)
            number /= 30, units = "m";
        else if (number % 7 === 0)
            number /= 7, units = "w";
        else
            units = "d";
        $("#dlg_alarm_cancel").show();
    } else
        $("#dlg_alarm_cancel").show();

    $dlg.data("path", path);
    $("#dlg_alarm_number").val(number);
    $("#dlg_alarm_units").val(units);

    $dlg.dialog({
        modal: true,
        width: "auto"
    });

    // Doing this after the dialog is initialised, because otherwise the
    // selectmenu is covered
    if (is_new) {
        $("#dlg_alarm_units")
            .selectmenu();

        $("#dlg_alarm_number")
            .spinner({
                min: 1
            });

        $("#dlg_alarm_set")
            .button()
            .on("click", function() {
                $dlg.dialog("close");

                var number = $("#dlg_alarm_number").val(),
                units = $("#dlg_alarm_units").val();

                if (units === "y")
                    number *= 365;
                else if (units === "m")
                    number *= 30;
                else if (units === "w")
                    number *= 7;

                Squirrel.Dialog.play_action(
                    { type: "A",
                      path: $dlg.data("path"),
                      data: number
                    });
            });

        $("#dlg_alarm_cancel")
            .button()
            .on("click", function() {
                $dlg.dialog("close");
                if ($alarm) {
                    var data = $dlg.data("alarm");
                    Squirrel.Dialog.play_action(
                        { type: "C",
                          path: $dlg.data("path")
                        });
                }
            });
    }
};
