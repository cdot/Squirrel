/* Copyright (C) 2015 Crawford Currie http://c-dot.co.uk / MIT */

/*
 * The Squirrel Application namespace and UI
 */

var Squirrel = {};                     // Namespace

/**
 * Event handler to update the tree view when data changes
 */
Squirrel.update_tree = function(/*event*/) {
    "use strict";

    $("#bonsai-root").bonsai("update");
    $("#bonsai-root").bonsai("expand", $("#sites-node"));
};

Squirrel.close_menus = function() {
    "use strict";

    $("#bonsai-root").contextmenu("close");
    $("#extras_menu").hide();
};

// Event handler for check_alarms
Squirrel.check_alarms = function(/* event */) {
    "use strict";

    Squirrel.client.hoard.check_alarms(
        function(path, expired, next) {
            var $node = Squirrel.Tree.node(path);
            $node
                .find(".alarm")
                .addClass("expired")
                .find(".squirrel-icon-alarm")
                .removeClass("squirrel-icon-alarm")
                .addClass("squirrel-icon-rung");
            Squirrel.Dialog.squeak(
                $("<p></p>")
                    .append(
                        $("<span></span>")
                        .addClass("ui-icon squirrel-icon-rung"))
                    .append(TX.tx("Reminder on '$1' was due on $2",
                                  path.join("/"),
                                  expired.toLocaleDateString())),
                function() {
                    next();
                });
        });
};

/**
 * Edit a node in place, used for renaming and revaluing
 */
Squirrel.edit_node = function($node, what) {
    "use strict";

    var $span = $node.children(".node_div").children("." + what);

    // Fit width to the container
    var w = $("#bonsai-root").width();
    $span.parents().each(function() {
        w -= $(this).position().left;
    });

    $span.edit_in_place({
        width: w,
        changed: function(s) {
            var e = Squirrel.client.hoard.record_action(
                { type: what === "key" ? "R" : "E",
                  path: Squirrel.Tree.path($node),
                  data: s },
                function(ea) {
                    Squirrel.Tree.action(
                        ea,
                        function(/*$newnode*/) {
                            Utils.sometime("update_save");
                            Utils.sometime("update_tree");
                        }, true);
                });
            if (e !== null)
                Squirrel.Dialog.squeak(e.message);
        }
    });
};

// Attach handlers to an alarm button
Squirrel.attach_alarm_handlers = function($node) {
    "use strict";

    $node.children(".alarm")
        .on("click", function() {
            Squirrel.close_menus();
            Squirrel.Dialog.alarm($node);
        });
};

// Attach handlers to a node's parts
Squirrel.attach_node_handlers = function($node) {
    "use strict";

    var $div = $node.children(".node_div");

    $div.linger();    // long-mouse-press -> taphold mapping

    $div.hover(
        function(/*evt*/) {
            Squirrel.close_menus();
            $(this)
                .addClass("hover");
            $("<div class='lastmod'></div>")
                .text($node.data("last-mod"))
                .appendTo($(this));
        },
        function(/*evt*/) {
            $(this)
                .removeClass("hover")
                .find(".lastmod")
                .remove();
        });

    $div.children(".key,.value")
        .on("click", function(/*e*/) {
            var $span = $(this);
            Squirrel.close_menus();
            // Prevent click from bubbling, only obey double click
            // Not perfect, but good enough.
            $span.data(
                "click_timer",
                window.setTimeout(
                    function() {
                        if ($span.data("click_timer") !== null) {
                            $span.data("click_timer", null);
                            // Same as the node_div handler below
                            Squirrel.close_menus();
                            $("#bonsai-root")
                                .bonsai(
                                    $node.hasClass("expanded")
                                        ? "collapse" : "expand", $node);
                        }
                    },
                    250));
            return false;
        });

    $div.children(".key")
        .on("dblclick", function() {
            // "click" is always done first, so menus already closed
            $(this).data("click_timer", null);
            Squirrel.edit_node($node, "key");
        });

    $div.children(".value")
        .on("dblclick", function() {
            // "click" is always done first, so menus already closed
            $(this).data("click_timer", null);
            Squirrel.edit_node($node, "value");
        });

    $div.filter(".treecollection")
        .on("click", function(/*e*/) {
            Squirrel.close_menus();
            $("#bonsai-root")
                .bonsai(
                    $node.hasClass("expanded")
                        ? "collapse" : "expand", $node);
            return false;
        });
};

