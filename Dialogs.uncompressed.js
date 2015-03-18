// Generate an alert dialog
Squirrel.squeak = function(e) {
    "use strict";

    if (typeof e === "string")
        $("#dlg_alert_message").html(e);
    else
        $("#dlg_alert_message").empty().append(e);

    $("#dlg_alert").dialog({
        modal: true
    });
};

/**
 * Squirrel dialog handlers.
 * Requires the Squirrel namespace to be already set up.
 */

/**
 * Confirm deletion of a node
 */
Squirrel.confirm_delete_dialog = function($node) {
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
                var $dlg = $("#dlg_delconf");
                $dlg.dialog("close");
                var res = Squirrel.client.hoard.record_action(
                    {
                        type: "D",
                        path: $dlg.data("path")
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
                    Squirrel.squeak(res.message);
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
Squirrel.make_random_dialog = function($node) {
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

    if (typeof $dlg.dialog("instance") == "undefined") {
        $("#dlg_gen_rand_use")
            .button()
            .on("click", function() {
                var $dlg = $("#dlg_gen_rand");
                $dlg.dialog("close");
                var pw = $("#dlg_gen_rand_idea").text();
                var old_path = Squirrel.get_path($dlg.data("node"));
                var res = Squirrel.client.hoard.record_action(
                    { type: 'E',
                      path: old_path,
                      data: pw },
                    function(e) {
                        Squirrel.render_action(
                            e,
                            function() {
                                Utils.sometime("update_save");
                            }, true);
                    });
                if (res !== null)
                    Squirrel.squeak(e.message);
            });

        $("#dlg_gen_rand_again")
            .button()
            .on("click", function() {
                var $dlg = $("#dlg_gen_rand");
                var ops = $dlg.data("opts");
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

Squirrel.load_JSON_file_dialog = function() {
    "use strict";

    var $dlg = $("#dlg_json");
    if (typeof $dlg.dialog("instance") === "undefined") {
    }
    $dlg.dialog({
        modal: true,
        width: "auto"
    });
};

Squirrel.change_password_dialog = function() {
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
                    Squirrel.squeak("Passwords do not match");
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
    Utils.read_file(
        file,
        function(data) {
            $("#dlg_options").dialog("close");
            try {
                data = JSON.parse(data);
            } catch (e) {
                Squirrel.squeak(TX.tx("JSON could not be parsed")
                                + ": " + e);
                return;
            }
            if (DEBUG) console.debug("Importing...");
            Squirrel.load_log = [];
            Squirrel.client.hoard.actions_from_hierarchy(
                { data: data },
                function(act, next) { // listener
                    //console.debug(Hoard.stringify_action(act));
                    var res = Squirrel.client.hoard.record_action(
                        act, function (sact) {
                            Squirrel.render_action(sact, next);
                        });
                    if (res !== null)
                        Squirrel.load_log.push(res.message);
                    next();
                },
                function() { // chain on complete
                    Utils.sometime("update_save");
                    Utils.sometime("update_tree");
                    Squirrel.squeak(
                        file.name
                            + TX.tx(" has been loaded") + "<br />"
                            + join("<br />", Squirrel.load_log));
                    delete Squirrel.load_log;
                });
        },
        Squirrel.squeak);
};

Squirrel.options_dialog = function() {
    "use strict";

    var $dlg = $("#dlg_options");

    if (typeof $dlg.dialog("instance") == "undefined") {
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
                Squirrel.change_password_dialog();
            });

        $("#dlg_options_jsonfile")
            .on("click", function() {
                this.value = null;
            })
            .on("change", function() {
                read_json_file($("#dlg_options_jsonfile")[0].files[0]);
            })
            .hide();

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

Squirrel.login_dialog = function(ok, fail, uReq, pReq) {
    "use strict";

    var $dlg = $("#dlg_login"), sign_in, $uReq, $pReq, store = this, $foc;

    // Should never be called more than once
    if (DEBUG && typeof $dlg.dialog("instance") !== "undefined")
        debugger;

    sign_in = function(/*evt*/) {
        $dlg.dialog("close");
        ok.call(store,
                uReq ? $("#dlg_login_user").val() : undefined,
                pReq ? $("#dlg_login_pass").val() : undefined);
    };
    $uReq = $("#dlg_login_uReq").toggle(uReq).find("input");
    $pReq = $("#dlg_login_pReq").toggle(pReq).find("input");
        
    if (uReq && pReq) {
        $foc = $uReq;
        $uReq.on("change", function() {
            $pReq.focus();
        });
        $pReq.on("change", sign_in);
    }
    else if (uReq) {
        $foc = $uReq;
        $uReq.on("change", sign_in);
    } else if (pReq) {
        $("#dlg_login_foruser")
            .toggle(this.user() !== null)
            .text(this.user() || "");
        $foc = $pReq;
        $pReq.on("change", sign_in);
    }

    $("#dlg_login_signin")
        .button()
        .on("click", sign_in);
    
    $dlg.dialog({
        modal: true,
        width: "auto",
        focus: function(e, ui) {
            // "autofocus" ought to do this, but doesn't
            $foc.focus();
        }
    });
};
