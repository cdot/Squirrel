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
    last_yield: Date.now(),
    waiting: {},
    // By setting the wait_timeout to a non-null value we block
    // the wait queue until it is set to null and Squirrel.sometime is called
    // This lets us complete the load without too much noise
    wait_timeout: true
};

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

// Allow the UI to have a slice of time before we call the given function,
// but only if it's been a perceptible amount of time since the last UI
// update.
Squirrel.chain = function(fn) {
    "use strict";

    // If it's been a decent amount of time since the last time
    // we yielded to the UI, then set an asynchronous timeout before
    // we activate the next function in the chain. This will allow
    // the UI a timeslice.
    if (Date.now() - Squirrel.last_yield > 100 /*ms*/) {
        window.setTimeout(function() {
            Squirrel.last_yield = Date.now();
            fn();
        }, 1);
    } else
        fn();
};

// Simple asynchronous event mechanism to prevent duplicate events.
// This intended for events that will update the UI, but don't want
// to be called every time due to the load they impose.
Squirrel.sometime = function(event, fn) {
    "use strict";

    if (Squirrel.waiting[event])
        return;
    Squirrel.waiting[event] = fn;
    if (Squirrel.wait_timeout === null)
        Squirrel.wait_timeout = window.setTimeout(
            Squirrel.sometime_is_now, 250 /*ms*/);
};

