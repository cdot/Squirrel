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
/* global UNCOMPRESSED */

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
    var dump = false;

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

    function reset_styling() {

        // Copy subset of ui-widget styling into base by instantiating
        // a widget element then creating a new <style> with the required
        // attributes applied to body{}
        var $body = $("body");
        var $el = $(document.createElement("div"))
            .addClass("ui-widget")
            .addClass("ui-widget-content")
            .hide();
        $body.append($el);
        var bgcol = $el.css("background-color");
        var style = "body {";
        for (var attr in {
                "font": 0,
                //            "font-size" : 0,
                //            "font-family" : 0,
                //            "font-style" : 0,
                //            "font-variant" : 0,
                //            "font-weight" : 0,
                //            "font-stretch" : 0,
                //            "line-height" : 0,
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
            new RGBA(bgcol)
            .luma() < 0.65);

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
                        var s = "",
                            a;
                        if (rule.style.color) {
                            try {
                                a = new RGBA(rule.style.color);
                                s += "color: " +
                                    a.inverse()
                                    .toString() + ";\n"
                            } catch (e) {
                                if (DEBUG) console.log(e);
                            }
                        }
                        if (rule.style.backgroundColor) {
                            try {
                                a = new RGBA(
                                    rule.style.backgroundColor);
                                s += "background-color: " +
                                    a.inverse()
                                    .toString() + ";\n"
                            } catch (e) {
                                if (DEBUG) console.log(e + ":" + rule.style.backgroundColor);
                            }
                        }
                        if (s.length > 0)
                            style += rule.selectorText + "{" + s + "}\n";
                    }
                }
            }
            S.bright = want_bright;
        }

        $("#computed-styles")
            .remove();
        var $style = $(document.createElement("style"))
            .attr("id", "computed-styles")
            .text(style);
        $body.append($style);
        //if (DEBUG) console.log(style);
    }

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
                Cookies.set("ui_theme", theme);
            }
        }
        return Cookies.get("ui_theme");
    };

    S.scale = function (scale) {
        if (typeof scale !== "undefined") {
            if (scale > 6) { // don't go below 6px
                $("body")
                    .css("font-size", scale + "px");
                Cookies.set("ui_scale", scale);
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
            if (client.hoard.options.autosave !== on) {
                client.hoard.options.autosave = on;
                Utils.sometime("update_save");
            }
        }
        return client.hoard.options.autosave;
    };

    S.mask = function (s) {
        return s.replace(/./g, ".");
    };

    S.hideValues = function (on) {
        if (typeof on !== "undefined") {
            if (on !== (Cookies.get("ui_hidevalues") == "on")) {
                $("#sites-node")
                    .find(".tree-value:not(:hover)")
                    .each(
                        function () {
                            var s = $(this)
                                .closest(".tree-node")
                                .data("value");
                            $(this)
                                .text(on ? S.mask(s) : s);
                        });
            }
            Cookies.set("ui_hidevalues", on ? "on" : "off");
        }
        return Cookies.get("ui_hidevalues") == "on";
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
                    message: "<div class='ui-icon ui-icon-squirrel-rang'></div>" +
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
        if (DEBUG) console.debug("Merging from cloud hoard");
        client.hoard.merge_from_cloud(
            cloud.hoard,
            function (e) {
                // this:Hoard, e:Action
                DOMtree.action(e, false);
            },
            function (percent) {
                $("#merge_progress")
                    .text(percent + "%");
            },
            function (conflicts) {
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
            });
    }

    // Determine if there are unsaved changes, and generate a warning
    // message for the caller to use.
    function unsaved_changes(max_changes) {
        var message = [];

        $(".tree-modified")
            .each(function () {
                if (DEBUG && !$(this)
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
        if (DEBUG) console.debug("...save finished");
        Utils.sometime("update_save");
        if (client_ok && cloud_ok) {
            if (client.hoard.options.autosave)
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
            client.hoard.options.autosave = false;
        }
    }

    function write_client_store() {
        client.store.writes(
            "S." + client.store.user(),
            JSON.stringify(client.hoard),
            function () {
                if (DEBUG) console.debug("...client save OK");
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
                if (DEBUG) console.debug("...client save failed " + e);
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
        if (DEBUG) console.debug("...save to client");

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
                if (DEBUG) console.debug("...cloud save OK");
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
                if (DEBUG) console.debug("...cloud save failed " + e);
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
            if (DEBUG) console.debug("...save to cloud");

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
            if (DEBUG) console.debug("...no cloud store");
            if (ready)
                ready();
        }
    }

    // Construct a new cloud hoard from data in the client. This will
    // happen if the cloud is read and found to be empty or corrupt,
    // but not if the read failed.
    S.construct_new_cloud = function (progress, ready) {
        if (DEBUG) console.debug("...construct cloud ");
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
        if (DEBUG) console.debug("...cloud read OK ");
        try {
            cloud.hoard = new Hoard(data);
            cloud.status = S.IS_LOADED;
        } catch (e) {
            // We'll get here if decryption failed....
            if (DEBUG) console.debug("Cloud hoard JSON parse failed: " + e);
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
            if (DEBUG) console.debug("...merge cloud ");
            client.hoard.merge_from_cloud(
                cloud.hoard,
                function (e) {
                    // this:Hoard, e:Action
                    DOMtree.action(e, false);
                },
                function (percent) {
                    $("#merge_progress")
                        .text(percent + "%");
                });
        }

        if (cloud.status !== S.IS_LOADED ||
            client.hoard.actions.length !== 0) {
            // Only save if there actually some changes
            if (DEBUG) console.debug("...update from cloud ");
            update_cloud_store(save_client);
        } else
            Utils.soon(save_client);
    }

    // Action on the cloud store read failing
    function cloud_store_read_failed(e) {
        if (DEBUG) console.debug("...cloud read failed " + e);
        if (e === AbstractStore.NODATA) {
            if (DEBUG) console.debug(this.options()
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

        if (DEBUG) console.debug("Saving; client " + client.status +
            "; cloud " + cloud.status);
        if (cloud.status === S.NEW_SETTINGS ||
            cloud.status === S.IS_EMPTY) {
            // Don't attempt to resync out before saving, simply
            // overwrite the cloud.
            if (DEBUG) console.debug("...constructing new cloud because settings");
            S.construct_new_cloud();
        } else {
            // Reload and save the cloud hoard
            if (DEBUG) console.debug("...reloading cloud");
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
            if (client.hoard.options.autosave) {
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
     *  Try and synch it from the cloud.
     */
    function step_6_load_cloud_hoard() {
        if (cloud.store) {
            $("#stage")
                .text(TX.tx("Reading from cloud"));
            cloud.store.reads(
                client.hoard.options.store_path,
                function (data) {
                    if (DEBUG) console.debug(
                        this.options()
                        .identifier + " is ready");
                    try {
                        cloud.hoard = new Hoard(data);
			if (DEBUG && dump)
			    console.debug(JSON.stringify(cloud.hoard));
                    } catch (e) {
                        if (DEBUG) console.debug(
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
                    //if (DEBUG) console.debug("Cloud hoard " + data);
                    get_updates_from_cloud(step_7_hoards_loaded);
                },
                function (e) {
                    if (e === AbstractStore.NODATA) {
                        if (DEBUG) console.debug(
                            this.options()
                            .identifier + " contains NODATA");
                        cloud.status = S.IS_EMPTY;
                    } else {
                        if (DEBUG) console.debug(
                            this.options()
                            .identifier + " has NODATA: " + e);
                        S.squeak({
                            title: TX.tx("Error"),
                            severity: "error",
                            message: TX.tx("Could not load cloud hoard.")
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
        if (DEBUG) console.debug("Setting up client hoard");
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
                    DOMtree.action(a, false, next);
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
                    if (DEBUG) console.debug("Caught " + e);
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
                    if (DEBUG) console.debug(this.options()
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
     * is needed.
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
            if (DEBUG) console.debug("Cloud user is preferred: " + cloud.store.user());
            client.store.user(cloud.store.user());
            uReq = false;
        } else if (client.store &&
            typeof client.store.user() !== "undefined") {
            // Force the client user onto the cloud store
            if (DEBUG) console.debug("Client user is available: " + client.store.user());
            if (cloud.store)
                cloud.store.user(client.store.user());
            uReq = false;
        }

        if (cloud.store &&
            typeof cloud.store.pass() !== "undefined") {
            // Force the cloud pass onto the client store
            if (DEBUG) console.debug("Cloud pass is preferred");
            if (client.store)
                client.store.pass(cloud.store.pass());
            pReq = false;
        } else if (client.store &&
            typeof client.store.pass() !== "undefined") {
            // Force the client pass onto the cloud store
            if (DEBUG) console.debug("Client pass is available");
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
                        if (DEBUG) console.debug("Login prompt said user was " + user);
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
     * STEP 2: Once the cloud store is loaded, we can move on to the client store.
     */
    function step_2_init_client_store() {
        // new LocalStorageStore({
        new EncryptedStore({
            understore: function (params) {
                return new LocalStorageStore(params);
            },

            ok: function () {
                if (DEBUG) console.debug(this.options()
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
        });
    }

    /**
     * STEP 1: Establish contact with the cloud, and get user details.
     */
    function step_1_init_cloud_store() {
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
            }
        };

        p.understore = function (pp) {
            // SQUIRREL_STORE is a constant set by the low-level
            // store module selected by dynamic load
            if (useSteganography) {
                pp.understore = function (ppp) {
                    return new SQUIRREL_STORE(ppp);
                };
                return new StegaStore(pp);
            } else {
                return new SQUIRREL_STORE(pp);
            }
        };

        return new EncryptedStore(p);
    }

    S.enableContextMenu = function (enable) {
        if (enable) {
            if (contextMenuDisables > 0)
                contextMenuDisables--;
        } else
            contextMenuDisables++;
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

        if (DEBUG) console.debug("contextmenu on " + $node.data("key") +
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
            if (DEBUG) console.debug("No node for contextmenu>" + ui.cmd);
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
                    if (DEBUG) debugger;
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

        $("body")
            .contextmenu(menu);

        S.valueCopyClipboard =
            new Clipboard(".ui-contextmenu li[data-command='copy_value']", {
                text: function () {
                    var $node = $menuTarget;
                    if (DEBUG) console.debug("clip val from: " +
                        $node.data("key"));
                    return $node.data("value");
                }
            });

        S.treeCopyClipboard =
            new Clipboard(".ui-contextmenu li[data-command='make_copy']", {
                text: function () {
                    var $node = $menuTarget;
                    if (DEBUG) console.debug("clip json from: " +
                        $node.data("key"));
                    var p = $node.tree("getPath");
                    var n = client.hoard.get_node(p);
                    return JSON.stringify(n);
                }
            });
        /* Should zeroClipboard ever prove necessary, here are the bits
        S.zeroClipboards.addClipboard({
            selector: ".ui-contextmenu li[data-command='copy_value']",
            handler: function() {
                var $node = $menuTarget;
                if (DEBUG) console.debug("clip val from: " +
                                         $node.data("key"));
                return {
                    data: $node.data("value"),
                    contentType: "text/plain"
                };
            }
        });
        S.zeroClipboards.addClipboard({
            selector: ".ui-contextmenu li[data-command='make_copy']",
            handler: function() {
                var $node = $menuTarget;
                if (DEBUG) console.debug("clip json from: " +
                                         $node.data("key"));
                var p = $node.tree("getPath");
                var n = client.hoard.get_node(p);
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
        if (DEBUG) console.debug("DOM tree rooted " + DOMtree);

        $(".dlg-dialog")
            .squirrelDialog({
                autoOpen: false
            });
        $(".template")
            .template();
        $(".twisted")
            .twisted();

        if (DEBUG) {
            var pick = 1;
            $("#template-test")
                .template()
                .template("pick", pick)
                .template("expand", "Cats");
            $("#template-tester")
                .button()
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
                $("#search_hits")
                    .text(TX.tx("Searching..."));
                S.search($(this)
                    .val());
            });

        $("#search_button")
            .on($.getTapEvent(), function ( /*evt*/ ) {
                $("#search_hits")
                    .text(TX.tx("Searching..."));
                S.search($("#search_input")
                    .val());
            });

        $("button")
            .each(function () {
                var $this = $(this);
                var opts;

                if (typeof $this.data("icon") !== "undefined") {
                    var name = $this.data("icon");
                    if (/squirrel/.test(name)) {
                        opts = {
                            icons: {
                                primary: name
                            },
                            classes: {
                                "ui-button-icon": "squirrel-icon"
                            },
                            text: false
                        };
                    } else {
                        opts = {
                            icon: name,
                            text: false
                        }
                    }
                }
                $this.button(opts);
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
    S.add_child_node = function ($node, title, value) {
        var p = $node.tree("getPath");
        p.push(title);

        var res = client.hoard.record_action({
                type: "N",
                path: p,
                data: (typeof value === "string") ? value : undefined
            },
            function (e) {
                // this:Hoard, e:Action
                DOMtree.action(
                    e,
                    true,
                    function ($newnode) {
                        if (DEBUG && !$newnode) debugger;
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
     * Perform a text search
     */
    S.search = function (s) {
        var re;
        try {
            re = new RegExp(s, "i");
        } catch (e) {
            S.squeak({
                message: TX.tx("Error in search expression") +
                    " '" + s + "': " + e
            });
        }
        var hits = [];
        $(".tree-node")
            .not(".tree-root")
            .each(function () {
                var $node = $(this);
                if ($node.data("key")
                    .match(re) ||
                    ($node.hasClass("tree-leaf") &&
                        $node.data("value")
                        .match(re)))
                    hits.push($node);
            });

        $("#search_hits")
            .text(TX.tx("$1 found", hits.length));
        if (hits.length === 0) {
            S.squeak({
                message: TX.tx("'$1' not found", s)
            });
        } else {
            $(".tree-open")
                .not(".tree-root")
                .each(function () {
                    $(this)
                        .tree("close");
                });
            $.each(hits, function (n, $v) {
                $v.parents(".tree-collection")
                    .each(function () {
                        $(this)
                            .tree("open");
                    });
            });
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
                //if (DEBUG) console.debug(Hoard.stringify_action(act));
                act.path = path.slice()
                    .concat(act.path);
                var res = client.hoard.record_action(
                    act,
                    function (sact) {
                        // this:Hoard, e:Action
                        DOMtree.action(sact, false, next);
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
        var res = client.hoard.record_action(
            action,
            function (e) {
                // this:Hoard, e:Action
                DOMtree.action(
                    e,
                    true,
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
        if (DEBUG && undos.length === 0) debugger;

        var a = undos.pop();
        a.time = Date.now();
        if (DEBUG) console.debug("Undo " + Hoard.stringify_action(a));
        var res = client.hoard.record_action(
            a,
            function (e) {
                // this:Hoard, e:Action
                DOMtree.action(
                    e, false,
                    function () {
                        // If there are no undos, there can be no modifications.
                        // The hoard status will not be changed, though, so a
                        // save may still be required.
                        if (undos.length === 0)
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

        if (DEBUG) console.log(
            "Device is " + window.screen.width + " X " +
            window.screen.height + " Body is " +
            $("body")
            .width() + " X " + $("body")
            .height());

        var qs = Utils.query_string();

        if (qs.debug)
            DEBUG = true;

	if (DEBUG && qs.dump)
	    dump = true;

        // By default, jQuery timestamps datatype 'script' and 'jsonp'
        // requests to avoid them being cached by the browser.
        // Disable this functionality by default so that as much as
        // possible is cached locally
        if (!DEBUG) $.ajaxSetup({
            cache: true
        });

        var theme = Cookies.get("ui_theme");
        if (theme && theme !== "base")
            S.theme(theme);

        var scale = Cookies.get("ui_scale");
        if (scale && scale > 0)
            S.scale(scale);

        // Menu is built; attach ZeroClipboards (if available)
        //S.zeroClipboards = new ZeroClipboardShim();

        var store = qs.store || "TestStore";
        if (typeof qs.steg !== "undefined")
            useSteganography = true;

        var store_bits = ["js/" + store + ".min.js"];
        if (useSteganography) {
            store_bits.push("js/Steganographer.min.js");
            store_bits.push("js/StegaStore.min.js");
        } else
            $(".using_steganography")
            .remove();
        var unco = (typeof UNCOMPRESSED !== "undefined") && UNCOMPRESSED;
        Utils.load(
            store_bits,
            unco,
            function () {
                // Initialise translation module,
                // and chain the application init
                TX.init(function () {
                    // Initialise UI components
                    init_ui();
                    init_application();
                });
            });
    });

})(jQuery, Squirrel);
