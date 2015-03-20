/* Copyright (C) 2015 Crawford Currie http://c-dot.co.uk / MIT */

var Squirrel = {                     // Namespace
    // status may be one of "is empty", "is corrupt", "is loaded" or
    // "has a new password". If the status is anything but "is loaded"
    // then it is a candidate for saving.
    client: {
        store: null,                 // The store used actively
        hoard: null,                 // The hoard in that store
        status: "is empty"
    },
    cloud: {
        store: null,                 // Temporary memory used during load
        status: "is empty"
    },

    PATHSEP: String.fromCharCode(1), // separator used in Path->node mapping
    nodes: {},                       // Path->node mapping

    // undo stack, this session only
    undo_stack: [],

    clipboard: null
};

/**
 * Reconstruct the path for an item from the DOM, populating the
 * node->path->node mappings in the process
 */
Squirrel.get_path = function($node) {
    "use strict";

    if (!$node.hasClass("node"))
        $node = $node.closest(".node");

    var ps = $node.data("path"), path;
    if (typeof ps !== "undefined" && ps !== null)
        return ps.split(Squirrel.PATHSEP);

    if (typeof $node.data("key") !== "undefined") {
        path = Squirrel.get_path($node.parent().closest(".node"));

        path.push($node.data("key"));

        ps = path.join(Squirrel.PATHSEP);

        // node->path mapping
        $node.data("path", ps);

        // path->node mapping
        if (DEBUG && Squirrel.nodes[ps] && Squirrel.nodes[ps] !== $node)
            debugger;
        Squirrel.nodes[ps] = $node;
    } else
        path = [];

    return path;
};

/**
 * Remove the node (and all subnodes) from the node->path->node mappings
 */
Squirrel.demap = function($node) {
    "use strict";

    if (!$node.hasClass("node"))
        $node = $node.closest(".node");

    delete Squirrel.nodes[$node.data("path")];
    $node
        .data("path", null)
        // Reset the path of all subnodes
        .find(".node")
        .each(function() {
            var $s = $(this);
            delete Squirrel.nodes[$s.data("path")];
            $s.data("path", null);
        });
};

/**
 * Undo the most recent action
 */
Squirrel.undo = function() {
    "use strict";

    if (DEBUG && Squirrel.undo_stack.length === 0) throw "Whoops";

    var a = Squirrel.undo_stack.pop();
    a.time = Date.now();
    if (DEBUG) console.debug("Undo " + Hoard.stringify_action(a));
    var res = Squirrel.client.hoard.record_action(
        a,
        function(e) {
            Squirrel.render_action(
                e,
                function() {
                    // If there are no undos, there can be no modifications.
                    // The hoard status will not be changed, though, so a
                    // save may still be required.
                    if (Squirrel.undo_stack.length === 0)
                        $(".modified").removeClass("modified");
                    Utils.sometime("update_save");
                    Utils.sometime("update_tree");
                });
        });
    if (res !== null)
        Squirrel.squeak(res.message);
};

/**
 * Generate a message for the last modified time, used in the title of nodes.
 */
Squirrel.last_mod = function(time) {
    "use strict";

    var d = new Date(time);
    return TX.tx("Last modified at $1. Click and hold to open menu.",
                 d.toLocaleString());
};

/**
 * Event handler to update the tree view when data changes
 */
Squirrel.update_tree = function() {
    "use strict";

    $("#bonsai-root").bonsai("update");
    $("#bonsai-root").bonsai("expand", $("#sites-node"));
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
            var old_path = Squirrel.get_path($node);
            var e = Squirrel.client.hoard.record_action(
                { type: what === "key" ? "R" : "E",
                  path: old_path,
                  data: s },
                function(ea) {
                    Squirrel.render_action(
                        ea,
                        function(/*$newnode*/) {
                            Utils.sometime("update_save");
                            Utils.sometime("update_tree");
                        }, true);
                });
            if (e !== null)
                Squirrel.squeak(e.message);
        }
    });
};

/**
 * A (manual) new tree node action
 */
Squirrel.add_child_node = function($node, title, value) {
    "use strict";

    var p = Squirrel.get_path($node);
    var action = {
        type: "N",
        path: p
    };
    if (typeof value === "string") {
        action.data = value;
    }
    p.push(title);
    var res = Squirrel.client.hoard.record_action(
        action,
        function(e) {
            Squirrel.render_action(e, function($newnode) {
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
        Squirrel.squeak(res.message);
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
                    Squirrel.render_action(sact, next);
                });
            if (res !== null)
                load_log.push(res.message);
            next();
        },
        function() { // chain on complete
            Utils.sometime("update_save");
            Utils.sometime("update_tree");
            Squirrel.squeak(
                TX.tx("JSON has been loaded") + "<br />"
                    + load_log.join("<br />"));
        });
};

