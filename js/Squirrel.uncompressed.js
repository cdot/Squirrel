/*@preserve Copyright (C) 2015 Crawford Currie http://c-dot.co.uk license MIT*/

/* eslint-env jquery */
/* global DEBUG:true */
/* global TX */
/* global Utils */
/* global AbstractStore */
/* global EncryptedStore */
/* global LocalStorageStore */
/* global StegaStore */
/* global Hoard */
/* global Tree */
/* global SQUIRREL_STORE */

/*
 * The Squirrel Application namespace and UI. The code in this module is
 * common to all environments and is expected to be extended by functions
 * in the individual Squireel.uncompressed.js modules specific to the
 * environment e.g. desktop/Squirrel.uncompressed.js
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
    Tree: {}
};

(function($, S) {
    "use strict";
    var SD = S.Dialog;
    var ST = S.Tree;

    S.init_ui = function() {
        $("#authenticated_save")
            .hide()
            .on($.getTapEvent(), function(/*evt*/) {
                S.save_hoards();
                return false;
            });

        $("#authenticated_undo")
            .hide()
            .on($.getTapEvent(), function(/*evt*/) {
                ST.undo(function(mess) {
                    SD.squeak({
                        title: "Undo",
                        message: mess
                    });
                });
                return false;
            });

        $("#authenticated_extras")
            .on($.getTapEvent(), function(/*evt*/) {
                SD.extras();
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
                SD.search();
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

        S.clipboard = null;

        // Set up event handlers for sometime scheduler
        $(document)
            .on("init_application", S.init_application)
            .on("check_alarms", S.check_alarms)
            .on("update_save", S.update_save)
            .on("reset_styling", S.resetStyling);
        S.resetStyling();
        
        Utils.sometime_is_now();
    };

    S.resetStyling = function() {
        // Copy subset of ui-widget styling into base
        var $body = $("body");
        var $el = $("<div></div>")
            .addClass("ui-widget")
            .addClass("ui-widget-content")
            .addClass("dlg-hidden");
        $body.append($el);
        var bgcol = $el.css("background-color");
        var style = "body {";
        for (var attr in {
            "font" : 0,
            "color": 0,
            "background-color": 0
        }) {
            var av = $el.css(attr);
            style += attr + ": " + av + ";";
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
                        var s = "";
                        if (rule.style.color) {
                            try {
                                var a = new RGBA(rule.style.color);
                                s += "color: " +
                                    a.inverse().unparse() + ";"
                            } catch (e) {
                            }
                        }
                        if (rule.style.backgroundColor) {
                            try {
                                var a = new RGBA(
                                    rule.style.backgroundColor);
                                s += "background-color: " +
                                    a.inverse().unparse() + ";"
                            } catch (e) {
                            }
                        }
                        if (s.length > 0)
                            style += rule.selectorText + "{" + s + "}";
                    }
                }
            }
            S.bright = want_bright;
        }

        $("#computed-styles").remove();
        style = "<style id='computed-styles'>" + style + "</style>";
        $body.append(style);
    };
    
    /**
     * Initialise application data (new Squirrel(), effectively)
     */
    S.init_application = function() {
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
        S.init_cloud_store();
    };

    // Event handler for check_alarms
    S.check_alarms = function(/* event */) {
        S.client.hoard.check_alarms(
            function(path, expired, next) {
                var $node = ST.get_node(path);
                ST.ring_alarm($node);
                SD.squeak(
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
    };

    /**
     * A (manual) new tree node action
     */
    S.add_child_node = function($node, title, value) {
        var p = ST.get_path($node), sval;
        if (typeof value === "string")
            sval = value;
        p.push(title);

        var res = S.client.hoard.record_action(
            {
                type: "N",
                path: p,
                data: sval
            },
            function(e) {
                ST.action(
                    e, true,
                    function($newnode) {
                        if (DEBUG && !$newnode) debugger;
                        ST.open($newnode);
                        if (typeof value !== "string"
                            && typeof value !== "undefined") {
                            S.insert_data(p, value);
                        }

                        Utils.sometime("update_save");
                    });
            });
        if (res !== null)
            SD.squeak(res.message);
    };

    S.get_updates_from_cloud = function(cloard, chain) {
        // This will get triggered whenever both hoards are
        // successfully loaded.
        if (DEBUG) console.debug("Merging from cloud hoard");
        S.client.hoard.merge_from_cloud(
            cloard,
            ST.action,
            function(conflicts) {
                if (conflicts.length > 0) {
                    SD.squeak({
                        title: TX.warning(),
                        severity: "warning",
                        message: 
                        TX.tx("Conflicts were detected while merging actions from the Cloud. Please review these rejected actions before saving.")
                    });
                    $.each(conflicts, function(i, c) {
                        var e = c.conflict;
                        SD.squeak_more({
                            severity: "warning",
                            message: Hoard.stringify_action(e)
                                + ": " + c.message });
                    });
                }
                S.cloud.status = S.IS_LOADED;
                // Finished with the cloud hoard (for now)
                chain();
            });
    };

    // Determine if there are unsaved changes, and generate a warning
    // message for the caller to use.
    S.unsaved_changes = function(max_changes) {
        var message = [];

        $(".tree-node .tree-modified").each(function() {
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
    };

    /**
     * Insert data from a structure under the given path
     * @param path path to the parent below which this data will be inserted
     * @param data hoard cache format data
     */
    S.insert_data = function(path, data) {
        SD.squeak({ title: "Loading" });

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
                    SD.squeak_more(res.message);
                if (next)
                    next();
            },
            function() { // chain on complete
                Utils.sometime("update_save");
                SD.squeak_more(TX.tx("JSON has been loaded"));
            });
    };

    S.save_hoards = function() {
        SD.squeak({
            title: TX.tx("Saving")
        });

        var client_ok = true;
        var cloud_ok = true;

        var finished = function() {
            if (DEBUG) console.debug("...save finished");
            Utils.sometime("update_save");
            if (client_ok && cloud_ok) {
                if (S.client.hoard.options.autosave)
                    SD.close_dialog($("#squeak"));
                else
                    // Otherwise leave it open
                    SD.squeak_more(TX.tx("Save complete"));

            } else {
                // Otherwise leave it open, disable auto-save
                SD.squeak_more({
                    severity: "error",
                    message: TX.tx("Save encountered errors")});
                S.client.hoard.options.autosave = false;
            }
        },

        write_client_store = function() {
            S.client.store.writes(
                "S." + S.client.store.user(),
                JSON.stringify(S.client.hoard),
                function() {
                    if (DEBUG) console.debug("...client save OK");
                    $(".tree-modified").removeClass("tree-modified");
                    S.client.status = S.IS_LOADED;
                    SD.squeak_more(
                        TX.tx("Saved in $1", this.options().identifier));
                    finished();
                },
                function(e) {
                    if (DEBUG) console.debug("...client save failed " + e);
                    SD.squeak_more({
                        severity: "error",
                        message: TX.tx("Failed to save in $1: $2",
                                       this.options().identifier, e)
                    });
                    client_ok = false;
                    finished();
                });
        },

        save_client = function() {
            if (DEBUG) console.debug("...save to client");

            if (S.client.status === S.IS_LOADED
                && $(".tree-modified").length === 0) {
                finished();
                return;
            }

            S.client.status = S.PENDING_SAVE;

            SD.squeak_more({
                severity: "while",
                message: TX.tx("Saving in $1",
                               S.client.store.options().identifier)});

            Utils.soon(write_client_store);
        },

        write_cloud_store = function(cloard) {
            S.cloud.store.writes(
                S.client.hoard.options.store_path,
                JSON.stringify(cloard),
                function() {
                    if (DEBUG) console.debug("...cloud save OK");
                    S.client.hoard.actions = [];
                    S.client.hoard.last_sync = Date.now();
                    SD.squeak_more(
                        TX.tx("Saved in $1", this.options().identifier));
                    S.cloud.status = S.IS_LOADED;
                    save_client();
                },
                function(e) {
                    if (DEBUG) console.debug("...cloud save failed " + e);
                    SD.squeak_more({
                        severity: "error",
                        message: TX.tx("Failed to save in $1: $2",
                                       this.options().identifier, e)});
                    cloud_ok = false;
                    save_client();
                });
        },

        // Save the given hoard into the cloud.
        update_cloud_store = function(cloard) {
            cloard.actions = cloard.actions.concat(S.client.hoard.actions);
            if (S.cloud.store) {
                if (DEBUG) console.debug("...save to cloud");

                SD.squeak_more({
                    severity: "while",
                    message: TX.tx("Saving in $1",
                                   S.cloud.store.options().identifier)});

                S.cloud.status = S.PENDING_SAVE;

                Utils.soon(function() { write_cloud_store(cloard); });
            } else {
                if (DEBUG) console.debug("...no cloud store");
                save_client();
            }
        },

        // Construct a new cloud hoard from data in the client. This will
        // happen if the cloud is read and found to be empty or corrupt,
        // but not if the read failed.
        construct_new_cloud = function() {
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
        },

        // Action on the cloud store being read OK
        cloud_store_read_ok = function(data) {
            var cloard;
            if (DEBUG) console.debug("...cloud read OK ");
            try {
                cloard = new Hoard(JSON.parse(data));
                S.cloud.status = S.IS_LOADED;
            } catch (e) {
                // We'll get here if decryption failed....
                if (DEBUG) console.debug("Cloud hoard JSON parse failed: " + e);
                SD.squeak_more({
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
        },

        // Action on the cloud store read failing
        cloud_store_read_failed = function(e) {
            if (DEBUG) console.debug("...cloud read failed " + e);
            if (e === AbstractStore.NODATA) {
                if (DEBUG) console.debug(this.options().identifier + " contains NODATA");
                S.cloud.status = S.IS_EMPTY;
                construct_new_cloud();
            } else {
                SD.squeak_more({
                    severity: "error",
                    message: TX.tx("Failed to refresh from $1: $2",
                                   this.options().identifier, e)});
                cloud_ok = false;
                Utils.soon(save_client);
            }
        };

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
    };

    S.update_save = function(/*event*/) {
        $("#authenticated_undo").toggle(ST.can_undo());
        $("#extras_autosave").val(S.client.hoard.options.autosave ? "on" : "off");
        var us = S.unsaved_changes(3);
        var $sb = $("#authenticated_save");

        if (us !== null) {
            if (S.client.hoard.options.autosave) {
                S.save_hoards();
            } else {
                $sb.attr(
                    "title",
                    TX.tx("Save is required because: ") + us);
                $sb.show();
            }
        } else {
            $("#authenticated_save").hide();
        }
    };

    // Last in the initial hoard load sequence
    S.hoards_loaded = function() {
        // We are ready for interaction
        S.authenticated();

        $(window).on("beforeunload", function() {
            var us = S.unsaved_changes(10);
            if (us !== null) {
                us = TX.tx("You have unsaved changes")
                    + "\n" + us
                    + "\n" + TX.tx("Are you really sure?");
                return us;
            }
        });

        Utils.sometime("update_save");
        Utils.sometime("check_alarms");

        // Flush the sometimes, and allow new sometimes to be set
        Utils.sometime_is_now();
    };

    /**
     * STEP 6: Called when we have a (possibly empty) client hoard.
     *  Try and synch it from the cloud.
     */
    S.load_cloud_hoard = function() {
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
                        SD.squeak({
                            title: TX.error(),
                            severity: "error",
                            message:
                            TX.tx("$1 hoard exists, but can't be read.",
                                  this.options().identifier)
                                + " "
                                + TX.tx("Check that you have the correct password.")
                        });
                        S.cloud.status = S.IS_CORRUPT;
                        Utils.soon(S.hoards_loaded);
                        return;
                    }
                    //if (DEBUG) console.debug("Cloud hoard " + data);
                    S.get_updates_from_cloud(
                        new Hoard(hoard),
                        S.hoards_loaded);
                },
                function(e) {
                    if (e === AbstractStore.NODATA) {
                        if (DEBUG) console.debug(
                            this.options().identifier + " contains NODATA");
                        S.cloud.status = S.IS_EMPTY;
                    } else {
                        if (DEBUG) console.debug(
                            this.options().identifier + " has NODATA: " + e);
                        SD.squeak({
                            title: TX.error(),
                            severity: "error",
                            message: TX.tx("Could not load cloud hoard.")
                        });
                        SD.squeak_more(
                            TX.tx("Check that you have the correct password."));
                        // Could not contact cloud; continue all the same
                    }
                    Utils.soon(S.hoards_loaded);
                });
        } else {
            S.hoards_loaded();
        }
    };

    /**
     * STEP 5: Called when there is no existing client hoard, to initialise
     * a new one.
     */
    S.init_client_hoard = function() {
        if (DEBUG) console.debug("Setting up client hoard");
        S.client.hoard = new Hoard();
        S.client.status = S.IS_EMPTY;

        if (S.cloud.store && S.cloud.store.options().needs_path) {
            SD.store_settings(S.load_cloud_hoard);
        } else {
            S.load_cloud_hoard();
        }
    };

    /**
     * STEP 4: Once the stores have been initialised, we can load
     * the client hoard. This will give us the baseline cache data and the
     * location of the cloud hoard, so we can then chain loading and merging
     * the cloud hoard.
     */
    S.load_client_hoard = function() {
        var rebuild_hoard = function() {
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
                            $node = ST.get_node(p);
                            if ($node) {
                                $node.addClass("tree-modified");
                                break;
                            }
                            p.pop();
                        }
                    }
                    Utils.soon(S.load_cloud_hoard);
                });
        };

        if (DEBUG) console.debug("Load client store");

        S.client.store.reads(
            "S." + S.client.store.user(),
            function(data) {
                try {
                    S.client.hoard = new Hoard(JSON.parse(data));
                    S.client.status = S.IS_LOADED;
                } catch (e) {
                    if (DEBUG) console.debug("Caught " + e);
                    SD.squeak({
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
                    SD.squeak_more(
                        TX.tx("Check that you have the correct password."));
                    return;
                }
                // Make sure we have a store path
                if ((S.client.store
                     && S.client.store.options().needs_path
                     || S.cloud.store
                     && S.cloud.store.options().needs_path)
                    && !S.client.hoard.options.store_path) {
                    SD.store_settings(rebuild_hoard);
                } else {
                    rebuild_hoard();
                }
            },
            function(e) {
                if (e === AbstractStore.NODATA) {
                    if (DEBUG) console.debug(this.options().identifier + " contains NODATA");
                    // Construct a new client hoard
                    Utils.soon(S.init_client_hoard);
                } else {
                    SD.squeak({
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
    };

    /**
     * STEP 3: Login, fill in details the stores didn't provide, prompt
     * is needed.
     */
    S.identify_user = function() {
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
            SD.login({
                store: S.client.store,
                on_signin: function(user, pass) {
                    if (DEBUG) console.debug("Login prompt said user was " + user);
                    S.client.store.user(user);
                    S.client.store.pass(pass);
                    if (S.cloud.store) {
                        S.cloud.store.user(user);
                        S.cloud.store.pass(pass);
                    }
                    S.load_client_hoard();
                },
                user_required: uReq,
                pass_required: pReq
            });
        } else
            S.load_client_hoard();
    };

    /**
     * STEP 2: Once the cloud store is loaded, we can move on to the client store.
     */
    S.init_client_store = function() {
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
                Utils.soon(S.identify_user);
            },
            fail: function(e) {
                // We did our best!
                SD.squeak({
                    title: TX.error(),
                    severity: "error",
                    message: TX.tx("Encryption error: $1", e)
                });
            }
        });
    };

    /**
     * STEP 1: Establish contact with the cloud, and get user details.
     */
    S.init_cloud_store = function() {
        var p = {
            ok: function() {
                S.cloud.store = this;
                // Chain the client store startup
                Utils.soon(S.init_client_store);
            },
            fail: function(e) {
                SD.squeak({
                    title: TX.warning(),
                    severity: "warning",
                    message: TX.tx("Could not open cloud store: $1", e),
                    after_close: function() {
                        S.init_client_store();
                    }
                });
                SD.squeak_more({
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
    };

    /**
     * Perform a text search
     */
    S.search = function(s) {
        var re;
        try {
            re = new RegExp(s, "i");
        } catch (e) {
            SD.squeak(
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
            SD.squeak(
                {
                    message: TX.tx("'$1' not found", s)
                });
        } else {
            $(".tree-open").each(function() {
                ST.close($(this));
            });
            $.each(hits, function(n, v) {
                $(v).parents(".tree-collection").each(function() {
                    ST.open($(this));
                });
            });
        }
    };

    $(document)
        .ready(function() {
            // By default, jQuery timestamps datatype 'script' and 'jsonp'
            // requests to avoid them being cached by the browser.
            // Disable this functionality by default so that as much as
            // possible is cached locally

            var qs = Utils.query_string();

            // Use uncompressed if the current document is uncompressed
            var unco = document.location.href.match(/\.(min|uncompressed)\.html/)[1] === "uncompressed";

            if (qs.debug)
                DEBUG = true;

            if (!DEBUG) $.ajaxSetup({ cache: true });

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
                    S.init_ui();
                    S.init_application();
                });
            });
            //$(this).tooltip();
        });

        S.authenticated = function() {
            $("#whoami").text(S.client.store.user());
            $("#unauthenticated").hide();
            $("#authenticated").show();
        };

    var before_open = function(e, ui) {
        var $node = (ui.target.is(".tree-node"))
            ? ui.target
            : ui.target.parents(".tree-node").first();
        var $val = $node.find(".value").first();
        var has_alarm = typeof $node.data("alarm") !== "undefined";
        var is_leaf = $node.hasClass("tree-leaf");
        var is_root = ui.target.closest(".tree-node").is("#sites-node");
        var is_open = $node.hasClass("tree-open");
        var $root = $("body");

        $root
            .contextmenu("showEntry", "rename", !is_root)
            .contextmenu("showEntry", "copy_value", is_leaf)
            .contextmenu("showEntry", "pick_from", is_leaf)
            .contextmenu("showEntry", "make_copy", !is_root)
            .contextmenu("showEntry", "delete", !is_root)
            .contextmenu("showEntry", "add_alarm", !has_alarm && !is_root)
            .contextmenu("showEntry", "edit", is_leaf)
            .contextmenu("showEntry", "randomise", is_leaf)
            .contextmenu("showEntry", "add_subtree", !is_leaf)
            .contextmenu("enableEntry", "add_subtree", is_open)
            .contextmenu("showEntry", "add_value", !is_leaf && !is_root)
            .contextmenu("enableEntry", "add_value", is_open)
            .contextmenu("showEntry", "insert_copy",
                         !is_leaf && S.clipboard !== null);

        if (typeof ZeroClipboard !== "undefined") {
            var zc;
            if (!$root.data("zc_copy")) {
                // First time, attach zero clipboard handler
                if (DEBUG) console.debug("Attaching ZC copy");
                // Whack a Flash movie over the menu item li
                zc = new ZeroClipboard(
                    ui.menu.children("li[data-command='copy_value']"));
                // Handle the "copy" event that comes from
                // the Flash movie and populate the event with our data
                zc.on("copy", function(event) {
                    if (DEBUG) { console.debug("Copying to clipboard"); }
                    event.clipboardData.setData(
                        "text/plain",
                        $root.data("zc_copy").text());
                });
                $root.data("ZC", zc); // remember it to protect from GC
            }
            $root.data("zc_copy", $val);

            if (!$root.data("zc_cut")) {
                // First time, attach zero clipboard handler
                if (DEBUG) console.debug("Attaching ZC cut");
                // Whack a Flash movie over the menu item li
                zc = new ZeroClipboard(
                    ui.menu.children("li[data-command='make_copy']"));
                // Handle the "copy" event that comes from
                // the Flash movie and populate the event with our data.
                // Note that this populates the system clipboard, but that
                // clipboard is not accessible from Javascript so we
                // can only insert things copied from Squirrel
                zc.on("copy", function(event) {
                    if (DEBUG) console.debug("Copying JSON to clipboard");
                    var pa = $root.data("zc_cut");
                    var p = ST.get_path(pa);
                    var n = S.client.hoard.get_node(p);
                    var json = JSON.stringify(n);

                    S.clipboard = json;
                    event.clipboardData.setData("text/plain", json);
                });
                $root.data("ZC", zc); // remember it to protect from GC
            }
            $root.data("zc_cut", $node.closest(".tree-node"));
        }
    };

    /**
     * Handler for context menu items
     */
    var handle_choice = function(e, ui) {

        var $node = ui.target.closest(".tree-node");

        if (!$node)
            throw "No node for contextmenu";

        switch (ui.cmd) {
        case "copy_value":
            // Handled by the ZeroClipboard event handler
            break;

        case "make_copy":
            // Handled by the ZeroClipboard event handler
            break;

        case "insert_copy":
            if (DEBUG) console.debug("Pasting");
            if (S.clipboard) {
                var data = JSON.parse(S.clipboard);
                S.add_child_node($node, TX.tx("A copy"), data.data);
            }
            break;

        case "rename":
            if (DEBUG) console.debug("Renaming");
            ST.edit($node, ".tree-key");
            break;

        case "edit":
            if (DEBUG) console.debug("Editing");
            ST.edit($node, ".tree-value");
            break;

        case "add_value":
            SD.add($node, true);
            break;

        case "add_subtree":
            SD.add($node, false);
            break;

        case "randomise":
            if (DEBUG) console.debug("Randomising");
            S.Dialog.randomise($node);
            break;

        case "add_alarm":
            if (DEBUG) console.debug("Adding reminder");
            S.Dialog.alarm($node);
            break;

        case "delete":
            if (DEBUG) console.debug("Deleting");
            S.Dialog.delete_node($node);
            break;

        case "pick_from":
            if (DEBUG) console.debug("Picking");
            S.Dialog.pick($node);
            break;

        default:
            if (DEBUG) debugger;
        }
    };

    var init_menus = function() {
        var menu = {
            delegate: ".tree-node",
            menu: [
                {
                    title: TX.tx("Copy value"),
                    cmd: "copy_value",
                    uiIcon: "ui-icon-squirrel-copy"
                },
                {
                    title: TX.tx("Pick characters"),
                    cmd: "pick_from",
                    uiIcon: "ui-icon-squirrel-pick"
                },
                {
                    title: TX.tx("Rename"),
                    cmd: "rename",
                    uiIcon: "ui-icon-squirrel-edit" 
                },
                {
                    title: TX.tx("Edit value"),
                    cmd: "edit",
                    uiIcon: "ui-icon-squirrel-edit" 
                },
                {
                    title: TX.tx("Add reminder"),
                    cmd: "add_alarm",
                    uiIcon: "ui-icon-squirrel-alarm" 
                },
                {
                    title: TX.tx("Generate new random value"),
                    cmd: "randomise",
                    uiIcon: "ui-icon-squirrel-key" 
                },               
                {
                    title: TX.tx("Add new value"),
                    cmd: "add_value",
                    uiIcon: "ui-icon-squirrel-add-value" 
                },
                {
                    title: TX.tx("Add new folder"),
                    cmd: "add_subtree",
                    uiIcon: "ui-icon-squirrel-add-folder" 
                },
                {
                    title: TX.tx("Copy folder"),
                    cmd: "make_copy",
                    uiIcon: "ui-icon-squirrel-copy"
                },
                {
                    title: TX.tx("Insert copy"),
                    cmd: "insert_copy",
                    uiIcon: "ui-icon-squirrel-paste"
                },
                {
                    title: TX.tx("Delete"),
                    cmd: "delete",
                    uiIcon: "ui-icon-squirrel-delete" 
                }
            ],
            beforeOpen: before_open,
            select: handle_choice
        };

        $("body").contextmenu(menu);
    };

})(jQuery, Squirrel);
