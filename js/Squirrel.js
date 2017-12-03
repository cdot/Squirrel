/*@preserve Copyright (C) 2015-2017 Crawford Currie http://c-dot.co.uk license MIT*/

/* eslint-env jquery */
/* global DEBUG:true */
/* global TX */
/* global Utils */
/* global Cookies */
/* global Clipboard */
/* global AbstractStore */
/* global EncryptedStore */
/* global LocalStorageStore */
/* global StegaStore */
/* global Hoard */
/* global RGBA */
/* global SQUIRREL_STORE */

/*
 * The Squirrel Application namespace and UI.
 */

var Squirrel = {
    PATHSEP: String.fromCharCode(1), // separator used in Path->node mapping

    // Store statii
    // TX.tx("has new settings")
    NEW_SETTINGS: "has new settings",
    // TX.tx("is loaded")
    IS_LOADED: "is loaded",
    // TX.tx("needs to be saved")
    IS_PENDING_SAVE: "needs to be saved",
    // TX.tx("is corrupt")
    IS_CORRUPT: "is corrupt",
    // TX.tx("is empty")
    IS_EMPTY: "is empty",

    USE_STEGANOGRAPHY: false,
    Dialog: {},
    Tree: {},
    // Internal clipboard
    clipboard: undefined
};