/**
 * A (manual) new tree node action
 */
Squirrel.add_child_node = function($node, title, value) {
    "use strict";

    var p = Squirrel.Tree.path($node), sval;
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
                // There's a problem with bonsai when you create
                // new nodes at the end; it doesn't let you close
                // the new nodes. However this clears after a
                // save and is a minor niggle only. Classing them
                // as expanded solves it well enough.
                $newnode
                    .addClass("expanded")
                    .scroll_into_view()
                    .parents("ul")
                    .bonsai("expand", $node);
                if (typeof value !== "string"
                    && typeof value !== "undefined") {
                    Squirrel.insert_data(p, value);
                }
                Squirrel.edit_node($newnode, "key");
            }, true);
        });
    if (res !== null)
        Squirrel.Dialog.squeak(res.message);
};

/**
 * Insert data from a structure under the given path
 * @param path path to the parent below which this data will be inserted
 * @param data hoard cache format data
*/
Squirrel.insert_data = function(path, data) {
    "use strict";

    var load_log = [];
    $("#dlg_loading").dialog({
        modal: true
    });
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
                load_log.push(res.message);
            if (next)
                next();
        },
        function() { // chain on complete
            Utils.sometime("update_save");
            Utils.sometime("update_tree");
            $("#dlg_loading").dialog("close");
            Squirrel.Dialog.squeak(
                TX.tx("JSON has been loaded") + "<br />"
                    + load_log.join("<br />"));
        });
};

/**
 * Perform a text search
 */
Squirrel.search = function(s) {
    "use strict";

    $(".node .expanded").each(function() {
        $("#bonsai-root").bonsai("collapse", $(this));
    });

    var re = new RegExp(s, "i");
    var hits = 0;
    $(".key,.value").each(function() {
        if ($(this).text().match(re)) {
            hits++;
            $(this).parents(".node").each(function() {
                $("#bonsai-root").bonsai("expand", $(this));
            });
        }
    });
    $("#search_hits").text(TX.tx("$1 found", hits));
};

/**
 * Event handler to update the save button based on hoard state
 */
Squirrel.update_save = function(/*event*/) {
    "use strict";

    $("#undo_button").toggle(Squirrel.Tree.can_undo());
    $("#menu_disas").toggle(Squirrel.client.hoard.options.autosave);
    $("#menu_enass").toggle(!Squirrel.client.hoard.options.autosave);

    var us = Squirrel.unsaved_changes(3);
    if (us !== null) {
        if (Squirrel.client.hoard.options.autosave) {
            Squirrel.save_hoards();
        } else {
            $("#save_button").attr(
                "title",
                TX.tx("Save is required because: ") + us);
            $("#save_button").show();
        }
    } else {
        $("#save_button").hide();
    }
};

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
            // TX.tx("is loaded")
            Squirrel.cloud.status = "is loaded";
            // Finished with the cloud hoard (for now)
            chain();
        });
};

// Determine if there are unsaved changes, and generate a warning
// message for the caller to use.
Squirrel.unsaved_changes = function(max_changes) {
    "use strict";

    var message = [];

    $(".node.modified").each(function() {
        if (DEBUG && !$(this).data("path")) debugger; // Missing data-path
        message.push(TX.tx("$1 has changed", $(this).data("path")));
    });

    if (message.length > max_changes) {
        var l = message.length;
        message = message.slice(0, max_changes);
        message.push(TX.tx("... and $1 more changes", l - 5));
    }

    if (Squirrel.cloud.status !== "is loaded") {
        message.unshift(TX.tx("The $1 hoard $2",
                              Squirrel.cloud.store
                              ? Squirrel.cloud.store.identifier()
                              : TX.tx("Cloud"),
                              TX.tx(Squirrel.cloud.status)));
    }
    if (Squirrel.client.status !== "is loaded") {
        message.unshift(TX.tx("The $1 hoard $2",
                              Squirrel.client.store.identifier(),
                              TX.tx(Squirrel.client.status)));
    }

    if (message.length === 0)
        return null;

    return message.join("\n");
};