// Start the sometime sequence
Squirrel.sometime_is_now = function() {
    "use strict";

    Squirrel.wait_timeout = null;
    for (var event in Squirrel.waiting) {
        window["Squirrel"][event]();
        // Only now delete the event to allow it to be requeued
        delete Squirrel.waiting[event];
    }
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
        assert(!Squirrel.nodes[ps]);
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
 * Generate a message for the last modified time, used in the title of nodes.
 */
Squirrel.last_mod = function(time) {
    "use strict";

    var d = new Date(time);
    return TX.tx("Last modified at $1. Click and hold to open menu.",
                 d.toLocaleString());
};

/**
 * Confirm deletion of a node
 */
Squirrel.confirm_delete = function($node) {
    "use strict";

    var $dlg = $("#dlg_delconf");
    $("#dlg_delconf_message").text(Squirrel.get_path($node).join("/"));
    $("#dlg_delconf_coll").toggle($node.hasClass("treecollection"));
    $("#dlg_delconf_delete").button()
        .reon("click", function(/*evt*/) {
            $(this).dialog("close");
            Squirrel.client.hoard.play_action(
                {
                    type: "D",
                    path: Squirrel.get_path($node)
                },
                function(e) {
                    Squirrel.play_action(
                        e,
                        function() {
                            Squirrel.sometime("update_save");
                            Squirrel.sometime("update_tree");
                        });
                });
        });

    $("#dlg_delconf_cancel")
        .button()
        .reon("click", function(/*evt*/) {
            $(this).dialog("close");
        });

    $dlg.dialog({
        modal: true,
        width: "auto"
    });
};

/**
 * Event handler to update the tree view when data changes
 */
Squirrel.update_tree = function() {
    "use strict";

    var before_open = function(e, ui) {
        var $div, isvalue, $el, client;
        if (ui.target.is(".node_div"))
            $div = ui.target;
        else
            $div = ui.target.parents(".node_div").first();

        isvalue = ($div.children(".value").length > 0);
        $("#treeroot")
            .contextmenu("showEntry", "copy", isvalue)
            .contextmenu("showEntry", "edit", isvalue)
            .contextmenu("showEntry", "randomise", isvalue)
            .contextmenu("showEntry", "add_subtree", !isvalue)
            .contextmenu("showEntry", "add_value", !isvalue);

        if (isvalue) {
            // SMELL: is it safe to do this every time?
            // Trust that the copy item will always be first!
            $el = ui.menu.children().first();
            // Whack the Flash movie over the menu item li
            client = new ZeroClipboard($el);
            // Now handle the "copy" event that comes from
            // the Flash movie
            client.on("copy", function(event) {
                event.clipboardData.setData(
                    "text/plain",
                    $div.children(".value").text());
            });
        }
    },

    menu = {
        delegate: ".node_div",
        menu: [
            {
                // Need the area that handles this to be covered with
                // the zeroclipboard
                title: TX.tx("Copy value"),
                cmd: "copy",
                uiIcon: "squirrel-icon-copy"
            },
            {
                title: TX.tx("Rename"),
                cmd: "rename",
                uiIcon: "squirrel-icon-rename" 
            },
            {
                title: TX.tx("Edit value"),
                cmd: "edit",
                uiIcon: "squirrel-icon-edit" 
            },
            {
                title: TX.tx("Generate new random value"),
                cmd: "randomise",
                uiIcon: "squirrel-icon-generate-pass" 
            },               
            {
                title: TX.tx("Add new value"),
                cmd: "add_value",
                uiIcon: "squirrel-icon-add-value" 
            },
            {
                title: TX.tx("Add new sub-tree"),
                cmd: "add_subtree",
                uiIcon: "squirrel-icon-add-subtree" 
            },
            {
                title: TX.tx("Delete"),
                cmd: "delete",
                uiIcon: "squirrel-icon-delete" 
            }
        ],
        beforeOpen: before_open,
        // We map long mouse hold to taphold in the plugin above
        // Right click still works
        taphold: true,
        select: Squirrel.context_menu_choice
    };

    $("#treeroot")
        .bonsai("update")
        .contextmenu(menu);
};

/**
 * Edit a span in place, used for renaming and revaluing
 */
Squirrel.in_place_edit = function($span, action) {
    "use strict";

    // Fit width to the container
    var w = $("#tree").width();
    $span.parents().each(function() {
        w -= $(this).position().left;
    });

    $span.edit_in_place({
        width: w,
        changed: function(s) {
            var old_path = Squirrel.get_path($span);
            Squirrel.client.hoard.play_action(
                { type: action,
                  path: old_path,
                  data: s },
                function(e) {
                    Squirrel.play_action(
                        e,
                        function() {
                            Squirrel.sometime("update_save");
                            Squirrel.sometime("update_tree");
                        });
                });
        }
    });
};

/**
 * A (manual) new tree node action
 */
Squirrel.add_child_node = function($parent, title, value) {
    "use strict";

    var $li = $parent.parents("li").first();
    var $ul = $li.parent();
    $ul.bonsai("expand", $li);

    var p = Squirrel.get_path($parent);
    var action = {
        type: "N",
        path: p
    };
    if (typeof value !== "undefined") {
        action.data = value;
    }
    p.push(title);
    Squirrel.client.hoard.play_action(
        action,
        function(e) {
            Squirrel.play_action(e, function($n) {
                Squirrel.in_place_edit(
                    $n.children(".node_div").children(".key"));
            });
        });
};

/**
 * Dialog password generation
 */
Squirrel.make_random = function($div) {
    "use strict";

    var $dlg = $("#dlg_gen_rand");
    var opts = {
        length: $("#dlg_gen_rand_len").val(),
        charset: $("#dlg_gen_rand_chs").val()
    };

    $("#dlg_gen_rand_key").text($div.children(".key").text());

    $("#dlg_gen_rand_use").button()
        .reon("click", function() {
            $dlg.dialog("close");
            var pw = $("#dlg_gen_rand_idea").text();
            var old_path = Squirrel.get_path($div);
            Squirrel.client.hoard.play_action(
                { type: 'E',
                  path: old_path,
                  data: pw },
                function(e) {
                    Squirrel.play_action(
                        e,
                        function() {
                            Squirrel.sometime("update_save");
                        });
                });
        });

    $("#dlg_gen_rand_again")
        .button()
        .reon("click", function() {
            opts.length = $("#dlg_gen_rand_len").val();
            opts.charset = $("#dlg_gen_rand_chs").val();
            $("#dlg_gen_rand_idea").text(Utils.generate_password(opts));
        });

    $("#dlg_gen_rand_cancel")
        .button()
        .reon("click", function() {
            $dlg.dialog("close");
        });

    $dlg.dialog({
        width: "auto",
        modal: true
    });

    $("#dlg_gen_rand_idea").text(Utils.generate_password(opts));
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
                .click(function() {
                    $("#treeroot")
                        .bonsai("collapseAll")
                        .bonsai("expand", $li);
                    // Zoom up the tree opening each level we find
                    $li.parents("li.node").each(function() {
                        $("#treeroot").bonsai("expand", $(this));
                    });
                });
            $sar.append($res).append("<br />");
        }
    });
};

/**
 * Handler for context menu
 */
