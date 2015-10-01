/* Copyright (C) 2015 Crawford Currie http://c-dot.co.uk / MIT */

Squirrel.ContextMenu = {};

/**
 * Context menu handling
 */

Squirrel.ContextMenu.init = function() {
    "use strict";

    var $root = $("body");
    var before_open = function(e, ui) {
        var $node = (ui.target.is(".treenode"))
            ? ui.target
            : $node = ui.target.parents(".treenode").first();
        var $val = $node.find(".value").first();
        var has_alarm = typeof $node.treenode("get_alarm") !== "undefined";
        var is_leaf = $node.hasClass("treenode-leaf");
        var is_root = ui.target.closest(".treenode").is("#sites-node");
        var is_open = $node.hasClass("treenode-open");
        var zc;

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
                         !is_leaf && Squirrel.clipboard !== null);

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
                var p = pa.treenode("get_path");
                var n = Squirrel.client.hoard.get_node(p);
                var json = JSON.stringify(n);

                Squirrel.clipboard = json;
                event.clipboardData.setData("text/plain", json);
            });
            $root.data("ZC", zc); // remember it to protect from GC
        }
        $root.data("zc_cut", $node.closest(".treenode"));
    },

    menu = {
        delegate: ".treenode",
        menu: [
            {
                title: TX.tx("Copy value"),
                cmd: "copy_value",
                uiIcon: "ui-icon-squirrel-camera"
            },
            {
                title: TX.tx("Pick characters"),
                cmd: "pick_from",
                uiIcon: "ui-icon-squirrel-pick"
            },
            {
                title: TX.tx("Rename"),
                cmd: "rename",
                uiIcon: "ui-icon-squirrel-pencil" 
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
        select: Squirrel.ContextMenu.choice
    };

    $root.contextmenu(menu);
};

/**
 * Handler for context menu items
 */
Squirrel.ContextMenu.choice = function(e, ui) {
    "use strict";

    var $node = ui.target.closest(".treenode");

    switch (ui.cmd) {
    case "copy_value":
        // Handled by the ZeroClipboard event handler
        break;

    case "make_copy":
        // Handled by the ZeroClipboard event handler
        break;

    case "insert_copy":
        if (DEBUG) console.debug("Pasting");
        if (Squirrel.clipboard) {
            var data = JSON.parse(Squirrel.clipboard);
            Squirrel.add_child_node($node, TX.tx("A copy"), data.data);
        }
        break;

    case "rename":
        if (DEBUG) console.debug("Renaming");
	$node.treenode("edit", "key");
        break;

    case "edit":
        if (DEBUG) console.debug("Editing");
	$node.treenode("edit", "value");
        break;

    case "add_value":
        if (DEBUG) console.debug("Adding value to " + $node.treenode("get_path").join("/"));
        Squirrel.add_child_node($node, TX.tx("A new value"), TX.tx("None"));
        break;

    case "add_subtree":
        if (DEBUG) console.debug("Adding subtree");
        Squirrel.add_child_node($node, TX.tx("A new folder"));
        break;

    case "randomise":
        if (DEBUG) console.debug("Randomising");
        Squirrel.Dialog.make_random($node);
        break;

    case "add_alarm":
        if (DEBUG) console.debug("Adding reminder");
        Squirrel.Dialog.alarm($node);
        break;

    case "delete":
        if (DEBUG) console.debug("Deleting");
        Squirrel.Dialog.confirm_delete($node);
        break;

    case "pick_from":
        if (DEBUG) console.debug("Picking");
        Squirrel.Dialog.pick_from($node);
        break;

    default:
        if (DEBUG) debugger;
    }
};
