/**
 * "Main Program"
 */

var DEBUG = true;
var USE_STEGANOGRAPHY = false;
var USE_STORE = "TestStore";

/*
 * The Squirrel Application namespace and UI
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
    IS_EMPTY: "is empty"
};

/**
 * Initialise application data (new Squirrel(), effectively)
 */
Squirrel.init_application = function() {
    "use strict";

    // status may be one of IS_EMPTY, IS_CORRUPT, IS_LOADED or
    // NEW_SETTINGS. If the status is anything but IS_LOADED
    // then it is a candidate for saving.
    Squirrel.client = {
        store: null,                 // The store used actively
        hoard: null,                 // The hoard in that store
        status: Squirrel.IS_EMPTY
    };

    Squirrel.cloud = {
        store: null,                 // Temporary memory used during load
        status: Squirrel.IS_EMPTY
    };

    // Initialise UI components
    Squirrel.init_ui();
};

// Event handler for check_alarms
Squirrel.check_alarms = function(/* event */) {
    "use strict";

    Squirrel.client.hoard.check_alarms(
        function(path, expired, next) {
            var $node = Squirrel.Tree.get_node(path);
            $node.treenode("ring_alarm");
            Squirrel.Dialog.squeak(
                $("<p></p>")
                    .append(
                        $("<span></span>")
                        .addClass("ui-icon ui-icon-squirrel-rung"))
                    .append(TX.tx("Reminder on '$1' was due on $2",
                                  path.join("/"),
                                  expired.toLocaleDateString())),
                function() {
                    next();
                });
        });
};

Squirrel.close_menus = function() {
    // Designed to be overridden
};

/**
 * A (manual) new tree node action
 */
Squirrel.add_child_node = function($node, title, value) {
    "use strict";

    var p = $node.treenode("get_path"), sval;
    if (typeof value === "string")
        sval = value;
    p.push(title);

    var res = Squirrel.client.hoard.record_action(
        {
            type: "N",
            path: p,
            data: sval
        },
        function(e) {
            Squirrel.Tree.action(e, function($newnode) {
                if (DEBUG && !$newnode) debugger;
                $newnode.treenode("open");
                if (typeof value !== "string"
                    && typeof value !== "undefined") {
                    Squirrel.insert_data(p, value);
                }
                $newnode.treenode("edit", "key");

                Utils.sometime("update_save");
                Utils.sometime("update_tree");

            }, true);
        });
    if (res !== null)
        Squirrel.Dialog.squeak(res.message);
};

// SMELL: not ported to mobile yet
Squirrel.get_updates_from_cloud = function(cloard, chain) {
    "use strict";

    // This will get triggered whenever both hoards are
    // successfully loaded.
    if (DEBUG) console.debug("Merging from cloud hoard");
    Squirrel.client.hoard.merge_from_cloud(
        cloard,
        Squirrel.Tree.action,
        function(conflicts) {
            if (conflicts.length > 0) {
                var $dlg = $("#dlg_conflicts");
                var $msg = $("#dlg_conflicts_message");
                $msg.empty();
                $.each(conflicts, function(i, c) {
                    var e = c.conflict;
                    $("<div></div>")
                        .text(Hoard.stringify_action(e)
                              + ": " + c.message)
                        .appendTo($msg);
                });
                $dlg.dialog({
                    width: "auto"
                });
            }
            Squirrel.cloud.status = Squirrel.IS_LOADED;
            // Finished with the cloud hoard (for now)
            chain();
        });
};