Squirrel.context_menu_choice = function(e, ui) {
    "use strict";

    var $li = ui.target.parents("li").first();
    var $div = $li.children(".node_div");

    switch (ui.cmd) {
    case "copy":
        //console.debug("Copying to clipboard");
        ZeroClipboard.setData($div.children(".value").text());
        break;

    case "rename":
        //console.debug("Renaming");
	Squirrel.in_place_edit($div.children(".key"), "R");
        break;

    case "edit":
        //console.debug("Editing");
	Squirrel.in_place_edit($div.children(".value"), "E");
        break;

    case "add_value":
        //console.debug("Adding value");
        Squirrel.add_child_node($div, TX.tx("New value"), TX.tx("None"));
        break;

    case "add_subtree":
        //console.debug("Adding subtree");
        Squirrel.add_child_node($div, TX.tx("New sub-tree"));
        break;

    case "randomise":
        Squirrel.make_random($div);
        break;

    case "delete":
        Squirrel.confirm_delete($div);
        break;

    default:
        throw "Unknown ui.cmd " + ui.cmd;
    }
};

/**
 * Event handler to update the save button based on hoard state
 */
Squirrel.update_save = function() {
    "use strict";

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
    } else
        $("#save_button").hide();
};

/**
 * Callback for use when managing hoards; plays an action that is being
 * played into the hoard into the DOM as well.
 * @param e action to play
 * @param chain function to call once the action has been played. May
 * be undefined. Passed the modified node.
 */
Squirrel.play_action = function(e, chain) {
    "use strict";

    //console.debug("Playing " + Squirrel.stringify_action(e));

    var $li, $div, key, $parent_ul,
    p = e.path, inserted;

    switch (e.type) {

    case "N": // Construct new node
        p = p.slice();
        key = p.pop();
        $li = Squirrel.nodes[p.join(Squirrel.PATHSEP)]; // get the parent
        $parent_ul = $li.children("ul").first();

        $li = $("<li></li>")
            .addClass("node modified")
            .data("key", key)
            .attr("name", key)
            .attr("title", Squirrel.last_mod(e.time));

        $div = $("<div></div>")
            .addClass("node_div")
            .appendTo($li);

        $("<span></span>")
            .addClass("key")
            .dblclick(function() {
                Squirrel.in_place_edit(
                    $div.children(".key"), "R");
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
                            Squirrel.in_place_edit(
                                $div.children(".value"), "E");
                        })
                        .text(e.data));
        } else {
            $div.addClass("treecollection");
            $("<ul></ul>")
                .addClass("node_ul")
                .appendTo($li);
        }

        // Insert-sort into the $parent_ul
        inserted = false;
        key = key.toLowerCase();
        $parent_ul.children("li.node").each(function() {
            if ($(this).data("key").toLowerCase() > key) {
                $li.insertBefore($(this));
                inserted = true;
                return false;
            }
        });
        if (!inserted)
            $parent_ul.append($li);

        Squirrel.get_path($li); // add to cache

        // Add anchor
        $("<a></a>")
            .addClass("node_fragment")
            .attr("name", Utils.fragmentify(Squirrel.get_path($li).join(":")))
            .prependTo($li);

        // Enable taphold events
        $div
            .linger()
            .click(function() {
            });
        break;

    case "R": // Rename
        // Detach the li from the DOM
        $li = Squirrel.nodes[p.join(Squirrel.PATHSEP)];
        Squirrel.demap($li);

        $parent_ul = $li.closest("ul");
        $li
            .detach()
            .data("key", e.data)
            .attr("title", Squirrel.last_mod(e.time))
            .children(".node_div")
            .children("span.key")
            .text(e.data);

        // Re-insert the element in it's sorted position
        inserted = false;
        key = e.data.toLowerCase();
        $parent_ul.children("li.node").each(function() {
            if ($(this).data("key").toLowerCase() > key) {
                $li.insertBefore($(this));
                inserted = true;
                return false;
            }
        });
        if (!inserted)
            $parent_ul.append($li);

        // Reset the path of all subnodes. We have to do this so
        // they get added to Squirrel.nodes. This will also update
        // the mapping for $li.
        $li
            .find(".node")
            .each(function() {
                Squirrel.get_path($(this));
            });

        // refresh data-path and update get fragment ID
        $li .addClass("modified")
            .children("a.node_fragment")
            .attr("name", Utils.fragmentify(Squirrel.get_path($li).join(":")))
            .scroll_into_view();
        break;

    case "E": // Change data
        $li = Squirrel.nodes[p.join(Squirrel.PATHSEP)];
        $li .attr("title", Squirrel.last_mod(e.time))
            .addClass("modified")
            .children(".node_div")
            .children("span.value")
            .text(e.data);
        break;

    case "D": // Delete node
        $li = Squirrel.nodes[p.join(Squirrel.PATHSEP)];
        Squirrel.demap($li);

        $li .parents("li.node")
            .first()
            .addClass("modified")
            .attr("title", Squirrel.last_mod(e.time));

        $li.remove();

        break;

    default:
        throw "Unrecognised action '" + e.type + "'";
    }

    Squirrel.sometime("update_save");

    if (typeof chain !== "undefined") {
        Squirrel.chain(function() {
            chain($li);
        });
    }
};