/**
 * Perform a text search
 */
Squirrel.search = function(s) {
    "use strict";

    var $sar = $("#search_results");
    $sar.empty();
    var re = new RegExp(s, "i");
    $(".key").each(function() {
        if ($(this).text().match(re)) {
            var $li = $(this).closest("li");
            var path = Squirrel.get_path($li);
            var $res = $("<a></a>");
            $res
                .attr("href", "#" + Utils.fragmentify(path.join(":")))
                .addClass("search_result")
                .text(path.join("/"))
                .on("click", function() {
                    $("#bonsai-root")
                        .contextmenu("close")
                        .bonsai("collapseAll")
                        .bonsai("expand", $li);
                    // Zoom up the tree opening each level we find
                    $li.parents("li.node").each(function() {
                        $("#bonsai-root").bonsai("expand", $(this));
                    });
                });
            $sar.append($res).append("<br />");
        }
    });
};

/**
 * Event handler to update the save button based on hoard state
 */
Squirrel.update_save = function() {
    "use strict";

    $("#undo_button").toggle(Squirrel.undo_stack.length !== 0);

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

/**
 * Callback for use when managing hoards; plays an action that is being
 * played into the hoard into the DOM as well.
 * @param e action to play
 * @param chain function to call once the action has been played. May
 * be undefined. Passed the modified node.
 * @param undoable set true if the inverse of this action is to be added
 * to the undo chain.
 */
Squirrel.render_action = function(e, chain, undoable) {
    "use strict";

    //if (DEBUG) console.debug("Playing " + Hoard.stringify_action(e));

    var $node, $div, key, $container,
    p = e.path, inserted;

    switch (e.type) {

    case "N": // Construct new node
        p = p.slice();
        key = p.pop();

        // Get the container
        $node = Squirrel.nodes[p.join(Squirrel.PATHSEP)];
        $container = $node.children("ul").first();

        // Create the new node
        $node = $("<li></li>")
            .addClass("node modified")
            .data("key", key)
            .attr("name", key)
            .attr("title", Squirrel.last_mod(e.time));

        $div = $("<div></div>")
            .addClass("node_div")
        /* Enable taphold events. These will be intercepted by the
           context menu. */
            .linger()
            .appendTo($node);

        $("<span></span>")
            .addClass("key")
            .hover(
                function(/*e*/) {
                    Squirrel.$paste = $node;
                })
            .on("click", function(/*e*/) {
                $("#bonsai-root").contextmenu("close");
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
                                $("#bonsai-root")
                                    .contextmenu("close")
                                    .bonsai(
                                        $node.hasClass("expanded")
                                            ? "collapse" : "expand", $node);
                            }
                        },
                        250));
                return false;
            })
            .dblclick(function() {
                // "click" is always done first, so context menu already closed
                $(this).data("click_timer", null);
                Squirrel.edit_node($node, "key");
            })
            .text(key)
            .appendTo($div);

        if (typeof e.data !== "undefined" && e.data !== null) {
            $div
                .addClass("treeleaf")
                .append(" : ")
                .append(
                    $("<span></span>")
                        .addClass("value")
                        .dblclick(function() {
                            Squirrel.edit_node($node, "value");
                        })
                        .text(e.data));
        } else {
            $div.addClass("treecollection")
            .on("click", function(/*e*/) {
                $("#bonsai-root")
                    .contextmenu("close")
                    .bonsai(
                        $node.hasClass("expanded")
                            ? "collapse" : "expand", $node);
            });
            $("<ul></ul>")
                .addClass("node_ul")
                .appendTo($node);
        }

        // Insert-sort into the $container
        inserted = false;
        key = key.toLowerCase();
        $container.children("li.node").each(function() {
            if ($(this).data("key").toLowerCase() > key) {
                $node.insertBefore($(this));
                inserted = true;
                return false;
            }
        });
        if (!inserted)
            $container.append($node);

        p = Squirrel.get_path($node); // add to cache

        if (undoable) {
            Squirrel.undo_stack.push({
                type: "D",
                path: p
            });
        }

        // Add anchor
        $("<a></a>")
            .addClass("node_fragment")
            .attr("name", Utils.fragmentify(p.join(":")))
            .prependTo($node);

        break;

    case "R": // Rename
        // Detach the li from the DOM
        $node = Squirrel.nodes[p.join(Squirrel.PATHSEP)];
        Squirrel.demap($node);

        $container = $node.closest("ul");
        $node
            .detach()
            .data("key", e.data)
            .attr("title", Squirrel.last_mod(e.time))
            .children(".node_div")
            .children("span.key")
            .text(e.data);

        // Re-insert the element in it's sorted position
        inserted = false;
        key = e.data.toLowerCase();
        $container.children("li.node").each(function() {
            if ($(this).data("key").toLowerCase() > key) {
                $node.insertBefore($(this));
                inserted = true;
                return false;
            }
        });
        if (!inserted)
            $container.append($node);

        // Reset the path of all subnodes. We have to do this so
        // they get added to Squirrel.nodes. This will also update
        // the mapping for $node.
        $node
            .find(".node")
            .each(function() {
                Squirrel.get_path($(this));
            });

        // refresh data-path and update fragment ID
        key = p.pop(); // record old node name
        p = Squirrel.get_path($node); // get new path
        $node .addClass("modified")
            .children("a.node_fragment")
            .attr("name", Utils.fragmentify(p.join(":")))
            .scroll_into_view();

        if (undoable) {
            Squirrel.undo_stack.push({
                type: "R",
                path: p,
                data: key
            });
        }

        break;

    case "E": // Change data
        $node = Squirrel.nodes[p.join(Squirrel.PATHSEP)];

        if (undoable) {
            Squirrel.undo_stack.push({
                type: "E",
                path: p,
                data: $node.children(".node_div")
                    .children("span.value")
                    .text()
            });
        }

        $node .attr("title", Squirrel.last_mod(e.time))
            .addClass("modified")
            .children(".node_div")
            .children("span.value")
            .text(e.data);

        break;

    case "D": // Delete node
        $node = Squirrel.nodes[p.join(Squirrel.PATHSEP)];
        Squirrel.demap($node);

        if (undoable) {
            // Not enough - all the subtree would need to be
            // regenerated
            Squirrel.undo_stack.push({
                type: "N",
                path: p,
                data: $node.children(".node_div")
                    .children("span.value")
                    .text()
            });
        }

        $node
            .parents("li.node")
            .first()
            .addClass("modified")
            .attr("title", Squirrel.last_mod(e.time));

        $node.remove();

        break;

    default:
        throw "Unrecognised action '" + e.type + "'";
    }

    Utils.sometime("update_save");

    if (typeof chain !== "undefined") {
        Utils.soon(function() {
            chain($node);
        });
    }
};

