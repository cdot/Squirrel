/*@preserve Copyright (C) 2015-2017 Crawford Currie http://c-dot.co.uk license MIT*/

/* eslint-env jquery */
/* global global:true */
/* global TX */
/* global Utils */
/* global Cookies */
/* global ClipboardJS */
/* global AbstractStore */
/* global EncryptedStore */
/* global LocalStorageStore */
/* global StegaStore */
/* global Hoard */
/* global UNMINIFIED */

/*
 * The Squirrel Application namespace and UI.
 */

// Exports
var Squirrel = {
    // Store statii
    // TX.tx("has new settings")
    NEW_SETTINGS: "has new settings",
    // TX.tx("is loaded")
    IS_LOADED: "is loaded",
    // TX.tx("is corrupt")
    IS_CORRUPT: "is corrupt",
    // TX.tx("is empty")
    IS_EMPTY: "is empty"
};

(function ($, S) {
    "use strict";

    // Functions that are private to this module are declared as
    // function name(). Exported functions are declared as
    // S.name = function()

    // Internal clipboard
    var clipboard;

    // flags
    var useSteganography = false;
    var dump_cloud = false;

    // undo stack
    var undos = [];

    // Pointer to tree widget at root of DOM tree
    var DOMtree;

    // Node that is the target of a context menu operation
    var $menuTarget;

    // For unknown reasons, we get a taphold event on mobile devices
    // even when a taphold hasn't happened. So we have to selectively
    // disable the context menu :-(
    var contextMenuDisables = 0;

    // status may be one of IS_EMPTY, IS_CORRUPT, IS_LOADED or
    // NEW_SETTINGS. If the status is anything but IS_LOADED
    // then it is a candidate for saving.
    var client = {
        store: null, // The store used actively
        hoard: null, // The hoard in that store
        status: S.IS_EMPTY
    };

    var cloud = {
        store: null, // Temporary memory used during load
        hoard: null, // The hoard in that store
        status: S.IS_EMPTY
    };

    // Special keys in sort ordering
    var sort_prio = [
        TX.tx("A new folder"),
        TX.tx("A new value"),
        TX.tx("User"),
        TX.tx("Pass")
    ];

    S.squeak = function (e) {
        $("#squeak_dlg")
            .squirrelDialog("open", e);
    };

    S.theme = function (theme) {
        if (typeof theme !== "undefined") {
            $("link")
                .filter(function () {
                    return this.href && this.href.indexOf("/themes/") > 0;
                })
                .each(function () {
                    this.href = this.href.replace(
                        /\/themes\/[^\/]+/, "/themes/" + theme);
                    $(this)
                        .replaceWith($(this));
                    Utils.sometime("reset_styling");
                });
            if (theme === "base") {
                Cookies.remove("ui_theme");
            } else {
                Cookies.set("ui_theme", theme, {
                    expires: 365
                });
            }
        }
        return Cookies.get("ui_theme");
    };

    S.scale = function (scale) {
        if (typeof scale !== "undefined") {
            if (scale > 6) { // don't go below 6px
                $("body")
                    .css("font-size", scale + "px");
                Cookies.set("ui_scale", scale, {
                    expires: 365
                });
            }
        }
        return Cookies.get("ui_scale");
    };

    S.zoom = function (factor) {
        var now = $("body")
            .css("font-size");
        now = now.replace(/px/, "");
        S.scale(Math.round(factor * parseInt(now)));
    };

    S.autosave = function (on) {
        if (typeof on !== undefined) {
            var ons = (on ? "on" : "off");
            if (Cookies.get("ui_autosave") !== ons) {
                Cookies.set("ui_autosave", ons, {
                    expires: 365
                });
                Utils.sometime("update_save");
            }
        }
        return Cookies.get("ui_autosave");
    };

    /**
     * Custom key comparison, such that these keys always bubble
     * to the top of the keys
     */
    S.compare = function (a, b) {
        if (a == b)
            return 0;
        for (var i = 0; i < sort_prio.length; i++) {
            if (a == sort_prio[i])
                return -1;
            if (b == sort_prio[i])
                return 1;
        }
        return (a < b) ? -1 : 1;
    };


    // Event handler for check_alarms
    function check_alarms( /* event */ ) {
        client.hoard.check_alarms(
            function (path, expired, next) {
                var $node = DOMtree.getNodeFromPath(path);
                $node.tree("ringAlarm");
                S.squeak({
                    severity: "warning",
                    message: "<div class='ui-icon squirrel-icon-rang'></div>" +
                        TX.tx("Reminder on '$1' was due on $2",
                            path.join("↘"),
                            expired.toLocaleDateString()),
                    after_close: next
                });
            });
    }

    function get_updates_from_cloud(chain) {
        // This will get triggered whenever both hoards are
        // successfully loaded.
        if (global.DEBUG) console.debug("Merging from cloud hoard");
        var conflicts = client.hoard.play_actions(
            cloud.hoard.actions,
            function (e) {
                // this:Hoard, e:Action
                DOMtree.action(e);
            },
            function (percent) {
                $("#merge_progress")
                    .text(percent + "%");
            });
        if (conflicts.length > 0) {
            S.squeak({
                title: TX.tx("Warning"),
                severity: "warning",
                message: TX.tx("Conflicts were detected while merging actions from the Cloud.") +
                    " " +
                    TX.tx("Please review these rejected actions before saving.")
            });
            $.each(conflicts, function (i, c) {
                var e = c.conflict;
                $("#squeak_dlg")
                    .squirrelDialog("squeakAdd", {
                        severity: "warning",
                        message: Hoard.stringify_action(e) +
                            ": " + c.message
                    });
            });
        }
        cloud.status = S.IS_LOADED;
        // Finished with the cloud hoard (for now)
        chain();
    }

    // Determine if there are unsaved changes, and generate a warning
    // message for the caller to use.
    function unsaved_changes(max_changes) {
        var message = [];

        $(".tree-modified")
            .each(function () {
                if (global.DEBUG && !$(this)
                    .tree("getPath") &&
                    !$(this)
                    .hasClass("tree-root"))
                    debugger; // Missing data-path
                var path = $(this)
                    .data("path") || [];
                message.push(TX.tx("$1 has changed",
                    path.join("↘")));
            });

        if (message.length > max_changes) {
            var l = message.length;
            message = message.slice(0, max_changes);
            message.push(TX.tx("... and $1 more change$?($1!=1,s,)", l - 5));
        }

        if (cloud.status !== S.IS_LOADED) {
            message.unshift(TX.tx("The $1 hoard $2",
                cloud.store ?
                cloud.store.options()
                .identifier :
                TX.tx("Cloud"),
                TX.tx(cloud.status)));
        }
        if (client.status !== S.IS_LOADED) {
            message.unshift(TX.tx("The $1 hoard $2",
                client.store.options()
                .identifier,
                TX.tx(client.status)));
        }

        if (message.length === 0)
            return null;

        return message.join("\n");
    }

    var client_ok = true;
    var cloud_ok = true;

    function finished() {
        if (global.DEBUG) console.debug("...save finished");
        Utils.sometime("update_save");
        if (client_ok && cloud_ok) {
            if (Cookies.get("ui_autosave") === "on")
                $("#squeak_dlg")
                .squirrelDialog("close");
            else
                // Otherwise leave it open
                $("#squeak_dlg")
                .squirrelDialog("squeakAdd", TX.tx("Save complete"));

        } else {
            // Otherwise leave it open, disable auto-save
            $("#squeak_dlg")
                .squirrelDialog("squeakAdd", {
                    severity: "error",
                    message: TX.tx("Save encountered errors")
                });
            Cookies.set("ui_autosave", "off", {
                expires: 365
            });
        }
    }

    function write_client_store() {
        client.store.writes(
            "S." + client.store.user(),
            JSON.stringify(client.hoard),
            function () {
                if (global.DEBUG) console.debug("...client save OK");
                $(".tree-modified")
                    .removeClass("tree-modified");
                client.status = S.IS_LOADED;
                $("#squeak_dlg")
                    .squirrelDialog("squeakAdd",
                        TX.tx("Saved in $1", this.options()
                            .identifier));
                finished();
            },
            function (e) {
                if (global.DEBUG) console.debug("...client save failed " + e);
                $("#squeak_dlg")
                    .squirrelDialog("squeakAdd", {
                        severity: "error",
                        message: TX.tx("Failed to save in $1: $2",
                            this.options()
                            .identifier, e)
                    });
                client_ok = false;
                finished();
            });
    }

    function save_client() {
        if (global.DEBUG) console.debug("...save to client");

        if (client.status === S.IS_LOADED &&
            $(".tree-modified")
            .length === 0) {
            finished();
            return;
        }

        client.status = S.PENDING_SAVE;

        $("#squeak_dlg")
            .squirrelDialog("squeakAdd", {
                severity: "while",
                message: TX.tx("Saving in $1",
                    client.store.options()
                    .identifier)
            });

        Utils.soon(write_client_store);
    }

    function write_cloud_store() {
        // Cloud doesn't need the cache. Could kill it, but it's
        // small and there's not much advantage to doing so.

        cloud.store.writes(
            client.hoard.options.store_path,
            JSON.stringify(cloud.hoard),
            function () {
                if (global.DEBUG) console.debug("...cloud save OK");
                client.hoard.actions = [];
                client.hoard.last_sync = Date.now();
                $("#squeak_dlg")
                    .squirrelDialog("squeakAdd",
                        TX.tx("Saved in $1", this.options()
                            .identifier));
                cloud.status = S.IS_LOADED;
                save_client();
            },
            function (e) {
                if (global.DEBUG) console.debug("...cloud save failed " + e);
                $("#squeak_dlg")
                    .squirrelDialog("squeakAdd", {
                        severity: "error",
                        message: TX.tx("Failed to save in $1: $2",
                            this.options()
                            .identifier, e)
                    });
                cloud_ok = false;
                save_client();
            });
    }

    // Save the given hoard into the cloud.
    function update_cloud_store(ready) {
        cloud.hoard.actions = cloud.hoard.actions.concat(
            client.hoard.actions);
        if (cloud.store) {
            if (global.DEBUG) console.debug("...save to cloud");

            $("#squeak_dlg")
                .squirrelDialog("squeakAdd", {
                    severity: "while",
                    message: TX.tx("Saving in $1",
                        cloud.store.options()
                        .identifier)
                });

            cloud.status = S.PENDING_SAVE;

            Utils.soon(function () {
                write_cloud_store();
            });
        } else {
            if (global.DEBUG) console.debug("...no cloud store");
            if (ready)
                ready();
        }
    }

    // Construct a new cloud hoard from data in the client. This will
    // happen if the cloud is read and found to be empty or corrupt,
    // but not if the read failed.
    S.construct_new_cloud = function (progress, ready) {
        if (global.DEBUG) console.debug("...construct cloud ");
        cloud.hoard = new Hoard();
        client.hoard.reconstruct_actions(
            function (a, next) {
                // this:Hoard, a:Action, next:function
                cloud.hoard.actions.push({
                    type: a.type,
                    time: a.time,
                    data: a.data,
                    path: a.path.slice()
                });
                if (next)
                    next();
            },
            progress,
            function () {
                update_cloud_store(ready);
            });
    };

    // Action on the cloud store being read OK
    function cloud_store_read_ok(data) {
        if (global.DEBUG) console.debug("...cloud read OK ");
        try {
            cloud.hoard = new Hoard(data);
            cloud.status = S.IS_LOADED;
        } catch (e) {
            // We'll get here if decryption failed....
            if (global.DEBUG) console.debug("Cloud hoard JSON parse failed: " + e);
            $("#squeak_dlg")
                .squirrelDialog("squeakAdd", {
                    severity: "error",
                    message: TX.tx("$1 hoard can't be read for update",
                        this.options()
                        .identifier)
                });
            cloud.status = S.IS_CORRUPT;
            cloud_ok = false;
            S.construct_new_cloud();
            return;
        }

        if (cloud.status === S.IS_LOADED) {
            if (global.DEBUG) console.debug("...merge cloud ");
            /*var conflicts = */
            client.hoard.play_actions(
                cloud.hoard.actions,
                function (e) {
                    // this:Hoard, e:Action
                    DOMtree.action(e);
                },
                function (percent) {
                    $("#merge_progress")
                        .text(percent + "%");
                });
        }

        if (cloud.status !== S.IS_LOADED ||
            client.hoard.actions.length !== 0) {
            // Only save if there actually some changes
            if (global.DEBUG) console.debug("...update from cloud: " + cloud.status);
            update_cloud_store(save_client);
        } else
            Utils.soon(save_client);
    }

    // Action on the cloud store read failing
    function cloud_store_read_failed(e) {
        if (global.DEBUG) console.debug("...cloud read failed " + e);
        if (e === AbstractStore.NODATA) {
            if (global.DEBUG) console.debug(this.options()
                .identifier + " contains NODATA");
            cloud.status = S.IS_EMPTY;
            S.construct_new_cloud();
        } else {
            $("#squeak_dlg")
                .squirrelDialog("squeakAdd", {
                    severity: "error",
                    message: TX.tx("Failed to refresh from $1: $2",
                        this.options()
                        .identifier, e)
                });
            cloud_ok = false;
            Utils.soon(save_client);
        }
    }

    function save_hoards() {
        S.squeak({
            title: TX.tx("Saving")
        });

        client_ok = true;
        cloud_ok = true;

        if (global.DEBUG) console.debug("Saving; client " + client.status +
            "; cloud " + cloud.status);
        if (cloud.status === S.NEW_SETTINGS ||
            cloud.status === S.IS_EMPTY) {
            // Don't attempt to resync out before saving, simply
            // overwrite the cloud.
            if (global.DEBUG) console.debug("...constructing new cloud because settings");
            S.construct_new_cloud();
        } else {
            // Reload and save the cloud hoard
            if (global.DEBUG) console.debug("...reloading cloud");
            cloud.store.reads(
                client.hoard.options.store_path,
                cloud_store_read_ok,
                cloud_store_read_failed);
        }
    }

    function update_save( /*event*/ ) {
        $("#undo_button")
            .toggle(S.can_undo());
        var us = unsaved_changes(3);
        var $sb = $("#save_button");

        if (us !== null) {
            if (Cookies.get("ui_autosave") === "on") {
                save_hoards();
            } else {
                $sb.attr(
                    "title",
                    TX.tx("Save is required because") + ": " + us);
                $sb.show();
            }
        } else {
            $sb.hide();
        }
    }

    // Final step before allowing interaction
    function step_8_authenticated() {
        $("#whoami")
            .text(client.store.user());
        $("#unauthenticated")
            .hide();
        $("#authenticated")
            .show();

        // Flush the sometimes, and allow new sometimes to be set
        Utils.sometime_is_now();
    }

    // Last in the initial hoard load sequence
    function step_7_hoards_loaded() {
        $(window)
            .on("beforeunload", function () {
                var us = unsaved_changes(10);
                if (us !== null) {
                    us = TX.tx("You have unsaved changes") +
                        "\n" + us +
                        "\n" + TX.tx("Are you really sure?");
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
     * Try and synch it from the cloud.
     */
    function step_6_load_cloud_hoard() {
        if (cloud.store) {
            $("#stage")
                .text(TX.tx("Reading from cloud"));
            cloud.store.reads(
                client.hoard.options.store_path,
                function (data) {
                    if (global.DEBUG) console.debug(
                        this.options()
                        .identifier + " is ready");
                    try {
                        cloud.hoard = new Hoard(data);
                        if (global.DEBUG && dump_cloud)
                            console.debug(JSON.stringify(cloud.hoard));
                    } catch (e) {
                        if (global.DEBUG) console.debug(
                            "Cloud hoard JSON parse failed: " + e);
                        S.squeak({
                            title: TX.tx("Error"),
                            severity: "error",
                            message: TX.tx("$1 hoard exists, but can't be read.",
                                    this.options()
                                    .identifier) +
                                " " +
                                TX.tx("Check that you have the correct password.")
                        });
                        cloud.status = S.IS_CORRUPT;
                        Utils.soon(step_7_hoards_loaded);
                        return;
                    }
                    //if (global.DEBUG) console.debug("Cloud hoard " + data);
                    get_updates_from_cloud(step_7_hoards_loaded);
                },
                function (e) {
                    if (e === AbstractStore.NODATA) {
                        if (global.DEBUG) console.debug(
                            this.options()
                            .identifier + " contains NODATA");
                        cloud.status = S.IS_EMPTY;
                    } else {
                        if (global.DEBUG) console.debug(
                            this.options()
                            .identifier + " has NODATA: " + e);
                        S.squeak({
                            title: TX.tx("Error"),
                            severity: "error",
                            message: TX.tx("Could not load cloud store")
                        });
                        $("#squeak_dlg")
                            .squirrelDialog("squeakAdd",
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
        if (global.DEBUG) console.debug("Setting up client hoard");
        client.hoard = new Hoard();
        client.status = S.IS_EMPTY;

        if (cloud.store && cloud.store.options()
            .needs_path) {
            $("#store_settings_dlg")
                .squirrelDialog(
                    "open", step_6_load_cloud_hoard);
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
            $("#stage")
                .text(TX.tx("Building UI"));
            client.hoard.reconstruct_actions(
                function (a, next) {
                    // this:Hoard, a:Action, next:function
                    DOMtree.action(a, null, next);
                },
                function (percent) {
                    $("#load_progress")
                        .text(percent + '%');
                },
                function () { // on complete
                    // Reset the UI modification list; we just loaded the
                    // client hoard
                    $(".tree-modified")
                        .removeClass("tree-modified");
                    // Mark all the nodes in the pending actions list as
                    // modified. If a node isn't found, back up the tree
                    // until we find a parent that does exist and mark it.
                    var as = client.hoard.actions,
                        i, p, $node;
                    for (i = 0; i < as.length; i++) {
                        p = as[i].path.slice();
                        while (p.length > 0) {
                            $node = DOMtree.getNodeFromPath(p);
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

        $("#stage")
            .text(TX.tx("Reading from client"));
        client.store.reads(
            "S." + client.store.user(),
            function (data) {
                try {
                    client.hoard = new Hoard(data);
                    client.status = S.IS_LOADED;
                } catch (e) {
                    if (global.DEBUG) console.debug("Caught " + e);
                    S.squeak({
                        title: TX.tx("Error"),
                        severity: "error",
                        message: TX.tx("$1 hoard exists, but can't be read.",
                            this.options()
                            .identifier),
                        // After close, clear down and try again
                        after_close: function () {
                            Utils.sometime("init_application");
                        }
                    });
                    $("#squeak_dlg")
                        .squirrelDialog("squeakAdd",
                            TX.tx("Check that you have the correct password."));
                    return;
                }
                // Make sure we have a store path
                if ((client.store &&
                        client.store.options()
                        .needs_path ||
                        cloud.store &&
                        cloud.store.options()
                        .needs_path) &&
                    !client.hoard.options.store_path) {
                    $("#store_settings_dlg")
                        .squirrelDialog("open", rebuild_hoard);
                } else {
                    rebuild_hoard();
                }
            },
            function (e) {
                if (e === AbstractStore.NODATA) {
                    if (global.DEBUG) console.debug(this.options()
                        .identifier + " contains NODATA");
                    // Construct a new client hoard
                    Utils.soon(step_5_init_client_hoard);
                } else {
                    S.squeak({
                        title: TX.tx("Error"),
                        severity: "error",
                        message: TX.tx("$1 store error: $2",
                            this.options()
                            .identifier, e),
                        after_close: function () {
                            Utils.sometime("init_application");
                        }
                    });
                }
            });
    }

    /**
     * STEP 3: Login, fill in details the stores didn't provide, prompt
     * if needed.
     */
    function step_3_identify_user() {
        var uReq = true;
        var pReq = true;

        $("#stage")
            .text(TX.tx("Authentication"));

        // Spread user information determined during store initialisation
        // around.
        if (cloud.store &&
            typeof cloud.store.user() !== "undefined") {
            // Force the cloud user onto the client store
            if (global.DEBUG) console.debug("Cloud user is preferred: " + cloud.store.user());
            client.store.user(cloud.store.user());
            uReq = false;
        } else if (client.store &&
            typeof client.store.user() !== "undefined") {
            // Force the client user onto the cloud store
            if (global.DEBUG) console.debug("Client user is available: " + client.store.user());
            if (cloud.store)
                cloud.store.user(client.store.user());
            uReq = false;
        }

        if (cloud.store &&
            typeof cloud.store.pass() !== "undefined") {
            // Force the cloud pass onto the client store
            if (global.DEBUG) console.debug("Cloud pass is preferred");
            if (client.store)
                client.store.pass(cloud.store.pass());
            pReq = false;
        } else if (client.store &&
            typeof client.store.pass() !== "undefined") {
            // Force the client pass onto the cloud store
            if (global.DEBUG) console.debug("Client pass is available");
            if (cloud.store)
                cloud.store.pass(client.store.pass());
            pReq = false;
        }

        // If we still need user or password, prompt
        if (uReq || pReq) {
            $("#login_dlg")
                .squirrelDialog("open", {
                    store: client.store,
                    on_signin: function (user, pass) {
                        if (global.DEBUG) console.debug("Login prompt said user was " + user);
                        client.store.user(user);
                        client.store.pass(pass);
                        if (cloud.store) {
                            cloud.store.user(user);
                            cloud.store.pass(pass);
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
     * STEP 2: Initialise the client store. This sets up the store but
     * doesn't read anything yet.
     */
    function step_2_init_client_store() {
        // new LocalStorageStore({
        var p = {
            understore: function (params) {
                return new LocalStorageStore(params);
            },

            ok: function () {
                if (global.DEBUG) console.debug(this.options()
                    .identifier +
                    " store is ready");
                client.store = this;
                // Chain the login prompt
                Utils.soon(step_3_identify_user);
            },
            fail: function (e) {
                // We did our best!
                S.squeak({
                    title: TX.tx("Error"),
                    severity: "error",
                    message: TX.tx("Encryption error: $1", e)
                });
            }
        };

        if (typeof global.URLPARAMS.plaintext !== "undefined")
            p.understore(p);
        else
            new EncryptedStore(p);
    }

    /**
     * STEP 1: Initialise the cloud store, and prompt for user details.
     * This step will establish initial contact with OAuth2 stores, but
     * it won't modify anything in the store or download any data.
     */
    function step_1_init_cloud_store() {
        // Build parameter block passed to the store constructors.
        var p = {
            ok: function () {
                cloud.store = this;
                // Chain the client store startup
                Utils.soon(step_2_init_client_store);
            },

            fail: function (e) {
                S.squeak({
                    title: TX.tx("Warning"),
                    severity: "warning",
                    message: TX.tx("Could not open cloud store: $1", e),
                    after_close: function () {
                        step_2_init_client_store();
                    }
                });
                $("#squeak_dlg")
                    .squirrelDialog("squeakAdd", {
                        severity: "warning",
                        message: TX.tx("If you continue, only the client store will be available")
                    });
            },

            // 'understore' is used by layered stores to initialise the
            // store that underlies them.
            understore: function (pp) {
                // global.CLOUD_STORE is a constant set by the low-level
                // store module selected by dynamic Utils.load
                if (useSteganography) {
                    pp.understore = function (ppp) {
                        return new global.CLOUD_STORE(ppp);
                    };
                    return new StegaStore(pp);
                } else {
                    return new global.CLOUD_STORE(pp);
                }
            }
        };

        if (typeof global.URLPARAMS.plaintext !== "undefined")
            return p.understore(p);
        else
            return new EncryptedStore(p);
    }

    S.contextMenu = function (f) {
        switch (f) {
        case "enable":
            if (contextMenuDisables > 0)
                contextMenuDisables--;
            if (global.DEBUG) console.log("Context menu disables " +
                contextMenuDisables);
            if (contextMenuDisables <= 0)
                $("body").contextmenu("option", "autoTrigger", true);
            break;
        case "disable":
            contextMenuDisables++;
            if (global.DEBUG) console.log("Context menu disables " +
                contextMenuDisables);
            $("body").contextmenu("option", "autoTrigger", false);
            break;
        default:
            return $("body")
                .contextmenu(f);
        }
    };

    function before_menu_open(e, ui) {
        if (contextMenuDisables > 0)
            return false;

        var $node = (ui.target.is(".tree-node")) ?
            ui.target :
            ui.target.closest(".tree-node");

        var has_alarm = typeof $node.data("alarm") !== "undefined";
        var is_leaf = $node.hasClass("tree-leaf");
        var is_root = ui.target.closest(".tree-node")
            .hasClass("tree-root");
        var is_open = $node.hasClass("tree-open");
        var $root = $("body");

        if (global.DEBUG) console.debug("beforeOpen contextmenu on " + $node.data("key") +
            " " + is_leaf);

        $root
            .contextmenu("showEntry", "add_alarm", !has_alarm && !is_root)
            .contextmenu("showEntry", "add_subtree",
                is_open && !is_leaf)
            .contextmenu("showEntry", "add_value",
                is_open && !is_leaf && !is_root)
            .contextmenu("showEntry", "copy_value", is_leaf)
            .contextmenu("showEntry", "delete", !is_root)
            .contextmenu("showEntry", "edit", is_leaf)
            .contextmenu("showEntry", "insert_copy", !is_leaf && (typeof clipboard !== "undefined"))
            .contextmenu("showEntry", "make_copy", !is_root && !is_leaf)
            .contextmenu("showEntry", "pick_from", is_leaf)
            .contextmenu("showEntry", "randomise", is_leaf)
            .contextmenu("showEntry", "rename", !is_root);

        $menuTarget = $node;
    }

    /**
     * Handler for context menu items
     */
    function handle_menu_choice(e, ui) {
        var $node = $menuTarget;

        if (!$node) {
            if (global.DEBUG) console.debug("No node for contextmenu>" + ui.cmd);
            return;
        }

        switch (ui.cmd) {
        case "copy_value":
            clipboard = $node.data("value");
            break;

        case "make_copy":
            var p = $node.tree("get_path");
            var n = client.hoard.get_node(p);
            clipboard = JSON.stringify(n);
            break;

            /* Can't get it to work like this - would need an intermediate
           element that a Ctrl+V event happens on.
        case "paste":
            document.designMode = "on";
            $(window).on("paste", function(e) {
	    var   systemPasteContent =
    e.clipboardData.getData("text/plain");
                debugger;
            });
            $("#pasteboard").focus();
            document.execCommand("Paste");
            debugger;
            break;
        /**/

        case "insert_copy":
            if (clipboard) {
                try {
                    var data = JSON.parse(clipboard);
                    $("#insert_dlg")
                        .squirrelDialog("open", {
                            $node: $node,
                            data: data
                        });
                } catch (e) {
                    if (global.DEBUG) debugger;
                }
            }
            break;

        case "rename":
            $node.tree("editKey");
            break;

        case "edit":
            $node.tree("editValue");
            break;

        case "add_value":
            $("#add_dlg")
                .squirrelDialog("open", {
                    $node: $node,
                    is_value: true
                });
            break;

        case "add_subtree":
            $("#add_dlg")
                .squirrelDialog("open", {
                    $node: $node,
                    is_value: false
                });
            break;

        case "randomise":
            $("#randomise_dlg")
                .squirrelDialog("open", {
                    $node: $node
                });
            break;

        case "add_alarm":
            $("#alarm_dlg")
                .squirrelDialog("open", {
                    $node: $node
                });
            break;

        case "delete":
            $("#delete_dlg")
                .squirrelDialog("open", {
                    $node: $node
                });
            break;

        case "pick_from":
            $("#pick_dlg")
                .squirrelDialog("open", {
                    $node: $node
                });
            break;

        default:
            if (global.DEBUG) debugger;
        }
    }

    function init_menus() {
        var menu = {
            delegate: ".tree-title",
            menu: [
                {
                    title: TX.tx("Copy value"),
                    cmd: "copy_value",
                    uiIcon: "squirrel-icon-copy squirrel-icon"
                },
                /* Can't get it to work
                {
                    title: TX.tx("Paste"),
                    cmd: "paste",
                    uiIcon: "squirrel-icon-paste squirrel-icon"
                },
                /**/
                {
                    title: TX.tx("Pick characters"),
                    cmd: "pick_from",
                    uiIcon: "squirrel-icon-pick squirrel-icon"
                },
                {
                    title: TX.tx("Rename"),
                    cmd: "rename",
                    uiIcon: "squirrel-icon-edit squirrel-icon"
                },
                {
                    title: TX.tx("Edit value"),
                    cmd: "edit",
                    uiIcon: "squirrel-icon-edit squirrel-icon"
                },
                {
                    title: TX.tx("Add reminder"),
                    cmd: "add_alarm",
                    uiIcon: "squirrel-icon-alarm squirrel-icon"
                },
                {
                    title: TX.tx("Generate new random value"),
                    cmd: "randomise",
                    uiIcon: "squirrel-icon-key squirrel-icon"
                },
                {
                    title: TX.tx("Add new value"),
                    cmd: "add_value",
                    uiIcon: "squirrel-icon-add-value squirrel-icon"
                },
                {
                    title: TX.tx("Add new folder"),
                    cmd: "add_subtree",
                    uiIcon: "squirrel-icon-add-folder squirrel-icon"
                },
                {
                    title: TX.tx("Copy folder"),
                    cmd: "make_copy",
                    uiIcon: "squirrel-icon-copy squirrel-icon"
                },
                {
                    title: TX.tx("Insert copy of folder"),
                    cmd: "insert_copy",
                    uiIcon: "squirrel-icon-paste squirrel-icon"
                },
                {
                    title: TX.tx("Delete"),
                    cmd: "delete",
                    uiIcon: "squirrel-icon-delete squirrel-icon"
                }
            ],
            preventContextMenuForPopup: true,
            preventSelect: true,
            //taphold: true,
            beforeOpen: before_menu_open,
            select: handle_menu_choice
        };

        $("body")
            .contextmenu(menu);

        S.valueCopyClipboard =
            new ClipboardJS(".ui-contextmenu li[data-command='copy_value']", {
                text: function () {
                    var $node = $menuTarget;
                    if (global.DEBUG) console.debug("clip val from: " +
                        $node.data("key"));
                    return $node.data("value");
                }
            });

        S.treeCopyClipboard =
            new ClipboardJS(".ui-contextmenu li[data-command='make_copy']", {
                text: function () {
                    var $node = $menuTarget;
                    if (global.DEBUG) console.debug("clip json from: " +
                        $node.data("key"));
                    var p = $node.tree("getPath");
                    var n = client.hoard.get_node(p);
                    return JSON.stringify(n);
                }
            });
    }

    /**
     * Initialise application (new Squirrel(), effectively)
     */
    function init_application() {
        // Kick off by initialising the cloud store.
        $("#stage")
            .text(TX.tx("Loading application"));
        step_1_init_cloud_store();
    }

    function init_ui() {

        $("#sites-node")
            .tree({
                is_root: true,
                compare: S.compare
            });

        DOMtree = $("#sites-node")
            .data("squirrelTree");
        if (global.DEBUG) console.debug("DOM tree rooted " + DOMtree);

        $(".dlg-dialog")
            .squirrelDialog({
                autoOpen: false
            });
        $(".template")
            .template();
        $(".twisted")
            .twisted();

        if (global.DEBUG) {
            var pick = 1;
            $("#template-test")
                .template()
                .template("pick", pick)
                .template("expand", "Cats");
            $("#template-tester")
                .iconbutton()
                .on("click", function () {
                    $("#template-test")
                        .template("pick", pick)
                        .template("expand", "Squirrels", "cats");
                    pick = (pick + 1) % 3;
                });
        } else
            $(".debug-only")
            .remove();

        $("#save_button")
            .hide()
            .on($.getTapEvent(), function ( /*evt*/ ) {
                save_hoards();
                return false;
            });

        $("#undo_button")
            .hide()
            .on($.getTapEvent(), function ( /*evt*/ ) {
                S.undo(function (mess) {
                    S.squeak({
                        title: "Undo",
                        message: mess
                    });
                });
                return false;
            });

        $("#extras_button")
            .on($.getTapEvent(), function ( /*evt*/ ) {
                $("#extras_dlg")
                    .squirrelDialog("open");
            });

        $("#search_input")
            .on("change", function ( /*evt*/ ) {
                S.search($(this)
                    .val());
            });

        $("#search_button")
            .on($.getTapEvent(), function ( /*evt*/ ) {
                S.search($("#search_input")
                    .val());
            });

        $("button")
            .iconbutton();

        init_menus();

        // Set up event handlers for sometime scheduler
        $(document)
            .on("init_application", init_application)
            .on("check_alarms", check_alarms)
            .on("update_save", update_save)
            .on("reset_styling", function () {
                $.reset_styling()
            });

        $.reset_styling();

        Utils.sometime_is_now();
    }

    /**
     * A (manual) new tree node action
     */
    S.add_child_node = function ($node, title, value) {
        var p = $node.tree("getPath");
        p = p.concat(title);
        var e = {
            type: "N",
            path: p,
            data: (typeof value === "string") ? value : undefined
        };
        client.hoard.push_action(e);
        var res = client.hoard.play_action(e,
            function (e) {
                // this:Hoard, e:Action
                DOMtree.action(
                    e,
                    S.pushUndo,
                    function ($newnode) {
                        if (global.DEBUG && !$newnode) debugger;
                        if (typeof value !== "string" &&
                            typeof value !== "undefined") {
                            S.insert_data($newnode.tree("getPath"), value);
                        }
                        $newnode.tree("open");
                        Utils.sometime("update_save");
                    });
            });
        if (res !== null)
            S.squeak({
                message: res.message
            });
    };

    /**
     * Perform a text search for a new search expression
     */
    var last_search = "";
    var picked_hit = 0;

    S.search = function (s) {
        var hits;
        $(".picked-hit")
            .removeClass("picked-hit");
        if (s !== last_search) {
            $("#search_hits")
                .text(TX.tx("Searching..."));

            var re;
            try {
                re = new RegExp(s, "i");
            } catch (e) {
                S.squeak({
                    message: TX.tx("Error in search expression") +
                        " '" + s + "': " + e
                });
                return;
            }

            last_search = s;

            $(".search-hit")
                .removeClass("search-hit");

            $(".tree-node")
                .not(".tree-root")
                .each(function () {
                    var $node = $(this);
                    if ($node.data("key")
                        .match(re) ||
                        ($node.hasClass("tree-leaf") &&
                            $node.data("value")
                            .match(re)))
                        $node.addClass("search-hit");
                });

            hits = $(".search-hit");
            if (hits.length === 0) {
                $("#search_hits")
                    .text(TX.tx("Not found"));
                return;
            }

            picked_hit = 0;
        }

        hits = hits || $(".search-hit");
        if (picked_hit < hits.length) {
            $("#search_hits")
                .text(TX.tx("$1 of $2 found", picked_hit + 1, hits.length));
            $(hits[picked_hit])
                .addClass("picked-hit")
                .parents(".tree-collection")
                .each(function () {
                    $(this)
                        .tree("open");
                });
            $(hits[picked_hit])
                .scroll_into_view()
            picked_hit = (picked_hit + 1) % hits.length;
        }
    };

    /**
     * Insert data from a structure under the given path
     * @param path path to the parent below which this data will be inserted
     * @param data hoard cache format data
     */
    S.insert_data = function (path, data) {
        S.squeak({
            title: "Loading"
        });

        client.hoard.actions_from_hierarchy({
                data: data
            },
            function (act, next) {
                // this:Hoard, e:Action, next:function
                //if (global.DEBUG) console.debug(Hoard.stringify_action(act));
                act.path = path.slice()
                    .concat(act.path);
                this.push_action(act);
                var res = this.play_action(
                    act,
                    function (sact) {
                        // this:Hoard, e:Action
                        DOMtree.action(sact, null, next);
                    });
                if (res !== null)
                    $("#squeak_dlg")
                    .squirrelDialog("squeakAdd", res.message);
                if (next)
                    next();
            },
            null, // progress
            function () { // chain on complete
                Utils.sometime("update_save");
                $("#squeak_dlg")
                    .squirrelDialog(
                        "squeakAdd",
                        TX.tx("JSON has been loaded"));
            });
    };

    S.getClient = function () {
        return client;
    };

    S.getCloud = function () {
        return cloud;
    };

    S.playAction = function (action, more) {
        client.hoard.push_action(action);
        var res = client.hoard.play_action(
            action,
            function (e) {
                // this:Hoard, e:Action
                DOMtree.action(
                    e,
                    S.pushUndo,
                    function ($node) {
                        if (more)
                            more($node);
                        Utils.sometime("update_save");
                    });
            });
        if (res !== null)
            S.squeak({
                title: TX.tx("Error"),
                severity: "error",
                message: res.message
            });
    };

    /**
     * Push an undo
     */
    S.pushUndo = function (action) {
        undos.push(action);
    };

    /**
     * Return true if there is at least one undoable operation
     */
    S.can_undo = function () {
        return undos.length !== 0;
    };

    /**
     * Undo the most recent action
     */
    S.undo = function () {
        if (global.DEBUG && undos.length === 0) debugger;

        var a = undos.pop();
        a.time = Date.now();
        if (global.DEBUG) console.debug("Undo " + Hoard.stringify_action(a));
        // Discard the most recent action in the action stream
        client.hoard.pop_action();
        // Replay the reverse of the action
        var res = client.hoard.play_action(
            a,
            function (e) {
                // this:Hoard, e:Action
                DOMtree.action(
                    e,
                    null,
                    function () {
                        // If there are no undos, there can be no modifications.
                        // The hoard status will not be changed, though, so a
                        // save may still be required.
                        if (undos.length === 0 &&
                            client.status === S.IS_LOADED)
                            $(".tree-modified")
                            .removeClass("tree-modified");
                        Utils.sometime("update_save");
                    });
            });
        if (res !== null)
            S.squeak({
                title: TX.tx("Error"),
                severity: "error",
                message: res.message
            });
    };

    // on ready
    $(function () {

        // Parse URL parameters
        var qs = Utils.parse_query_params();

        global.URLPARAMS = qs;

        if (qs.debug) {
            global.DEBUG = true;
            console.log("Debug enabled");
            if ($.isTouchCapable && $.isTouchCapable()) {
                console.log("Device is touch-capable");
            }
        }

        if (global.DEBUG) console.log(
            "Device is " + window.screen.width + " X " +
            window.screen.height + " Body is " +
            $("body")
            .width() + " X " + $("body")
            .height());

        if (global.DEBUG && qs.dumpcloud)
            dump_cloud = true;

        // By default, jQuery timestamps datatype 'script' and 'jsonp'
        // requests to avoid them being cached by the browser.
        // Disable this functionality by default so that as much as
        // possible is cached locally
        if (!global.DEBUG) $.ajaxSetup({
            cache: true
        });

        var theme = Cookies.get("ui_theme");
        if (theme && theme !== "base")
            S.theme(theme);

        var scale = Cookies.get("ui_scale");
        if (scale && scale > 0)
            S.scale(scale);

        // Global MINIFIED is set in Squirrel.html
        var extension = ((typeof UNMINIFIED !== "undefined") && UNMINIFIED) ?
            ".js" : ".min.js";

        // Load the store by loading the appropriate module from js/
        var store = qs.store || "TestStore";
        var store_modules = ["js/" + store + extension];

        if (typeof qs.steg !== "undefined")
            useSteganography = true;
        if (useSteganography) {
            store_modules.push("js/Steganographer" + extension);
            store_modules.push("js/StegaStore" + extension);
        } else
            $(".using_steganography").remove();

        Utils.load(
            store_modules,
            function () {
                // Initialise translation module,
                // and chain the application init
                TX.init(function () {
                    // Initialise UI components
                    init_ui();
                    init_application();
                });
            },
            function (fails) {
                var e = TX.tx("Javascript module load failed");
                for (var f in fails)
                    e = e + "<div>" + f + ": " + fails[f] + "</div>";
                $("#init_error").html(e)
                    .show();
            });
    });

})(jQuery, Squirrel);