// Determine if there are unsaved changes, and generate a warning
// message for the caller to use.
Squirrel.unsaved_changes = function(max_changes) {
    "use strict";

    var message = [];

    $(".treenode.modified").each(function() {
        if (DEBUG && !$(this).data("path")
           && !$(this).hasClass("root")) debugger; // Missing data-path
        var path = $(this).data("path") || 'node';
        message.push(TX.tx("$1 has changed",
                           path.replace(Squirrel.PATHSEP, "/")));
    });

    if (message.length > max_changes) {
        var l = message.length;
        message = message.slice(0, max_changes);
        message.push(TX.tx("... and $1 more changes", l - 5));
    }

    if (Squirrel.cloud.status !== Squirrel.IS_LOADED) {
        message.unshift(TX.tx("The $1 hoard $2",
                              Squirrel.cloud.store
                              ? Squirrel.cloud.store.options().identifier
                              : TX.tx("Cloud"),
                              TX.tx(Squirrel.cloud.status)));
    }
    if (Squirrel.client.status !== Squirrel.IS_LOADED) {
        message.unshift(TX.tx("The $1 hoard $2",
                              Squirrel.client.store.options().identifier,
                              TX.tx(Squirrel.client.status)));
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
Squirrel.insert_data = function(path, data) {
    "use strict";

    Squirrel.Dialog.squeak({ title: "Loading" });

    var $messy = $("#activity_message");

    Squirrel.client.hoard.actions_from_hierarchy(
        { data: data },
        function(act, next) { // listener
            //console.debug(Hoard.stringify_action(act));
            act.path = path.slice().concat(act.path);
            var res = Squirrel.client.hoard.record_action(
                act, function (sact) {
                    Squirrel.Tree.action(sact, next);
                });
            if (res !== null)
                Squirrel.Dialog.squeak_more(res.message + "<br />");
            if (next)
                next();
        },
        function() { // chain on complete
            Utils.sometime("update_save");
            Utils.sometime("update_tree");
            Squirrel.Dialog.squeak_more(TX.tx("JSON has been loaded"));
        });
};

Squirrel.save_hoards = function() {
    "use strict";

    Squirrel.Dialog.squeak({
        title: TX.tx("Saving"),
        message: ""
    });

    var client_ok = true;
    var cloud_ok = true;

    var finished = function() {
        if (DEBUG) console.debug("...save finished");
        Utils.sometime("update_save");
        Squirrel.Dialog.squeak_more(client_ok && cloud_ok
                      ? TX.tx("Save complete")
                      : TX.tx("Save encountered errors"));
        if (client_ok && cloud_ok) {
            if (Squirrel.client.hoard.options.autosave)
                Squirrel.Dialog.close_squeak();
            // Otherwise leave it open
        } else
            // Otherwise leave it open, disable auto-save
            Squirrel.client.hoard.options.autosave = false;
    },

    save_client = function() {
        if (DEBUG) console.debug("...save to client");

        if (Squirrel.client.status === Squirrel.IS_LOADED
            && $(".modified").length === 0) {
            finished();
            return;
        }

        Squirrel.client.status = Squirrel.PENDING_SAVE;

        Squirrel.client.store.writes(
            "Squirrel." + Squirrel.client.store.user(),
            JSON.stringify(Squirrel.client.hoard),
            function() {
                if (DEBUG) console.debug("...client save OK");
                $(".modified").removeClass("modified");
                Squirrel.client.status = Squirrel.IS_LOADED;
                Squirrel.Dialog.squeak_more(
                    "<div class='notice'>"
                        + TX.tx("Saved in $1", this.options().identifier)
                        + "</div>");

                finished();
            },
            function(e) {
                if (DEBUG) console.debug("...client save failed " + e);
                Squirrel.Dialog.squeak_more(
                    "<div class='error'>"
                        + TX.tx("Failed to save in $1: $2",
                                this.options().identifier, e)
                        + "</div>");
                client_ok = false;
                finished();
            });
    },

    // Save the given hoard into the cloud.
    update_cloud_store = function(cloard) {
        cloard.actions = cloard.actions.concat(Squirrel.client.hoard.actions);
        if (Squirrel.cloud.store) {
            if (DEBUG) console.debug("...save to cloud");

            Squirrel.cloud.status = Squirrel.PENDING_SAVE;

            Squirrel.cloud.store.writes(
                Squirrel.client.hoard.options.store_path,
                JSON.stringify(cloard),
                function() {
                    if (DEBUG) console.debug("...cloud save OK");
                    Squirrel.client.hoard.actions = [];
                    Squirrel.client.hoard.last_sync = Date.now();
                    Squirrel.Dialog.squeak_more(
                        "<div class='notice'>"
                            + TX.tx("Saved in $1", this.options().identifier)
                            + "</div>");
                    Squirrel.cloud.status = Squirrel.IS_LOADED;
                    Utils.soon(save_client);
                },
                function(e) {
                    if (DEBUG) console.debug("...cloud save failed " + e);
                    Squirrel.Dialog.squeak_more(
                        "<div class='error'>"
                            + TX.tx("Failed to save in $1: $2",
                                    this.options().identifier, e)
                            + "</div>");
                    cloud_ok = false;
                    Utils.soon(save_client);
                });
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
        Squirrel.client.hoard.reconstruct_actions(
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
            Squirrel.cloud.status = Squirrel.IS_LOADED;
        } catch (e) {
            // We'll get here if decryption failed....
            if (DEBUG) console.debug("Cloud hoard JSON parse failed: " + e);
            Squirrel.Dialog.squeak_more(
                "<div class='error'>"
                    + TX.tx("$1 hoard can't be read for update",
                            this.options().identifier)
                    + "</div>");
            Squirrel.cloud.status = Squirrel.IS_CORRUPT;
            cloud_ok = false;
            construct_new_cloud();
            return;
        }
                
        if (Squirrel.cloud.status === Squirrel.IS_LOADED) {
            if (DEBUG) console.debug("...merge cloud ");
            Squirrel.client.hoard.merge_from_cloud(
                cloard, Squirrel.Tree.action);
        }
                
        if ( Squirrel.cloud.status !== Squirrel.IS_LOADED
             || Squirrel.client.hoard.actions.length !== 0) {
            // Only save if there actually some changes
            if (DEBUG) console.debug("...update from cloud ");
            update_cloud_store(cloard);
        } else
            Utils.soon(save_client);
    },

    // Action on the cloud store read failing
    cloud_store_read_failed = function(e) {
        if (DEBUG) console.debug("...cloud read failed " + e);
        if (typeof e !== "string") debugger;
        if (e === AbstractStore.NODATA) {
            if (DEBUG) console.debug(this.options().identifier + " contains NODATA");
            Squirrel.cloud.status = Squirrel.IS_EMPTY;
            construct_new_cloud();
        } else {
            Squirrel.Dialog.squeak_more(
                "<div class='error'>"
                    + TX.tx("Failed to refresh from $1",
                            this.options().identifier)
                    + "<br>" + e + "</div>");
            cloud_ok = false;
            Utils.soon(save_client);
        }
    };

    if (DEBUG) console.debug("Saving; client " + Squirrel.client.status
                             + "; cloud " + Squirrel.cloud.status);
    if (Squirrel.cloud.status === Squirrel.NEW_SETTINGS
        || Squirrel.cloud.status === Squirrel.IS_EMPTY) {
        // Don't attempt to resync out before saving, simply
        // overwrite the cloud.
        if (DEBUG) console.debug("...constructing new cloud because settings");
        construct_new_cloud();
    } else {
        // Reload and save the cloud hoard
        if (DEBUG) console.debug("...reloading cloud");
        Squirrel.cloud.store.reads(
            Squirrel.client.hoard.options.store_path,
            cloud_store_read_ok,
            cloud_store_read_failed);
    }
};

// Last in the initial hoard load sequence
Squirrel.hoards_loaded = function() {
    "use strict";

    $(window).on("beforeunload", function() {
        var us = Squirrel.unsaved_changes(10);
        if (us !== null) {
            us = TX.tx("You have unsaved changes")
                + "\n" + us
                + "\n" + TX.tx("Are you really sure?");
            return us;
        }
    });

    Utils.sometime("update_tree");
    Utils.sometime("update_save");
    Utils.sometime("check_alarms");

    // Flush the sometimes, and allow new sometimes to be set
    Utils.sometime_is_now();
};

/**
 * STEP 6: Called when we have a (possibly empty) client hoard.
*  Try and synch it from the cloud.
 */
Squirrel.load_cloud_hoard = function() {
    "use strict";

    if (Squirrel.cloud.store) {
        if (DEBUG) console.debug(
            "Reading cloud " + Squirrel.cloud.store.options().identifier);
        Squirrel.cloud.store.reads(
            Squirrel.client.hoard.options.store_path,
            function(data) {
                var hoard;
                if (DEBUG) console.debug(this.options().identifier + " is ready");
                try {
                    hoard = JSON.parse(data);
                } catch (e) {
                    if (DEBUG)
                        console.debug("Client hoard JSON parse failed: " + e);
                    Squirrel.Dialog.squeak({
                        title: TX.tx("Error"),
                        message:
                        TX.tx("$1 hoard exists, but can't be read.",
                              this.options().identifier)
                            + TX.tx("Check that you have the correct password.")
                    });
                    Squirrel.cloud.status = Squirrel.IS_CORRUPT;
                    Utils.soon(Squirrel.hoards_loaded);
                    return;
                }
                Squirrel.get_updates_from_cloud(
                    new Hoard(hoard),
                    Squirrel.hoards_loaded);
            },
            function(e) {
                if (e === AbstractStore.NODATA) {
                    if (DEBUG) console.debug(
                        this.options().identifier + " contains NODATA");
                    Squirrel.cloud.status = Squirrel.IS_EMPTY;
                } else {
                    Squirrel.Dialog.squeak({
                        title: TX.tx("Error"),
                        message:
                        TX.tx("Could not load cloud hoard.")
                            + TX.tx("Check that you have the correct password.")
                            + TX.tx("Error was: $1 store error: $2",
                                    this.options().identifier, e)
                    });
                    // Could not contact cloud; continue all the same
                }
                Utils.soon(Squirrel.hoards_loaded);
            });
    } else {
        Squirrel.hoards_loaded();
    }
};

/**
 * STEP 5: Called when there is no existing client hoard, to initialise
 * a new one.
 */
Squirrel.init_client_hoard = function() {
    "use strict";

    if (DEBUG) console.debug("Setting up client hoard");
    Squirrel.client.hoard = new Hoard();
    Squirrel.client.status = Squirrel.IS_EMPTY;

    if (Squirrel.cloud.store.options().needs_path) {
        Squirrel.Dialog.store_settings(Squirrel.load_cloud_hoard);
    } else {
        Squirrel.load_cloud_hoard();
    }
};

/**
 * STEP 4: Once the stores have been initialised, we can load
 * the client hoard. This will give us the baseline cache data and the
 * location of the cloud hoard, so we can then chain loading and merging
 * the cloud hoard.
*/
Squirrel.load_client_hoard = function() {
    "use strict";

    var rebuild_hoard = function() {
        if (DEBUG) console.debug("Reconstructing UI tree from cache");
        Squirrel.client.hoard.reconstruct_actions(
            function(a, next) {
                Squirrel.Tree.action(a);
                // reconstruct_actions uses a queue, so don't chain
                if (next)
                    next();
            },
            function() { // on complete
                // Reset the UI modification list; we just loaded the
                // client hoard
                $(".modified").removeClass("modified");
                // Mark all the nodes in the pending actions list as
                // modified. If a node isn't found, back up the tree
                // until we find a parent that does exist and mark it.
                var as = Squirrel.client.hoard.actions, i, p, $node;
                for (i = 0; i < as.length; i++) {
                    p = as[i].path.slice();
                    while (p.length > 0) {
                        $node = Squirrel.Tree.get_node(p);
                        if ($node) {
                            $node.addClass("modified");
                            break;
                        }
                        p.pop();
                    }
                }
                Utils.soon(Squirrel.load_cloud_hoard);
            });
    };

    if (DEBUG) console.debug("Load client store");

    Squirrel.client.store.reads(
        "Squirrel." + Squirrel.client.store.user(),
        function(data) {
            try {
                Squirrel.client.hoard = new Hoard(JSON.parse(data));
                Squirrel.client.status = Squirrel.IS_LOADED;
            } catch (e) {
                if (DEBUG) console.debug("Caught " + e);
                Squirrel.Dialog.squeak({
                    title: TX.tx("Error"),
                    message:
                    TX.tx("$1 hoard exists, but can't be read.",
                          this.options().identifier)
                        + TX.tx("Check that you have the correct password."),
                    after_close: Squirrel.init_application
                });
                return;
                //Squirrel.client.hoard = new Hoard();
                //Squirrel.client.status = Squirrel.IS_CORRUPT;
            }
            // Make sure we have a store path
            if ((Squirrel.client.store
                 && Squirrel.client.store.options().needs_path
                 || Squirrel.cloud.store
                 && Squirrel.cloud.store.options().needs_path)
                && !Squirrel.client.hoard.options.store_path) {
                Squirrel.Dialog.store_settings(rebuild_hoard);
            } else {
                rebuild_hoard();
            }
        },
        function(e) {
            if (e === AbstractStore.NODATA) {
                if (DEBUG) console.debug(this.options().identifier + " contains NODATA");
                // Construct a new client hoard
                Utils.soon(Squirrel.init_client_hoard);
            } else {
                Squirrel.Dialog.squeak({
                    title: TX.tx("$1 store error", this.options().identifier),
                    message: e,
                    after_close: Squirrel.init_application
                });
            }
        });
};

/**
 * STEP 3: Login, fill in details the stores didn't provide, prompt
 * is needed.
 */
Squirrel.identify_user = function() {
    "use strict";

    var uReq = true;
    var pReq = true;

    // Spread user information determined during store initialisation
    // around.
    if (Squirrel.cloud.store
        && typeof Squirrel.cloud.store.user() !== "undefined") {
        // Force the cloud user onto the client store
        if (DEBUG)
            console.debug("Cloud user is preferred: " + Squirrel.cloud.store.user());
        Squirrel.client.store.user(Squirrel.cloud.store.user());
        uReq = false;
    } else if (Squirrel.client.store
               && typeof Squirrel.client.store.user() !== "undefined") {
        // Force the client user onto the cloud store
        if (DEBUG)
            console.debug("Client user is available: " + Squirrel.client.store.user());
        if (Squirrel.cloud.store)
            Squirrel.cloud.store.user(Squirrel.client.store.user());
        uReq = false;
    }

    if (Squirrel.cloud.store
        && typeof Squirrel.cloud.store.pass() !== "undefined") {
        // Force the cloud pass onto the client store
        if (DEBUG)
            console.debug("Cloud pass is preferred");
        if (Squirrel.client.store)
            Squirrel.client.store.pass(Squirrel.cloud.store.pass());
        pReq = false;
    } else if (Squirrel.client.store
               && typeof Squirrel.client.store.pass() !== "undefined") {
        // Force the client pass onto the cloud store
        if (DEBUG)
            console.debug("Client pass is available");
        if (Squirrel.cloud.store)
            Squirrel.cloud.store.pass(Squirrel.client.store.pass());
        pReq = false;
    }

    // If we still need user or password, prompt
    if (uReq || pReq) {
        Squirrel.Dialog.login({
            store: Squirrel.client.store,
            on_signin: function(user, pass) {
                if (DEBUG) console.debug("Login prompt said user was " + user);
                Squirrel.client.store.user(user);
                Squirrel.client.store.pass(pass);
                if (Squirrel.cloud.store) {
                    Squirrel.cloud.store.user(user);
                    Squirrel.cloud.store.pass(pass);
                }
                Squirrel.authenticated();
            },
            user_required: uReq,
            pass_required: pReq
        });
    } else
        Squirrel.authenticated();
};

/**
 * STEP 2: Once the cloud store is loaded, we can move on to the client store.
 */
Squirrel.init_client_store = function() {
    "use strict";

    // new LocalStorageStore({
    new EncryptedStore({
        understore: function(params) {
            return new LocalStorageStore(params);
        },

        ok: function() {
            if (DEBUG) console.debug(this.options().identifier
                                     + " store is ready");
            Squirrel.client.store = this;
            $("#authmessage").text(TX.tx("Loading..."));
            // Chain the login prompt
            Utils.soon(Squirrel.identify_user);
        },
        fail: function(e) {
            // We did our best!
            Squirrel.Dialog.squeak({
                title: Pages.activity.titles.error,
                message: e
            });
        }
    });
};

/**
 * STEP 1: Establish contact with the cloud, and get user details.
 */
Squirrel.init_cloud_store = function() {
    "use strict";

    var p = {
        ok: function() {
            Squirrel.cloud.store = this;
            // Chain the client store startup
            Utils.soon(Squirrel.init_client_store);
        },
        fail: function(e) {
            Squirrel.Dialog.squeak({
                message: TX.tx("Could not open cloud store: $1", e)
                    + "<p>"
                    + TX.tx("Do you want to continue (only the client store will be available)?"),
                after_close: Squirrel.init_client_store,
                on_cancel: function() {
                    if (DEBUG) console.debug("Cancelled");
                    $(".unauthenticated").hide();
                    $(".authfailed").show();
                }
            });
        }
    };

    p.understore = function(pp) {
        // USE_STEGANOGRAPHY is a global var set in the HTML
        // SQUIRREL_STORE is a constant set by the low-level
        // store module selected in the Makefile
        if (USE_STEGANOGRAPHY) {
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
Squirrel.search = function(s) {
    "use strict";

    var re = new RegExp(s, "i");
    var hits = [];
    $(".key,.value").each(function() {
        if ($(this).text().match(re)) {
            hits.push(this);
        }
    });

    $("#search_hits").text(TX.tx("$1 found", hits.length));
    if (hits.length === 0) {
        Squirrel.Dialog.squeak(
            {
                message: TX.tx("'$1' not found", s)
            });
    } else {
        $("li.treenode-open").each(function() {
            $(this).treenode("close");
        });
        $.each(hits, function(n, v) {
            $(v).parents(".treenode.treenode-collection").each(function() {
                $(this).treenode("open");
            });
        });
    }
};

(function ($) {
    "use strict";

    $(document)
        .ready(function() {
            // By default, jQuery timestamps datatype 'script' and 'jsonp'
            // requests to avoid them being cached by the browser.
            // Disable this functionality by default so that as much as
            // possible is cached locally
            if (!DEBUG) $.ajaxSetup({ cache: true });

            var store_bits = [ "common/" + USE_STORE + ".js" ];
            if (USE_STEGANOGRAPHY)
                store_bits.push("common/StegaStore.js");
            else
                $(".using_steganography").remove();
            Utils.load(store_bits, function () {
                // Initialise translation module,
                // and chain the application init
                TX.init(Squirrel.init_application);
            });
        });
})(jQuery);