Squirrel.get_updates_from_cloud = function(cloard, chain) {
    "use strict";

    // This will get triggered whenever both hoards are
    // successfully loaded.
    if (DEBUG) console.debug("Merging from cloud hoard");
    Squirrel.client.hoard.merge_from_cloud(
        cloard,
        Squirrel.render_action,
        function(conflicts) {
            if (conflicts.length > 0) {
                var $dlg = $("#dlg_conflicts");
                $("#dlg_conflicts_message").empty();
                $.each(conflicts, function(i, c) {
                    var e = c.action;
                    $("<div></div>")
                        .text(Hoard.stringify_action(e)
                              + ": " + c.message)
                        .appendTo($dlg.children(".message"));
                });
                $dlg.dialog({
                    width: "auto"
                });
            }
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

    $(".modified").each(function() {
        message.push(TX.tx("$1 has changed", $(this).attr("name")));
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
            Squirrel.cloud.status = "is loaded";
        } catch (e) {
            // We'll get here if decryption failed....
            if (DEBUG) console.debug("Cloud hoard JSON parse failed: " + e);
            $messy.append(
                "<div class='error'>"
                    + TX.tx("$1 hoard can't be read for update",
                            this.identifier())
                    + "</div>");
            Squirrel.cloud.status = "is corrupt";
            cloud_ok = false;
            construct_new_cloud();
            return;
        }
                
        if (Squirrel.cloud.status === "is loaded") {
            Squirrel.client.hoard.merge_from_cloud(
                cloard, Squirrel.render_action);
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

    // Flush the sometimes, and allow new sometimes to be set
    Utils.sometime_is_now();

    $(".unauthenticated").hide();
    $(".authenticated").show();
};

Squirrel.load_cloud_store = function() {
    "use strict";

    if (Squirrel.cloud.store) {
        if (DEBUG) console.debug("Reading cloud " + Squirrel.cloud.store.identifier());
        Squirrel.cloud.store.read(
            function(data) {
                var hoard;
                if (DEBUG) console.debug(this.identifier() + " is ready");
                try {
                    hoard = JSON.parse(data);
                } catch (e) {
                    if (DEBUG) console.debug("Client hoard JSON parse failed: " + e);
                    Squirrel.squeak(
                        TX.tx("$1 hoard can't be read. Are you sure you have the correct password?",
                        this.identifier()));
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
                    if (DEBUG) console.debug(this.identifier() + " contains NODATA");
                    Squirrel.cloud.status = "is empty";
                } else {
                    Squirrel.squeak(TX.tx("$1 store error: $2",
                                          this.identifier(), e));
                }
                Utils.soon(Squirrel.hoards_loaded);
            });
    } else {
        Squirrel.hoards_loaded();
    }
};

Squirrel.load_client_store = function() {
    "use strict";

    Squirrel.client.store.read(
        function(data) {
            try {
                Squirrel.client.hoard = new Hoard(JSON.parse(data));
                Squirrel.client.status = "is loaded";
            } catch (e) {
                Squirrel.squeak(
                    TX.tx("$1 hoard can't be read. Do you have the correct password?",
                    this.identifier()) + ": " + e);
                Squirrel.client.hoard = new Hoard();
                Squirrel.client.status = "is corrupt";
            }

            if (DEBUG) console.debug("Reconstructing UI tree from cache");
            Squirrel.client.hoard.reconstruct_actions(
                Squirrel.render_action,
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
                            $node = Squirrel.nodes[p.join(Squirrel.PATHSEP)];
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
                Squirrel.client.status = "is empty";
                Utils.soon(Squirrel.load_cloud_store);
            } else {
                Squirrel.squeak(TX.tx("$1 store error: $2",
                                      this.identifier(), e));
            }
        });
};

Squirrel.init_ui = function() {
    "use strict";

    $("#save_button")
        .button({
            icons: {
                primary: "squirrel-icon-save"
            },
            text: false
        })
        .hide()
        .on("click", function(/*evt*/) {
            $("#bonsai-root").contextmenu("close");
            Squirrel.save_hoards();
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
            $("#bonsai-root").contextmenu("close");
            Squirrel.undo();
        });

    $("#options_button")
        .button()
        .hide()
        .on("click", function(/*evt*/) {
            $("#bonsai-root").contextmenu("close");
            Squirrel.options_dialog();
        });

    Squirrel.nodes[""] = $("#sites-node");

    $("#bonsai-root").bonsai();

    $("#add_root_child")
        .button({
            icons: {
                primary: "squirrel-icon-add"
            },
            text: false
        })
        .on("click", function() {
            $("#bonsai-root").contextmenu("close");
            Squirrel.add_child_node($("#sites-node"), "A new site");
        });

    $("#search")
        .on("change", function(/*evt*/) {
            $("#bonsai-root").contextmenu("close");
            Squirrel.search($(this).val());
        });

    Squirrel.init_context_menu($("#bonsai-root"));

    $(document)
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
            Squirrel.squeak(TX.tx("Failed ") + e);
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
            Squirrel.login_dialog.call(this, ok, fail, uReq, pReq);
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
        fail: function(/*e*/) {
            Squirrel.squeak(TX.tx("Could not contact cloud store"));
            Squirrel.init_client_store();
        },
        identify: Squirrel.login_dialog
    };

    if (typeof DropboxStore !== "undefined") {
        if (DEBUG) console.debug("Using Dropbox for the Cloud");
        params.engine = DropboxStore; // Uncomment the one you want to use
    } else if (typeof GoogleDriveStore !== "undefined") {
        if (DEBUG) console.debug("Using Google Drive for the Cloud");
        params.engine = GoogleDriveStore;
    } else {
        if (DEBUG) console.debug("Using LocalStorage for the Cloud");
        params.engine = LocalStorageStore;
    }

    //new params.engine(params);
    new EncryptedStore(params);
};

(function ($) {
    "use strict";

    $(document)
        .ready(function() {
            // Initialise UI components
            Squirrel.init_ui();
            // Initialise translation module
            TX.init(Squirrel.init_cloud_store);
        });

})(jQuery);