(function($, S) {
    "use strict";
    var ST = S.Tree;

    // Functions that are private to this module are declared as
    // function name(). Exported functions are declared as
    // S.name = function()
    
    function reset_styling() {
        // Copy subset of ui-widget styling into base by instantiating
        // a widget element then creating a new <style> with the required
        // attributes applied to body{}
        var $body = $("body");
        var $el = $("<div></div>")
            .addClass("ui-widget")
            .addClass("ui-widget-content")
            .hide();
        $body.append($el);
        var bgcol = $el.css("background-color");
        var style = "body {";
        for (var attr in {
            "font" : 0,
            "color": 0,
            "background-color": 0
        }) {
            var av = $el.css(attr);
            style += attr + ": " + av + ";\n";
        }
        style += "}";
        $el.remove();

        // Do we need bright highlights in user classes?
        var want_bright = (bgcol && bgcol != "transparent" &&
                           new RGBA(bgcol).luma() < 0.65);

        if (S.bright && !want_bright || !S.bright && want_bright) {
            // Invert colours. Takes account of the fact that only
            // local stylesheets can be found this way. Stylesheets
            // loading from other domains (i.e. CDNs) are not local.
            for (var i = 0; i < document.styleSheets.length; i++) {
                var sheet = document.styleSheets[i];
                if (!sheet)
                    continue;
                var rules = sheet.rules || sheet.cssRules;
                if (!rules)
                    continue;               
                for (var j = 0; j < rules.length; j++) {
                    var rule = rules[j];
                    if (/\.[-:a-z0-9]*$/i.test(rule.selectorText)) {
                        // Class definition
                        var s = "", a;
                        if (rule.style.color) {
                            try {
                                a = new RGBA(rule.style.color);
                                s += "color: " +
                                    a.inverse().toString() + ";\n"
                            } catch (e) {
                                console.log(e);
                            }
                        }
                        if (rule.style.backgroundColor) {
                            try {
                                a = new RGBA(
                                    rule.style.backgroundColor);
                                s += "background-color: " +
                                    a.inverse().toString() + ";\n"
                            } catch (e) {
                                console.log(e);
                            }
                        }
                        if (s.length > 0)
                            style += rule.selectorText + "{" + s + "}\n";
                    }
                }
            }
            S.bright = want_bright;
        }

        $("#computed-styles").remove();
        style = "<style id='computed-styles'>" + style + "</style>";
        $body.append(style);
        if (DEBUG) console.log(style);
    }

    S.setTheme = function(theme) {
        $("link").filter(function() {
            return this.href && this.href.indexOf('/themes/') > 0;
        }).each(function() {
            this.href = this.href.replace(
                    /\/themes\/[^\/]+/, "/themes/" + theme);
            $(this).replaceWith($(this));
            Utils.sometime("reset_styling");
        });
        if (theme === "base") {
            Cookies.remove('ui_theme');
        } else {
            Cookies.set('ui_theme', theme);
        }
    };

    // Event handler for check_alarms
    function check_alarms(/* event */) {
        S.client.hoard.check_alarms(
            function(path, expired, next) {
                var $node = ST.getNodeFromPath(path);
                $node.tree("ringAlarm");
                $("#squeak").squirrelDialog("open",
                    {
                        severity: "warning",
                        message:
                        "<div class='ui-icon ui-icon-squirrel-rang'></div>"
                            + TX.tx("Reminder on '$1' was due on $2",
                                    path.join("/"),
                                    expired.toLocaleDateString()),
                        after_close: next
                    });
            });
    }

    function get_updates_from_cloud(cloard, chain) {
        // This will get triggered whenever both hoards are
        // successfully loaded.
        if (DEBUG) console.debug("Merging from cloud hoard");
        S.client.hoard.merge_from_cloud(
            cloard,
            ST.action,
            function(conflicts) {
                if (conflicts.length > 0) {
                    $("#squeak").squirrelDialog("open", {
                        title: TX.warning(),
                        severity: "warning",
                        message: 
                        TX.tx("Conflicts were detected while merging actions from the Cloud. Please review these rejected actions before saving.")
                    });
                    $.each(conflicts, function(i, c) {
                        var e = c.conflict;
                        $("#squeak").squirrelDialog("squeakAdd", {
                            severity: "warning",
                            message: Hoard.stringify_action(e)
                                + ": " + c.message });
                    });
                }
                S.cloud.status = S.IS_LOADED;
                // Finished with the cloud hoard (for now)
                chain();
            });
    }

    // Determine if there are unsaved changes, and generate a warning
    // message for the caller to use.
    function unsaved_changes(max_changes) {
        var message = [];

        $(".tree-modified").each(function() {
            if (DEBUG && !$(this).data("path")
                && !$(this).hasClass("tree-root"))
                debugger; // Missing data-path
            var path = $(this).data("path") || "node";
            message.push(TX.tx("$1 has changed",
                               path.replace(S.PATHSEP, "/")));
        });

        if (message.length > max_changes) {
            var l = message.length;
            message = message.slice(0, max_changes);
            message.push(TX.tx("... and $1 more change$?($1!=1,s,)", l - 5));
        }

        if (S.cloud.status !== S.IS_LOADED) {
            message.unshift(TX.tx("The $1 hoard $2",
                                  S.cloud.store
                                  ? S.cloud.store.options().identifier
                                  : TX.tx("Cloud"),
                                  TX.tx(S.cloud.status)));
        }
        if (S.client.status !== S.IS_LOADED) {
            message.unshift(TX.tx("The $1 hoard $2",
                                  S.client.store.options().identifier,
                                  TX.tx(S.client.status)));
        }

        if (message.length === 0)
            return null;

        return message.join("\n");
    }

    function save_hoards() {
        $("#squeak").squirrelDialog("open", {
            title: TX.tx("Saving")
        });

        var client_ok = true;
        var cloud_ok = true;

        function finished() {
            if (DEBUG) console.debug("...save finished");
            Utils.sometime("update_save");
            if (client_ok && cloud_ok) {
                if (S.client.hoard.options.autosave)
                    $("#squeak").dialog("close");
                else
                    // Otherwise leave it open
                    $("#squeak").squirrelDialog("squeakAdd", TX.tx("Save complete"));

            } else {
                // Otherwise leave it open, disable auto-save
                $("#squeak").squirrelDialog("squeakAdd", {
                    severity: "error",
                    message: TX.tx("Save encountered errors")});
                S.client.hoard.options.autosave = false;
            }
        }

        function write_client_store() {
            S.client.store.writes(
                "S." + S.client.store.user(),
                JSON.stringify(S.client.hoard),
                function() {
                    if (DEBUG) console.debug("...client save OK");
                    $(".tree-modified").removeClass("tree-modified");
                    S.client.status = S.IS_LOADED;
                    $("#squeak").squirrelDialog("squeakAdd", 
                        TX.tx("Saved in $1", this.options().identifier));
                    finished();
                },
                function(e) {
                    if (DEBUG) console.debug("...client save failed " + e);
                    $("#squeak").squirrelDialog("squeakAdd", {
                        severity: "error",
                        message: TX.tx("Failed to save in $1: $2",
                                       this.options().identifier, e)
                    });
                    client_ok = false;
                    finished();
                });
        }

        function save_client() {
            if (DEBUG) console.debug("...save to client");

            if (S.client.status === S.IS_LOADED
                && $(".tree-modified").length === 0) {
                finished();
                return;
            }

            S.client.status = S.PENDING_SAVE;

            $("#squeak").squirrelDialog("squeakAdd", {
                severity: "while",
                message: TX.tx("Saving in $1",
                               S.client.store.options().identifier)});

            Utils.soon(write_client_store);
        }

        function write_cloud_store(cloard) {
            S.cloud.store.writes(
                S.client.hoard.options.store_path,
                JSON.stringify(cloard),
                function() {
                    if (DEBUG) console.debug("...cloud save OK");
                    S.client.hoard.actions = [];
                    S.client.hoard.last_sync = Date.now();
                    $("#squeak").squirrelDialog("squeakAdd", 
                        TX.tx("Saved in $1", this.options().identifier));
                    S.cloud.status = S.IS_LOADED;
                    save_client();
                },
                function(e) {
                    if (DEBUG) console.debug("...cloud save failed " + e);
                    $("#squeak").squirrelDialog("squeakAdd", {
                        severity: "error",
                        message: TX.tx("Failed to save in $1: $2",
                                       this.options().identifier, e)});
                    cloud_ok = false;
                    save_client();
                });
        }

        // Save the given hoard into the cloud.
        function update_cloud_store(cloard) {
            cloard.actions = cloard.actions.concat(S.client.hoard.actions);
            if (S.cloud.store) {
                if (DEBUG) console.debug("...save to cloud");

                $("#squeak").squirrelDialog("squeakAdd", {
                    severity: "while",
                    message: TX.tx("Saving in $1",
                                   S.cloud.store.options().identifier)});

                S.cloud.status = S.PENDING_SAVE;

                Utils.soon(function() { write_cloud_store(cloard); });
            } else {
                if (DEBUG) console.debug("...no cloud store");
                save_client();
            }
        }

        // Construct a new cloud hoard from data in the client. This will
        // happen if the cloud is read and found to be empty or corrupt,
        // but not if the read failed.
        function construct_new_cloud() {
            if (DEBUG) console.debug("...construct cloud ");
            var cloard = new Hoard();
            S.client.hoard.reconstruct_actions(
                function(a, next) {
                    cloard.actions.push({
                        type: a.type,
                        time: a.time,
                        data: a.data,
                        path: a.path.slice()
                    });
                    if (next)
                        next();
                },
                function() {
                    update_cloud_store(cloard);
                });
        }

        // Action on the cloud store being read OK
        function cloud_store_read_ok(data) {
            var cloard;
            if (DEBUG) console.debug("...cloud read OK ");
            try {
                cloard = new Hoard(JSON.parse(data));
                S.cloud.status = S.IS_LOADED;
            } catch (e) {
                // We'll get here if decryption failed....
                if (DEBUG) console.debug("Cloud hoard JSON parse failed: " + e);
                $("#squeak").squirrelDialog("squeakAdd", {
                    severity: "error",
                    message: TX.tx("$1 hoard can't be read for update",
                                   this.options().identifier)});
                S.cloud.status = S.IS_CORRUPT;
                cloud_ok = false;
                construct_new_cloud();
                return;
            }
            
            if (S.cloud.status === S.IS_LOADED) {
                if (DEBUG) console.debug("...merge cloud ");
                S.client.hoard.merge_from_cloud(
                    cloard, ST.action);
            }
            
            if ( S.cloud.status !== S.IS_LOADED
                 || S.client.hoard.actions.length !== 0) {
                // Only save if there actually some changes
                if (DEBUG) console.debug("...update from cloud ");
                update_cloud_store(cloard);
            } else
                Utils.soon(save_client);
        }

        // Action on the cloud store read failing
        function cloud_store_read_failed(e) {
            if (DEBUG) console.debug("...cloud read failed " + e);
            if (e === AbstractStore.NODATA) {
                if (DEBUG) console.debug(this.options().identifier + " contains NODATA");
                S.cloud.status = S.IS_EMPTY;
                construct_new_cloud();
            } else {
                $("#squeak").squirrelDialog("squeakAdd", {
                    severity: "error",
                    message: TX.tx("Failed to refresh from $1: $2",
                                   this.options().identifier, e)});
                cloud_ok = false;
                Utils.soon(save_client);
            }
        }

        if (DEBUG) console.debug("Saving; client " + S.client.status
                                 + "; cloud " + S.cloud.status);
        if (S.cloud.status === S.NEW_SETTINGS
            || S.cloud.status === S.IS_EMPTY) {
            // Don't attempt to resync out before saving, simply
            // overwrite the cloud.
            if (DEBUG) console.debug("...constructing new cloud because settings");
            construct_new_cloud();
        } else {
            // Reload and save the cloud hoard
            if (DEBUG) console.debug("...reloading cloud");
            S.cloud.store.reads(
                S.client.hoard.options.store_path,
                cloud_store_read_ok,
                cloud_store_read_failed);
        }
    }

    function update_save(/*event*/) {
        $("#authenticated_undo").toggle(ST.can_undo());
        $("#extras").squirrelDialog("get", "autosave").val(
            S.client.hoard.options.autosave ? "on" : "off");
        var us = unsaved_changes(3);
        var $sb = $("#authenticated_save");

        if (us !== null) {
            if (S.client.hoard.options.autosave) {
                save_hoards();
            } else {
                $sb.attr(
                    "title",
                    TX.tx("Save is required because: ") + us);
                $sb.show();
            }
        } else {
            $("#authenticated_save").hide();
        }
    }

    // Final step before allowing interaction
    function step_8_authenticated() {
        $("#whoami").text(S.client.store.user());
        $("#unauthenticated").hide();
        $("#authenticated").show();

        // Flush the sometimes, and allow new sometimes to be set
        Utils.sometime_is_now();
    }

    // Last in the initial hoard load sequence
    function step_7_hoards_loaded() {
        $(window).on("beforeunload", function() {
            var us = unsaved_changes(10);
            if (us !== null) {
                us = TX.tx("You have unsaved changes")
                    + "\n" + us
                    + "\n" + TX.tx("Are you really sure?");
                return us;
            }
        });

        Utils.sometime("update_save");
        Utils.sometime("check_alarms");

        // We are ready for interaction
        step_8_authenticated();
    }

    /**
     * STEP 6: Called when we have a (possibly empty) client hoard.
     *  Try and synch it from the cloud.
     */
    function step_6_load_cloud_hoard() {
        if (S.cloud.store) {
            if (DEBUG) console.debug(
                "Reading cloud " + S.cloud.store.options().identifier);
            S.cloud.store.reads(
                S.client.hoard.options.store_path,
                function(data) {
                    var hoard;
                    if (DEBUG) console.debug(this.options().identifier + " is ready");
                    try {
                        hoard = JSON.parse(data);
                    } catch (e) {
                        if (DEBUG) console.debug("Client hoard JSON parse failed: " + e);
                        $("#squeak").squirrelDialog("open", {
                            title: TX.error(),
                            severity: "error",
                            message:
                            TX.tx("$1 hoard exists, but can't be read.",
                                  this.options().identifier)
                                + " "
                                + TX.tx("Check that you have the correct password.")
                        });
                        S.cloud.status = S.IS_CORRUPT;
                        Utils.soon(step_7_hoards_loaded);
                        return;
                    }
                    //if (DEBUG) console.debug("Cloud hoard " + data);
                    get_updates_from_cloud(new Hoard(hoard), step_7_hoards_loaded);
                },
                function(e) {
                    if (e === AbstractStore.NODATA) {
                        if (DEBUG) console.debug(
                            this.options().identifier + " contains NODATA");
                        S.cloud.status = S.IS_EMPTY;
                    } else {
                        if (DEBUG) console.debug(
                            this.options().identifier + " has NODATA: " + e);
                        $("#squeak").squirrelDialog("open", {
                            title: TX.error(),
                            severity: "error",
                            message: TX.tx("Could not load cloud hoard.")
                        });
                        $("#squeak").squirrelDialog("squeakAdd", 
                            TX.tx("Check that you have the correct password."));
                        // Could not contact cloud; continue all the same
                    }
                    Utils.soon(step_7_hoards_loaded);
                });
        } else {
            step_7_hoards_loaded();
        }
    }

    /**
     * STEP 5: Called when there is no existing client hoard, to initialise
     * a new one.
     */
    function step_5_init_client_hoard() {
        if (DEBUG) console.debug("Setting up client hoard");
        S.client.hoard = new Hoard();
        S.client.status = S.IS_EMPTY;

        if (S.cloud.store && S.cloud.store.options().needs_path) {
            $("#store_settings").squirrelDialog("open", step_6_load_cloud_hoard);
        } else {
            step_6_load_cloud_hoard();
        }
    }

    /**
     * STEP 4: Once the stores have been initialised, we can load
     * the client hoard. This will give us the baseline cache data and the
     * location of the cloud hoard, so we can then chain loading and merging
     * the cloud hoard.
     */
    function step_4_load_client_hoard() {
        function rebuild_hoard() {
            if (DEBUG) console.debug("Reconstructing UI tree from cache");
            S.client.hoard.reconstruct_actions(
                function(a, next) {
                    ST.action(a, false, next);
                },
                function() { // on complete
                    // Reset the UI modification list; we just loaded the
                    // client hoard
                    $(".tree-modified").removeClass("tree-modified");
                    // Mark all the nodes in the pending actions list as
                    // modified. If a node isn't found, back up the tree
                    // until we find a parent that does exist and mark it.
                    var as = S.client.hoard.actions, i, p, $node;
                    for (i = 0; i < as.length; i++) {
                        p = as[i].path.slice();
                        while (p.length > 0) {
                            $node = ST.getNodeFromPath(p);
                            if ($node) {
                                $node.addClass("tree-modified");
                                break;
                            }
                            p.pop();
                        }
                    }
                    Utils.soon(step_6_load_cloud_hoard);
                });
        }

        if (DEBUG) console.debug("Load client store");

        S.client.store.reads(
            "S." + S.client.store.user(),
            function(data) {
                try {
                    S.client.hoard = new Hoard(JSON.parse(data));
                    S.client.status = S.IS_LOADED;
                } catch (e) {
                    if (DEBUG) console.debug("Caught " + e);
                    $("#squeak").squirrelDialog("open", {
                        title: TX.error(),
                        severity: "error",
                        message:
                        TX.tx("$1 hoard exists, but can't be read.",
                              this.options().identifier),
                        // After close, clear down and try again
                        after_close: function() {
                            Utils.sometime("init_application");
                        }
                    });
                    $("#squeak").squirrelDialog("squeakAdd", 
                        TX.tx("Check that you have the correct password."));
                    return;
                }
                // Make sure we have a store path
                if ((S.client.store
                     && S.client.store.options().needs_path
                     || S.cloud.store
                     && S.cloud.store.options().needs_path)
                    && !S.client.hoard.options.store_path) {
                    $("#store_settings").squirrelDialog("open", rebuild_hoard);
                } else {
                    rebuild_hoard();
                }
            },
            function(e) {
                if (e === AbstractStore.NODATA) {
                    if (DEBUG) console.debug(this.options().identifier + " contains NODATA");
                    // Construct a new client hoard
                    Utils.soon(step_5_init_client_hoard);
                } else {
                    $("#squeak").squirrelDialog("open", {
                        title: TX.error(),
                        severity: "error",
                        message: TX.tx("$1 store error: $2",
                                       this.options().identifier, e),
                        after_close: function() {
                            Utils.sometime("init_application");
                        }
                    });
                }
            });
    }

    /**
     * STEP 3: Login, fill in details the stores didn't provide, prompt
     * is needed.
     */
    function step_3_identify_user() {
        var uReq = true;
        var pReq = true;

        // Spread user information determined during store initialisation
        // around.
        if (S.cloud.store
            && typeof S.cloud.store.user() !== "undefined") {
            // Force the cloud user onto the client store
            if (DEBUG) console.debug("Cloud user is preferred: " + S.cloud.store.user());
            S.client.store.user(S.cloud.store.user());
            uReq = false;
        } else if (S.client.store
                   && typeof S.client.store.user() !== "undefined") {
            // Force the client user onto the cloud store
            if (DEBUG) console.debug("Client user is available: " + S.client.store.user());
            if (S.cloud.store)
                S.cloud.store.user(S.client.store.user());
            uReq = false;
        }

        if (S.cloud.store
            && typeof S.cloud.store.pass() !== "undefined") {
            // Force the cloud pass onto the client store
            if (DEBUG) console.debug("Cloud pass is preferred");
            if (S.client.store)
                S.client.store.pass(S.cloud.store.pass());
            pReq = false;
        } else if (S.client.store
                   && typeof S.client.store.pass() !== "undefined") {
            // Force the client pass onto the cloud store
            if (DEBUG) console.debug("Client pass is available");
            if (S.cloud.store)
                S.cloud.store.pass(S.client.store.pass());
            pReq = false;
        }

        // If we still need user or password, prompt
        if (uReq || pReq) {
            $("#login").squirrelDialog("open", {
                store: S.client.store,
                on_signin: function(user, pass) {
                    if (DEBUG) console.debug("Login prompt said user was " + user);
                    S.client.store.user(user);
                    S.client.store.pass(pass);
                    if (S.cloud.store) {
                        S.cloud.store.user(user);
                        S.cloud.store.pass(pass);
                    }
                    step_4_load_client_hoard();
                },
                user_required: uReq,
                pass_required: pReq
            });
        } else
            step_4_load_client_hoard();
    }

    /**
     * STEP 2: Once the cloud store is loaded, we can move on to the client store.
     */
    function step_2_init_client_store() {
        // new LocalStorageStore({
        new EncryptedStore({
            understore: function(params) {
                return new LocalStorageStore(params);
            },

            ok: function() {
                if (DEBUG) console.debug(this.options().identifier
                                         + " store is ready");
                S.client.store = this;
                $("#authmessage").text(TX.tx("Loading..."));
                // Chain the login prompt
                Utils.soon(step_3_identify_user);
            },
            fail: function(e) {
                // We did our best!
                $("#squeak").squirrelDialog("open", {
                    title: TX.error(),
                    severity: "error",
                    message: TX.tx("Encryption error: $1", e)
                });
            }
        });
    }

    /**
     * STEP 1: Establish contact with the cloud, and get user details.
     */
    function step_1_init_cloud_store() {
        var p = {
            ok: function() {
                S.cloud.store = this;
                // Chain the client store startup
                Utils.soon(step_2_init_client_store);
            },
            fail: function(e) {
                $("#squeak").squirrelDialog("open", {
                    title: TX.warning(),
                    severity: "warning",
                    message: TX.tx("Could not open cloud store: $1", e),
                    after_close: function() {
                        step_2_init_client_store();
                    }
                });
                $("#squeak").squirrelDialog("squeakAdd", {
                    severity: "warning",
                    message: TX.tx("If you continue, only the client store will be available")
                });
            }
        };

        p.understore = function(pp) {
            // SQUIRREL_STORE is a constant set by the low-level
            // store module selected by dynamic load
            if (S.USE_STEGANOGRAPHY) {
                pp.understore = function(ppp) {
                    return new SQUIRREL_STORE(ppp);
                };
                return new StegaStore(pp);
            } else {            
                return new SQUIRREL_STORE(pp);
            }
        };

        return new EncryptedStore(p);
    }

    function before_menu_open(e, ui) {
        var $node = (ui.target.is(".tree-node"))
            ? ui.target
            : ui.target.closest(".tree-node");

        var has_alarm = typeof $node.data("alarm") !== "undefined";
        var is_leaf = $node.hasClass("tree-leaf");
        var is_root = ui.target.closest(".tree-node").hasClass("tree-root");
        var is_open = $node.hasClass("tree-open");
        var $root = $("body");
        
        if (DEBUG) console.debug("contextmenu on " + $node.data("key")
                                 + " " + is_leaf);
        $root
            .contextmenu("showEntry", "add_alarm",
                         !has_alarm && !is_root)
            .contextmenu("showEntry", "add_subtree",
                         is_open && !is_leaf)
            .contextmenu("showEntry", "add_value",
                         is_open && !is_leaf && !is_root)
            .contextmenu("showEntry", "copy_value", is_leaf)
            .contextmenu("showEntry", "delete", !is_root)
            .contextmenu("showEntry", "edit", is_leaf)
            .contextmenu("showEntry", "insert_copy",
                         !is_leaf && (typeof S.clipboard !== "undefined"))
            .contextmenu("showEntry", "make_copy",
                         !is_root && !is_leaf)
            .contextmenu("showEntry", "pick_from", is_leaf)
            .contextmenu("showEntry", "randomise", is_leaf)
            .contextmenu("showEntry", "rename", !is_root);

        S.$menuTarget = $node;
    }

    /**
     * Handler for context menu items
     */
    function handle_menu_choice(e, ui) {
        var $node = S.$menuTarget;
        
        if (!$node) {
            if (DEBUG) console.debug("No node for contextmenu>" + ui.cmd);
            return;
        }

        switch (ui.cmd) {
        case "copy_value":
            S.clipboard = $node.find(".tree-value:first").text();
            break;

        case "make_copy":
            var p = $node.tree("get_path");
            var n = S.client.hoard.get_node(p);
            S.clipboard = JSON.stringify(n);
            break;

        /* Can't get it to work like this - would need an intermediate
           element that a Ctrl+V event happens on.
        case "paste":
            document.designMode = "on";
            $(window).on("paste", function(e) {
var   systemPasteContent = 
    e.clipboardData.getData('text/plain');
                debugger;
            });
            $("#pasteboard").focus();
            document.execCommand("Paste");
            debugger;
            break;
        /**/

        case "insert_copy":
            if (S.clipboard) {
                try {
                    var data = JSON.parse(S.clipboard);
                    $("#insert").squirrelDialog("open", {$node: $node, data: data } );
                } catch (e) {
                    if (DEBUG) debugger;
                }
            }
            break;

        case "rename":
            if (DEBUG) console.debug("Renaming");
            $node.tree("edit", ".tree-key");
            break;

        case "edit":
            if (DEBUG) console.debug("Editing");
            $node.tree("edit", ".tree-value");
            break;

        case "add_value":
            $("#add").squirrelDialog("open", {$node: $node, is_value: true});
            break;

        case "add_subtree":
            $("#add").squirrelDialog("open", {$node: $node, is_value: false});
            break;

        case "randomise":
            if (DEBUG) console.debug("Randomising");
            $("#randomise").squirrelDialog("open", { $node: $node });
            break;

        case "add_alarm":
            if (DEBUG) console.debug("Adding reminder");
            $("#alarm").squirrelDialog("open", { $node: $node });
            break;

        case "delete":
            if (DEBUG) console.debug("Deleting");
            $("#delete").squirrelDialog("open", { $node: $node });
            break;

        case "pick_from":
            if (DEBUG) console.debug("Picking");
            $("#pick").squirrelDialog("open", {$node: $node});
            break;

        default:
            if (DEBUG) debugger;
        }
    }

    function init_menus() {
        var menu = {
            delegate: ".tree-title",
            menu: [
                {
                    title: TX.tx("Copy value"),
                    cmd: "copy_value",
                    uiIcon: "ui-icon-squirrel-copy squirrel-icon"
                },
                /* Can't get it to work
                {
                    title: TX.tx("Paste"),
                    cmd: "paste",
                    uiIcon: "ui-icon-squirrel-paste squirrel-icon"
                },
                /**/
                {
                    title: TX.tx("Pick characters"),
                    cmd: "pick_from",
                    uiIcon: "ui-icon-squirrel-pick squirrel-icon"
                },
                {
                    title: TX.tx("Rename"),
                    cmd: "rename",
                    uiIcon: "ui-icon-squirrel-edit squirrel-icon"
                },
                {
                    title: TX.tx("Edit value"),
                    cmd: "edit",
                    uiIcon: "ui-icon-squirrel-edit squirrel-icon"
                },
                {
                    title: TX.tx("Add reminder"),
                    cmd: "add_alarm",
                    uiIcon: "ui-icon-squirrel-alarm squirrel-icon" 
                },
                {
                    title: TX.tx("Generate new random value"),
                    cmd: "randomise",
                    uiIcon: "ui-icon-squirrel-key squirrel-icon" 
                },               
                {
                    title: TX.tx("Add new value"),
                    cmd: "add_value",
                    uiIcon: "ui-icon-squirrel-add-value squirrel-icon" 
                },
                {
                    title: TX.tx("Add new folder"),
                    cmd: "add_subtree",
                    uiIcon: "ui-icon-squirrel-add-folder squirrel-icon" 
                },
                {
                    title: TX.tx("Copy folder"),
                    cmd: "make_copy",
                    uiIcon: "ui-icon-squirrel-copy squirrel-icon"
                },
                {
                    title: TX.tx("Insert copy of folder"),
                    cmd: "insert_copy",
                    uiIcon: "ui-icon-squirrel-paste squirrel-icon"
                },
                {
                    title: TX.tx("Delete"),
                    cmd: "delete",
                    uiIcon: "ui-icon-squirrel-delete squirrel-icon" 
                }
            ],
            preventContextMenuForPopup: true,
            preventSelect: true,
            taphold: true,
            beforeOpen: before_menu_open,
            select: handle_menu_choice
        };

        $("body").contextmenu(menu);

        S.valueCopyClipboard = new Clipboard(".ui-contextmenu li[data-command='copy_value']", {
            text: function() {
                var $node = S.$menuTarget;
                if (DEBUG) console.debug("clip val from: " +
                                         $node.data("key"));
                return $node.find(".tree-value:first").text();
            }
        });
        
        S.treeCopyClipboard = new Clipboard(".ui-contextmenu li[data-command='make_copy']", {
            text: function() {
                var $node = S.$menuTarget;
                if (DEBUG) console.debug("clip json from: " +
                                         $node.data("key"));
                var p = $node.tree("getPath");
                var n = S.client.hoard.get_node(p);
                return JSON.stringify(n);
            }
        });
/* Should zeroClipboard ever prove necessary, here are the bits
        S.zeroClipboards.addClipboard({
            selector: ".ui-contextmenu li[data-command='copy_value']",
            handler: function() {
                var $node = S.$menuTarget;
                if (DEBUG) console.debug("clip val from: " +
                                         $node.data("key"));
                return {
                    data: $node.find(".tree-value:first").text(),
                    contentType: "text/plain"
                };
            }
        });
        S.zeroClipboards.addClipboard({
            selector: ".ui-contextmenu li[data-command='make_copy']",
            handler: function() {
                var $node = S.$menuTarget;
                if (DEBUG) console.debug("clip json from: " +
                                         $node.data("key"));
                var p = $node.tree("getPath");
                var n = S.client.hoard.get_node(p);
                return {
                    data: JSON.stringify(n),
                    contentType: "text/json"
                }
            }
        });
*/
    }
 
    /**
     * Initialise application data (new Squirrel(), effectively)
     */
    function init_application() {
        // status may be one of IS_EMPTY, IS_CORRUPT, IS_LOADED or
        // NEW_SETTINGS. If the status is anything but IS_LOADED
        // then it is a candidate for saving.
        S.client = {
            store: null,                 // The store used actively
            hoard: null,                 // The hoard in that store
            status: S.IS_EMPTY
        };

        S.cloud = {
            store: null,                 // Temporary memory used during load
            status: S.IS_EMPTY
        };

        // Kick off by initialising the cloud store.
        step_1_init_cloud_store();
    }

    function init_ui() {

        $("#authenticated_save")
            .hide()
            .on($.getTapEvent(), function(/*evt*/) {
                save_hoards();
                return false;
            });

        $("#authenticated_undo")
            .hide()
            .on($.getTapEvent(), function(/*evt*/) {
                ST.undo(function(mess) {
                    $("#squeak").squirrelDialog("open", {
                        title: "Undo",
                        message: mess
                    });
                });
                return false;
            });

        $("#authenticated_extras")
            .on($.getTapEvent(), function(/*evt*/) {
                $("#extras").squirrelDialog("open");
            });

        $("#search")
            .on("change", function(/*evt*/) {
                $("#search_hits").text(TX.tx("Searching..."));
                S.search($(this).val());
            });

        $("#search_button")
            .on($.getTapEvent(), function(/*evt*/) {
                $("#search_hits").text(TX.tx("Searching..."));
                S.search($("#search").val());
            });

        $("#authenticated_search")
            .on($.getTapEvent(), function(/*evt*/) {
                $("#search").squirrelDialog("open");
            });
        
        $(".help").each(function() {
            var $this = $(this);
            $this.hide();
            var $help = $("<button></button>");
            var $close = $("<button></button>");
            $help
                .addClass("info-button")
                .button({
                    icons: {
                        primary: "ui-icon-info"
                    },
                    text: false
                })
                .on($.getTapEvent(), function() {
                    $this.show();
                    $help.hide();
                })
                .insertBefore(this);
            $close
                .addClass("help-close")
                .button({
                    icons: {
                        primary: "ui-icon-circle-close"
                    },
                    text: false
                })
                .on($.getTapEvent(), function() {
                    $this.hide();
                    $help.show();
                })
                .prependTo($this);
        });

        $("button").each(function() {
            var $this = $(this);
            var opts;

            if (typeof $this.data("icon") !== "undefined") {
                opts = {
                    icons: {
                        primary: $this.data("icon")
                    },
                    classes: {
                        "ui-button-icon": "squirrel-icon"
                    },
                    text: false
                };
            }
            $this.button(opts);
        });

        $("#sites-node").tree({
            is_root: true
        });
        init_menus();

        // Set up event handlers for sometime scheduler
        $(document)
            .on("init_application", init_application)
            .on("check_alarms", check_alarms)
            .on("update_save", update_save)
            .on("reset_styling", reset_styling);
        reset_styling();
        
        Utils.sometime_is_now();
    }

    /**
     * A (manual) new tree node action
     */
    S.add_child_node = function($node, title, value) {
        var p = $node.tree("getPath");
        p.push(title);

        var res = S.client.hoard.record_action(
            {
                type: "N",
                path: p,
                data: (typeof value === "string") ? value : undefined
            },
            function(e) {
                ST.action(
                    e, true,
                    function($newnode) {
                        if (DEBUG && !$newnode) debugger;
                        if (typeof value !== "string"
                            && typeof value !== "undefined") {
                            S.insert_data($newnode.tree("getPath"), value);
                        }
                        $newnode.tree("open");
                        Utils.sometime("update_save");
                    });
            });
        if (res !== null)
            $("#squeak").squirrelDialog("open", res.message);
    };

    /**
     * Perform a text search
     */
    S.search = function(s) {
        var re;
        try {
            re = new RegExp(s, "i");
        } catch (e) {
            $("#squeak").squirrelDialog("open", 
                {
                    message: TX.tx("Error in search expression '$1': ", s)
                        + e
                });
        }
        var hits = [];
        $(".tree-key,.tree-value").each(function() {
            if ($(this).text().match(re)) {
                hits.push(this);
            }
        });

        $("#search_hits").text(TX.tx("$1 found", hits.length));
        if (hits.length === 0) {
            $("#squeak").squirrelDialog("open", 
                {
                    message: TX.tx("'$1' not found", s)
                });
        } else {
            $(".tree-open").each(function() {
                $(this).tree("close");
            });
            $.each(hits, function(n, v) {
                $(v).parents(".tree-collection").each(function() {
                    $(this).tree("open");
                });
            });
        }
    };

    /**
     * Insert data from a structure under the given path
     * @param path path to the parent below which this data will be inserted
     * @param data hoard cache format data
     */
    S.insert_data = function(path, data) {
        $("#squeak").squirrelDialog("open", { title: "Loading" });

        S.client.hoard.actions_from_hierarchy(
            { data: data },
            function(act, next) { // listener
                //if (DEBUG) console.debug(Hoard.stringify_action(act));
                act.path = path.slice().concat(act.path);
                var res = S.client.hoard.record_action(
                    act, function (sact) {
                        ST.action(sact, false, next);
                    });
                if (res !== null)
                    $("#squeak").squirrelDialog("squeakAdd", res.message);
                if (next)
                    next();
            },
            function() { // chain on complete
                Utils.sometime("update_save");
                $("#squeak").squirrelDialog(
                    "squeakAdd",
                    TX.tx("JSON has been loaded"));
            });
    };

    // on ready
    $(function() {
        var qs = Utils.query_string();

        // Use uncompressed if the current document is uncompressed
        var unco = !/\.min\.html/.test(document.location.href);

        if (qs.debug)
            DEBUG = true;

        // By default, jQuery timestamps datatype 'script' and 'jsonp'
        // requests to avoid them being cached by the browser.
        // Disable this functionality by default so that as much as
        // possible is cached locally
        if (!DEBUG) $.ajaxSetup({ cache: true });

        console.log("Device is " + window.screen.width + " X " +
                    window.screen.height + " Body is " +
                    $("body").width() + " X " + $("body").height());
        
        var theme = Cookies.get("ui_theme");
        if (theme && theme !== "base")
            S.setTheme(theme);
        
        // width is really 580 css px
        //$("body").width(window.screen.width);

        // Menu is built; attach ZeroClipboards (if available)
        //S.zeroClipboards = new ZeroClipboardShim();

        var store = qs.store || "TestStore";
        if (typeof qs.steg !== "undefined")
            S.USE_STEGANOGRAPHY = true;

        var store_bits = [ "js/" + store + ".min.js" ];
        if (S.USE_STEGANOGRAPHY) {
            store_bits.push("js/Steganographer.min.js");
            store_bits.push("js/StegaStore.min.js");
        } else
            $(".using_steganography").remove();
        Utils.load(store_bits, unco, function () {
            // Initialise translation module,
            // and chain the application init
            TX.init(function() {
                // Initialise UI components
                init_ui();
                init_application();
            });
        });
        $(".dlg-dialog").squirrelDialog({autoOpen: false});
        
        //$(this).tooltip(); // visually messy
        // mobile device; though shouldn't we determine the size?
        // window.screen.width, window.screen.height
    });

})(jQuery, Squirrel);