Squirrel.save_hoards = function() {
    "use strict";

    var $messy = $("#dlg_saving_message"),

    $dlg = $("#dlg_saving"),
    client_ok = true,
    cloud_ok = true;

    $messy.empty();

    $dlg.dialog({
        modal: true
    });

    var finished = function() {
        Utils.sometime("update_save");
        $messy.append(client_ok && cloud_ok
                      ? TX.tx("Save complete")
                      : TX.tx("Save encountered errors"));
        if (client_ok && cloud_ok) {
            if (Squirrel.client.hoard.options.autosave)
                $dlg.dialog("close");
            // Otherwise leave it open
        } else
            // Otherwise leave it open, disable auto-save
            Squirrel.client.hoard.options.autosave = false;
    },

    save_client = function() {
        if (Squirrel.client.status === "is loaded"
            && $(".modified").length === 0) {
            finished();
            return;
        }

        Squirrel.client.store.writes(
            "Squirrel." + Squirrel.client.store.user(),
            JSON.stringify(Squirrel.client.hoard),
            function() {
                $(".modified").removeClass("modified");
                // TX.tx("is loaded")
                Squirrel.client.status = "is loaded";
                $messy.append(
                    "<div class='notice'>"
                        + TX.tx("Saved in $1", this.identifier())
                        + "</div>");

                finished();
            },
            function(e) {
                $messy.append(
                    "<div class='error'>"
                        + TX.tx("Failed to save in $1: $2",
                                this.identifier(), e)
                        + "</div>");
                client_ok = false;
                finished();
            });
    },

    // Save the given hoard into the cloud.
    update_cloud_store = function(cloard) {
        cloard.actions = cloard.actions.concat(Squirrel.client.hoard.actions);
        if (Squirrel.cloud.store) {
            Squirrel.cloud.store.writes(
                Squirrel.client.hoard.options.store_path,
                JSON.stringify(cloard),
                function() {
                    Squirrel.client.hoard.actions = [];
                    Squirrel.client.hoard.last_sync = Date.now();
                    $messy.append(
                        "<div class='notice'>"
                            + TX.tx("Saved in $1", this.identifier())
                            + "</div>");
                    // TX.tx("is loaded")
                    Squirrel.cloud.status = "is loaded";
                    Utils.soon(save_client);
                },
                function(e) {
                    $messy.append(
                        "<div class='error'>"
                            + TX.tx("Failed to save in $1: $2",
                                    this.identifier(), e)
                            + "</div>");
                    cloud_ok = false;
                    Utils.soon(save_client);
                });
        } else
            save_client();
    },

    // Construct a new cloud hoard from data in the client. This will
    // happen if the cloud is read and found to be empty or corrupt,
    // but not if the read failed.
    construct_new_cloud = function() {
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

    // Action on the clouad store being read OK
    cloud_store_read_ok = function(data) {
        var cloard;
        try {
            cloard = new Hoard(JSON.parse(data));
            // TX.tx("is loaded")
            Squirrel.cloud.status = "is loaded";
        } catch (e) {
            // We'll get here if decryption failed....
            if (DEBUG) console.debug("Cloud hoard JSON parse failed: " + e);
            $messy.append(
                "<div class='error'>"
                    + TX.tx("$1 hoard can't be read for update",
                            this.identifier())
                    + "</div>");
            // TX.tx("is corrupt")
            Squirrel.cloud.status = "is corrupt";
            cloud_ok = false;
            construct_new_cloud();
            return;
        }
                
        if (Squirrel.cloud.status === "is loaded") {
            Squirrel.client.hoard.merge_from_cloud(
                cloard, Squirrel.Tree.action);
        }
                
        if ( Squirrel.cloud.status !== "is loaded"
             || Squirrel.client.hoard.actions.length !== 0)
            // Only save if there actually some changes
            update_cloud_store(cloard);
        else
            Utils.soon(save_client);
    },

    // Action on the cloud store read failing
    cloud_store_read_failed = function(e) {
        if (e === AbstractStore.NODATA) {
            if (DEBUG) console.debug(this.identifier() + " contains NODATA");
            // TX.tx("is empty")
            Squirrel.cloud.status = "is empty";
            construct_new_cloud();
        } else {
            $messy.append(
                "<div class='error'>"
                    + TX.tx("Failed to refresh from $1",
                            this.identifier())
                    * "<br>" + e + "</div>");
            cloud_ok = false;
            Utils.soon(save_client);
        }
    };

    if (Squirrel.cloud.status === "has new password"
        || Squirrel.cloud.status === "is empty") {
        // Don't attempt to resync out before saving, simply
        // overwrite the cloud.
        construct_new_cloud();
    } else {
        // Reload and save the cloud hoard
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

    $(".unauthenticated").hide();
    $(".authenticated").show();
};

/**
 * STEP 6: Called when we have a (possibly empty) client hoard.
*  Try and synch it from the cloud.
 */
Squirrel.load_cloud_hoard = function() {
    "use strict";

    if (Squirrel.cloud.store) {
        if (DEBUG) console.debug(
            "Reading cloud " + Squirrel.cloud.store.identifier());
        Squirrel.cloud.store.reads(
            Squirrel.client.hoard.options.store_path,
            function(data) {
                var hoard;
                if (DEBUG) console.debug(this.identifier() + " is ready");
                try {
                    hoard = JSON.parse(data);
                } catch (e) {
                    if (DEBUG) console.debug("Client hoard JSON parse failed: " + e);
                    Squirrel.Dialog.squeak(
                        TX.tx("$1 hoard exists, but can't be read. Check that you have the correct password.",
                        this.identifier()));
                    // TX.tx("is corrupt")
                    Squirrel.cloud.status = "is corrupt";
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
                        this.identifier() + " contains NODATA");
                    // TX.tx("is empty")
                    Squirrel.cloud.status = "is empty";
                } else {
                    Squirrel.Dialog.squeak(
                        TX.tx("Could not load cloud hoard; do you have the correct password? Error was: $1 store error: $2", this.identifier(), e));
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
 * a new one. Take the opportunity to seed the image used in steganography.
 */
Squirrel.init_client_hoard = function() {
    "use strict";

    Squirrel.client.hoard = new Hoard();
    // TX.tx("is empty")
    Squirrel.client.status = "is empty";
    Squirrel.Dialog.store_settings(
        function() {
            Utils.soon(Squirrel.load_cloud_hoard);
        });
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
                        $node = Squirrel.Tree.node(p);
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
                // TX.tx("is loaded")
                Squirrel.client.status = "is loaded";
            } catch (e) {
                Squirrel.Dialog.squeak(
                    TX.tx("$1 hoard exists, but can't be read. Check that you have the correct password.", this.identifier()),
                    Squirrel.init_application);
                return;
                //Squirrel.client.hoard = new Hoard();
                // TX.tx("is corrupt")
                //Squirrel.client.status = "is corrupt";
            }
            // Make sure we have a store path
            if (!Squirrel.client.hoard.options.store_path) {
                Squirrel.Dialog.store_settings(
                    function() {
                        rebuild_hoard();
                    });
            } else
                rebuild_hoard();
        },
        function(e) {
            if (e === AbstractStore.NODATA) {
                if (DEBUG) console.debug(this.identifier() + " contains NODATA");
                // Construct a new client hoard
                Squirrel.init_client_hoard();
            } else {
                Squirrel.Dialog.squeak(
                    TX.tx("$1 store error: $2", this.identifier(), e),
                    Squirrel.init_application);
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
        console.debug("Cloud user is preferred");
        Squirrel.client.store.user(Squirrel.cloud.store.user());
        uReq = false;
    } else if (Squirrel.client.store
               && typeof Squirrel.cloud.store.user() !== "undefined") {
        // Force the client user onto the cloud store
        console.debug("Client user is available");
        if (Squirrel.cloud.store)
            Squirrel.cloud.store.user(Squirrel.client.store.user());
        uReq = false;
    }

    if (Squirrel.cloud.store
        && typeof Squirrel.cloud.store.pass() !== "undefined") {
        // Force the cloud pass onto the client store
        console.debug("Cloud pass is preferred");
        Squirrel.client.store.pass(Squirrel.cloud.store.pass());
        pReq = false;
    } else if (Squirrel.client.store
               && typeof Squirrel.cloud.store.pass() !== "undefined") {
        // Force the client pass onto the cloud store
        console.debug("Client pass is available");
        if (Squirrel.cloud.store)
            Squirrel.cloud.store.pass(Squirrel.client.store.pass());
        pReq = false;
    }

    // If we still need user or password, prompt
    if (uReq|| pReq) {
        Squirrel.Dialog.login.call(
            Squirrel.client.store,
            function(user, pass) {
                if (Squirrel.client.store) {
                    Squirrel.client.store.user(user);
                    Squirrel.client.store.pass(pass);
                }
                if (Squirrel.cloud.store) {
                    Squirrel.cloud.store.user(user);
                    Squirrel.cloud.store.pass(pass);
                }
                Utils.soon(Squirrel.load_client_hoard);
            },
            function(e) {
                Squirrel.Dialog.squeak(e);
            },
            uReq,
            pReq);
    } else
        Utils.soon(Squirrel.load_client_hoard);
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
            if (DEBUG) console.debug(this.identifier() + " store is ready");
            $("#whoami").text(this.user());
            Squirrel.client.store = this;
            $(".unauthenticated").text(TX.tx("Loading..."));
            // Chain the login prompt
            Utils.soon(Squirrel.identify_user);
        },
        fail: function(e) {
            // We did our best!
            Squirrel.Dialog.squeak(TX.tx("Failed ") + e);
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
            Squirrel.Dialog.squeak(
                TX.tx("Could not open cloud store: $1", e)
                    + "<p>"
                    + TX.tx("Do you want to continue (only the client store will be available)?"),
                Squirrel.init_client_store,
                function() {
                    if (DEBUG) console.debug("Cancelled");
                    $(".unauthenticated").hide();
                    $(".authfailed").show();
                });
        }
    };

    p.understore = function(pp) {
        pp.understore = function(ppp) {
            // SQUIRREL_STORE is a class name set by the Makefile
            return new SQUIRREL_STORE(ppp);
        };
        return new StegaStore(pp);
    };

    return new EncryptedStore(p);
};

/**
 * Initialise handlers and jQuery UI components
 */
Squirrel.init_ui = function() {
    "use strict";

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
            .on("click", function() {
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
            .on("click", function() {
                $this.hide();
                $help.show();
            })
            .prependTo($this);
    });

    Squirrel.Tree.set_root($("#sites-node"));

    $("#save_button")
        .button({
            icons: {
                primary: "squirrel-icon-save"
            },
            text: false
        })
        .hide()
        .on("click", function(/*evt*/) {
            Squirrel.close_menus();
            Squirrel.save_hoards();
            return false;
        });

    $("#undo_button")
        .button({
            icons: {
                primary: "squirrel-icon-undo"
            },
            text: false
        })
        .hide()
        .on("click", function(/*evt*/) {
            Squirrel.close_menus();
            Squirrel.Tree.undo(Squirrel.squeak);
            return false;
        });

    var zc = new ZeroClipboard(
        $("#extras_menu > li[data-command='copydb']"))
        .on("copy", function(event) {
            event.clipboardData.setData(
                "text/plain",
                JSON.stringify(Squirrel.client.hoard));
        });

    $("#extras_menu")
        .menu({
            focus: function(/*evt, ui*/) {
                Squirrel.close_menus();
                $(this).show();
            },
            select: function(evt, ui) {
                $(this).hide();
                switch (ui.item.data("command")) {
                case "enass":
                    Squirrel.client.hoard.options.autosave = true;
                    Utils.sometime("update_save");
                    break;
                case "disas":
                    Squirrel.client.hoard.options.autosave = false;
                    Utils.sometime("update_save");
                    break;
                case "chpw":
                    Squirrel.Dialog.change_password();
                    break;
                case "chss":
                    Squirrel.Dialog.store_settings();
                    break;
                case "copydb":
                    // Handled by zero clipboard
                    break;
                case "readfile":
                    $("#dlg_load_file").trigger("click");
                    break;
                default:
                    if (DEBUG) debugger; // Bad data-command
                }
            },
            blur: function(/*evt, ui*/) {
                $(this).hide();
            }
        })
        .data("ZC", zc); // Protect from GC
 
    $("#dlg_load_file")
        .change(function(evt) {
            var file = evt.target.files[0];
            if (!file)
                return;
            Utils.read_file(
                file,
                function(str) {
                    var data;
                    try {
                        data = JSON.parse(str);
                    } catch (e) {
                        Squirrel.Dialog.squeak(TX.tx(
                            "JSON could not be parsed")
                                               + ": " + e);
                        return;
                    }
                    if (DEBUG) console.debug("Importing...");
                    if (typeof data.cache === "object" &&
                        typeof data.actions !== undefined &&
                        typeof data.cache.data === "object")
                        // a hoard
                        Squirrel.insert_data([], data.cache.data);
                    else
                        // raw data
                        Squirrel.insert_data([], data);
                },
                Squirrel.Dialog.squeak);
        });

    $("#extras_button")
        .button({
            icons: {
                primary: "squirrel-icon-gear"
            },
            text: false
        })
        .on("click", function(/*evt*/) {
            $("#bonsai-root").contextmenu("close");
            $("#extras_menu")
                .show()
                .position({
                    my: "left top",
                    at: "left bottom",
                    of: this
                });
            return false;
        });

    $("#bonsai-root").bonsai();

    $("#search")
        .on("click", Squirrel.close_menus)
        .on("change", function(/*evt*/) {
            Squirrel.close_menus();
            $("#search_hits").text(TX.tx("Searching..."));
            Squirrel.search($(this).val());
        });

    Squirrel.ContextMenu.init($("#bonsai-root"));

    $(document)
        .on("check_alarms", Squirrel.check_alarms)
        .on("update_save", Squirrel.update_save)
        .on("update_tree", Squirrel.update_tree);
};

/**
 * Initialise application data (new Squirrel(), effectively)
 */
Squirrel.init_application = function() {
    "use strict";

    // Initialise UI components
    Squirrel.init_ui();

    // status may be one of "is empty", "is corrupt", "is loaded" or
    // "has a new password". If the status is anything but "is loaded"
    // then it is a candidate for saving.
    Squirrel.client = {
        store: null,                 // The store used actively
        hoard: null,                 // The hoard in that store
        status: "is empty"
    };

    Squirrel.cloud = {
        store: null,                 // Temporary memory used during load
        status: "is empty"
    };

    Squirrel.clipboard = null;

    // Kick off by initialising the cloud store.
    Squirrel.init_cloud_store();
};

/**
 * "Main Program"
 */
(function ($) {
    "use strict";

    $(document)
        .ready(function() {
            // By default, jQuery timestamps datatype 'script' and 'jsonp'
            // requests to avoid them being cached by the browser.
            // Disable this functionality by default so that as much as
            // possible is cached locally
            if (!DEBUG) $.ajaxSetup({ cache: true });

            // Initialise translation module, and chain the application init
            TX.init(Squirrel.init_application);
        });

})(jQuery);