Squirrel.get_updates_from_cloud = function(cloard, chain) {
    "use strict";

    // This will get triggered whenever both hoards are
    // successfully loaded.
    console.debug("Merging from cloud hoard");
    Squirrel.client.hoard.merge_from_cloud(
        cloard,
        Squirrel.play_action,
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

    $dlg.dialog({
        modal: true
    });

    var finished = function() {
        Squirrel.sometime("update_save");
        $messy.append(TX.tx("Save complete."));
        if (client_ok && cloud_ok)
            $dlg.dialog("close");
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
                Squirrel.chain(save_client);
            },
            function(e) {
                $messy.append(
                    "<div class='error'>"
                        + TX.tx("Failed to save in $1: $2",
                                this.identifier(), e)
                        + "</div>");
                cloud_ok = false;
                Squirrel.chain(save_client);
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
            console.debug("Cloud hoard JSON parse failed: " + e);
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
                cloard, Squirrel.play_action);
        }
                
        if ( Squirrel.cloud.status !== "is loaded"
             || Squirrel.client.hoard.actions.length !== 0)
            // Only save if there actually some changes
            update_cloud_store(cloard);
        else
            Squirrel.chain(save_client);
    },

    // Action on the cloud store read failing
    cloud_store_read_failed = function(e) {
        if (e === AbstractStore.NODATA) {
            console.debug(this.identifier() + " contains NODATA");
            Squirrel.cloud.status = "is empty";
            construct_new_cloud();
        } else {
            $messy.append(
                "<div class='error'>"
                    + TX.tx("Failed to refresh from $1",
                            this.identifier())
                    * "<br>" + e + "</div>");
            cloud_ok = false;
            Squirrel.chain(save_client);
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

    Squirrel.sometime("update_tree");
    Squirrel.sometime("update_save");

    // Flush the sometimes, and allow new sometimes to be set
    Squirrel.sometime_is_now();

    $(".unauthenticated").hide();
    $(".authenticated").show();
};

Squirrel.load_cloud_store = function() {
    "use strict";

    if (Squirrel.cloud.store) {
        console.debug("Reading cloud " + Squirrel.cloud.store.identifier());
        Squirrel.cloud.store.read(
            function(data) {
                var hoard;
                console.debug(this.identifier() + " is ready");
                try {
                    hoard = JSON.parse(data);
                } catch (e) {
                    console.debug("Client hoard JSON parse failed: " + e);
                    Squirrel.squeak(
                        TX.tx("$1 hoard can't be read. Are you sure you have the correct password?",
                        this.identifier()));
                    Squirrel.cloud.status = "is corrupt";
                    Squirrel.chain(Squirrel.hoards_loaded);
                    return;
                }
                Squirrel.get_updates_from_cloud(
                    new Hoard(hoard),
                    Squirrel.hoards_loaded);
            },
            function(e) {
                if (e === AbstractStore.NODATA) {
                    console.debug(this.identifier() + " contains NODATA");
                    Squirrel.cloud.status = "is empty";
                } else {
                    Squirrel.squeak(TX.tx("$1 store error: $2",
                                          this.identifier(), e));
                }
                Squirrel.chain(Squirrel.hoards_loaded);
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

            console.debug("Reconstructing UI tree from cache");
            Squirrel.client.hoard.reconstruct_actions(
                Squirrel.play_action,
                function() { // on complete
                    // Reset the UI modification list; we just loaded the
                    // client hoard
                    $(".modified").removeClass("modified");
                    // Mark all the nodes in the pending actions list as
                    // modified. If a node isn't found, back up the tree
                    // until we find a parent that does exist and mark it.
                    var as = Squirrel.client.hoard.actions, i, p, $li;
                    for (i = 0; i < as.length; i++) {
                        p = as[i].path.slice();
                        while (p.length > 0) {
                            $li = Squirrel.nodes[p.join(Squirrel.PATHSEP)];
                            if ($li) {
                                $li.addClass("modified");
                                break;
                            }
                            p.pop();
                        }
                    }
                    Squirrel.chain(Squirrel.load_cloud_store);
                });
        },
        function(e) {
            if (e === AbstractStore.NODATA) {
                Squirrel.client.hoard = new Hoard();
                console.debug(this.identifier() + " contains NODATA");
                Squirrel.client.status = "is empty";
                Squirrel.chain(Squirrel.load_cloud_store);
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
        .click(Squirrel.save_hoards);

    $("#options_button")
        .button()
        .hide()
        .click(Squirrel.options_dialog);

    Squirrel.nodes[""] = $("#tree");

    $("#treeroot").bonsai({
        expandAll: false });

    $("#add_root_child")
        .button({
            icons: {
                primary: "squirrel-icon-add-site"
            },
            text: false
        })
        .click(function() {
            Squirrel.add_child_node($("#tree"), "New site");
        });

    $("#search")
        .change(function(/*evt*/) {
            Squirrel.search($(this).val());
        });
};

Squirrel.change_password_dialog = function() {
    "use strict";

    $("#dlg_chpw_show").change(function() {
        if ($("#dlg_chpw_show").prop("checked")) {
            $("#dlg_chpw_pass").attr("type", "text");
            $("#dlg_chpw_conf").attr("type", "text");
        } else {
            $("#dlg_chpw_pass").attr("type", "password");
            $("#dlg_chpw_conf").attr("type", "password");
        }
    });

    $("#dlg_chpw_set").button()
        .reon("click", function() {
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
                Squirrel.sometime("update_save");
            }
        });

    $("#dlg_chpw").dialog({
        modal: true,
        width: "auto"
    });
};

Squirrel.options_dialog = function() {
    "use strict";

    var $dlg = $("#dlg_options");
    $("#dlg_options_autosave")
        .prop("checked", Squirrel.client.hoard.options.autosave)
        .reon("change", function() {
            Squirrel.client.hoard.options.autosave =
                $("#dlg_options_autosave").is(":checked");
            Squirrel.sometime("update_save");
        });
    $("#dlg_options_chpw")
        .button()
        .reon("click", Squirrel.change_password_dialog);

    $dlg.dialog({
        modal: true,
        width: "auto"
    });
};

Squirrel.login_dialog = function(ok, fail, uReq, pReq) {
    "use strict";

    var $dlg = $("#dlg_login"),
    self = this,
    sign_in = function(/*evt*/) {
        $dlg.dialog("close");
        ok.call(self,
                uReq ? $("#dlg_login_user").val() : undefined,
                pReq ? $("#dlg_login_pass").val() : undefined);
    },
    $uReq = $("#dlg_login_uReq").toggle(uReq).find("input"),
    $pReq = $("#dlg_login_pReq").toggle(pReq).find("input");

    if (uReq && pReq) {
         $uReq.reon("change", function() {
             $pReq.focus();
         });
         $pReq.reon("change", sign_in);
    }
    else if (uReq)
        $uReq.reon("change", sign_in);
    else if (pReq) {
        $("#dlg_login_foruser")
            .toggle(this.user() !== null)
            .text(this.user() || "");
        $pReq.reon("change", sign_in);
    }

    $("dlg_login_signin")
        .button()
        .reon("click", sign_in);

    $dlg.dialog({
        modal: true,
        width: "auto"
    });
};

Squirrel.init_client_store = function() {
    "use strict";

    new LocalStorageStore({
    //new EncryptedStore({
        engine: LocalStorageStore,

        dataset: "Local Hoard",
        ok: function() {
            console.debug(this.identifier() + " store is ready");
            $("#whoami").text(this.user());
            Squirrel.client.store = this;
            $(".unauthenticated").text(TX.tx("Loading..."));
            Squirrel.chain(Squirrel.load_client_store);
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
                        console.debug("I didn't expect to have to prompt for a client password");
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
        console.debug("Using Dropbox for the Cloud");
        params.engine = DropboxStore; // Uncomment the one you want to use
    } else if (typeof GoogleDriveStore !== "undefined") {
        console.debug("Using Google Drive for the Cloud");
        params.engine = GoogleDriveStore;
    } else {
        console.debug("Using LocalStorage for the Cloud");
        params.engine = LocalStorageStore;
        params.uReq = true;
    }

    new params.engine(params);
    //new EncryptedStore(params);
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
