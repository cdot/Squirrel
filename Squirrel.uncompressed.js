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
    $node.children(".alarm")
        .on("click", function() {
            Squirrel.close_menus();
            Squirrel.Dialog.alarm($node);
        })
};

// Attach handlers to a node's parts
Squirrel.attach_node_handlers = function($node) {
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
            var $span = $(this);
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
        })

    $div.children(".value")
        .on("dblclick", function() {
            // "click" is always done first, so menus already closed
            $(this).data("click_timer", null);
            Squirrel.edit_node($node, "value");
        })

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
            next();
        },
        function() { // chain on complete
            Utils.sometime("update_save");
            Utils.sometime("update_tree");
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
                              Squirrel.cloud.store.identifier(),
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
        $messy.append(TX.tx("Save complete."));
        if (client_ok && cloud_ok)
            Utils.sometime(function() {
                $dlg.dialog("close");
            });
        else
            // Otherwise leave it open, disable auto-save
            Squirrel.client.hoard.options.autosave = false;
    },

    save_client = function() {
        if (Squirrel.client.status === "is loaded"
            && $(".modified").length === 0) {
            finished();
            return;
        }

        Squirrel.client.store.write(
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
        Squirrel.cloud.store.write(
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
                next();
            });
        update_cloud_store(cloard);
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

    if (Squirrel.cloud.status === "has new password") {
        // Don't attempt to resync out before saving, simply
        // overwrite the cloud. Changing password is risky!
        construct_new_cloud();
    } else {
        // Reload and save the cloud hoard
        Squirrel.cloud.store.read(
            cloud_store_read_ok, cloud_store_read_failed);
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

    $("#autosave_checkbox")
        .prop("checked", Squirrel.client.hoard.options.autosave);

    $(".unauthenticated").hide();
    $(".authenticated").show();
};

Squirrel.load_cloud_store = function() {
    "use strict";

    if (Squirrel.cloud.store) {
        if (DEBUG) console.debug(
            "Reading cloud " + Squirrel.cloud.store.identifier());
        Squirrel.cloud.store.read(
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
                        TX.tx("$1 store error: $2", this.identifier(), e));
                    // Could not contact cloud; continue all the same
                }
                Utils.soon(Squirrel.hoards_loaded);
            });
    } else {
        Squirrel.hoards_loaded();
    }
};

Squirrel.load_client_store = function() {
    "use strict";

    if (DEBUG) console.debug("Load client store");
    Squirrel.client.store.read(
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

            if (DEBUG) console.debug("Reconstructing UI tree from cache");
            Squirrel.client.hoard.reconstruct_actions(
                Squirrel.Tree.action,
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
                    Utils.soon(Squirrel.load_cloud_store);
                });
        },
        function(e) {
            if (e === AbstractStore.NODATA) {
                Squirrel.client.hoard = new Hoard();
                if (DEBUG) console.debug(this.identifier() + " contains NODATA");
                // TX.tx("is empty")
                Squirrel.client.status = "is empty";
                Utils.soon(Squirrel.load_cloud_store);
            } else {
                Squirrel.Dialog.squeak(
                    TX.tx("$1 store error: $2", this.identifier(), e),
                    Squirrel.init_application);
            }
        });
};

Squirrel.init_ui = function() {
    "use strict";

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
                case "chpw":
                    Squirrel.Dialog.change_password();
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
                function(data) {
                    try {
                        data = JSON.parse(data);
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
        .button()
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

    $("#autosave_checkbox")
        .on("change", function() {
            Squirrel.client.hoard.options.autosave = $(this).is(":checked");
            Utils.sometime("update_save");
        });

    Squirrel.ContextMenu.init($("#bonsai-root"));

    $(document)
        .on("check_alarms", Squirrel.check_alarms)
        .on("update_save", Squirrel.update_save)
        .on("update_tree", Squirrel.update_tree);
};

Squirrel.init_client_store = function() {
    "use strict";

    //new LocalStorageStore({
    new EncryptedStore({
        engine: LocalStorageStore,

        dataset: "Local Hoard",
        ok: function() {
            if (DEBUG) console.debug(this.identifier() + " store is ready");
            $("#whoami").text(this.user());
            Squirrel.client.store = this;
            $(".unauthenticated").text(TX.tx("Loading..."));
            Utils.soon(Squirrel.load_client_store);
        },
        fail: function(e) {
            // We did our best!
            Squirrel.Dialog.squeak(TX.tx("Failed ") + e);
        },
        identify: function(ok, fail, uReq, pReq) {
            // Won't ever get here unless uReq || pReq
            if (uReq && Squirrel.cloud.store
                && typeof Squirrel.cloud.store.user() !== "undefined") {

                uReq = false; // user is in cloud store

                if (pReq) {
                    if (Squirrel.cloud.store
                         && typeof Squirrel.cloud.store.pass() !== "undefined") {
                        // The cloud store loaded OK, we will re-use the
                        // password for the client store
                        ok.call(this,
                                Squirrel.cloud.store.user(),
                                Squirrel.cloud.store.pass());
                        return;
                    } else {
                        // The cloud store loaded but didn't require a
                        // password. SMELL: as they are both Encrypted,
                        // this should never happen.
                        if (DEBUG) console.debug("I didn't expect to have to prompt for a client password");
                        $("#dlg_login_user").val(
                            Squirrel.cloud.store.user());
                        // Fall through to prompt for password
                    }
                } else {
                    ok.call(this, Squirrel.cloud.store.user());
                    return;
                }
            } else if (Squirrel.cloud.store
                       && typeof Squirrel.cloud.store.pass() !== "undefined") {
                if (!uReq) {
                    // We were only asked for a password.
                    ok.call(this, undefined, Squirrel.cloud.store.pass());
                    return;
                }
                // Fall through to prompt for the username
                $("#dlg_login_pass").val(
                    Squirrel.cloud.store.pass());
                pReq = false;
            }
            Squirrel.Dialog.login.call(this, ok, fail, uReq, pReq);
        }
    });
};

Squirrel.init_cloud_store = function() {
    "use strict";

    var params = {
        dataset: "Cloud Hoard",
        ok: function() {
            Squirrel.cloud.store = this;
            Squirrel.init_client_store();
        },
        fail: function(e) {
            Squirrel.Dialog.squeak(
                TX.tx("Could not contact cloud store: $1", e),
                Squirrel.init_client_store);
        },
        identify: Squirrel.Dialog.login
    };

    if (typeof SQUIRREL_STORE !== "undefined") {
        params.engine = SQUIRREL_STORE;
    } else {
        if (DEBUG) console.debug("Using LocalStorage for the Cloud");
        params.engine = LocalStorageStore;
    }

    //new params.engine(params);
    new EncryptedStore(params);
};

Squirrel.init_application = function() {
    "use strict";

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

    Squirrel.init_cloud_store();
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
            // Initialise UI components
            Squirrel.init_ui();
            // Initialise translation module
            TX.init(Squirrel.init_application);
        });

})(jQuery);
