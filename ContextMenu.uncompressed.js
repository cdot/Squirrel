Squirrel.ContextMenu = {};

/**
 * Context menu handling
 */

Squirrel.ContextMenu.init = function($root) {
    "use strict";

    var before_open = function(e, ui) {
        var $div = (ui.target.is(".node_div"))
            ? ui.target
            : $div = ui.target.parents(".node_div").first(),
        $val = $div.children(".value"),
        hasalarm = ui.target.closest(".node").children(".alarm").length > 0,
        isvalue = ($val.length > 0),
        zc,
        isroot = ui.target.closest("li").is("#sites-node");

        $root
            .contextmenu("showEntry", "rename", !isroot)
            .contextmenu("showEntry", "copy_value", isvalue)
            .contextmenu("showEntry", "pick_from", isvalue)
            .contextmenu("showEntry", "make_copy", !isroot)
            .contextmenu("showEntry", "delete", !isroot)
            .contextmenu("showEntry", "add_alarm", !hasalarm && !isroot)
            .contextmenu("showEntry", "edit", isvalue)
            .contextmenu("showEntry", "randomise", isvalue)
            .contextmenu("showEntry", "add_subtree", !isvalue)
            .contextmenu("showEntry", "add_value", !isvalue && !isroot)
            .contextmenu("showEntry", "insert_copy",
                         !isvalue && Squirrel.clipboard !== null);

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
                var p = Squirrel.Tree.path(pa);
                var n = Squirrel.client.hoard.get_node(p);
                var json = JSON.stringify(n);

                Squirrel.clipboard = json;
                event.clipboardData.setData("text/plain", json);
            });
            $root.data("ZC", zc); // remember it to protect from GC
        }
        $root.data("zc_cut", $div.closest(".node"));
    },

    menu = {
        delegate: ".node_div",
        menu: [
            {
                title: TX.tx("Copy value"),
                cmd: "copy_value",
                uiIcon: "squirrel-icon-camera"
            },
            {
                title: TX.tx("Pick"),
                cmd: "pick_from",
                uiIcon: "squirrel-icon-pick"
            },
            {
                title: TX.tx("Rename"),
                cmd: "rename",
                uiIcon: "squirrel-icon-pencil" 
            },
            {
                title: TX.tx("Edit value"),
                cmd: "edit",
                uiIcon: "squirrel-icon-edit" 
            },
            {
                title: TX.tx("Add reminder"),
                cmd: "add_alarm",
                uiIcon: "squirrel-icon-alarm" 
            },
            {
                title: TX.tx("Generate new random value"),
                cmd: "randomise",
                uiIcon: "squirrel-icon-key" 
            },               
            {
                title: TX.tx("Add new value"),
                cmd: "add_value",
                uiIcon: "squirrel-icon-add-value" 
            },
            {
                title: TX.tx("Add new folder"),
                cmd: "add_subtree",
                uiIcon: "squirrel-icon-add" 
            },
            {
                title: TX.tx("Copy folder"),
                cmd: "make_copy",
                uiIcon: "squirrel-icon-copy"
            },
            {
                title: TX.tx("Insert copy"),
                cmd: "insert_copy",
                uiIcon: "squirrel-icon-paste"
            },
            {
                title: TX.tx("Delete"),
                cmd: "delete",
                uiIcon: "squirrel-icon-delete" 
            }
        ],
        beforeOpen: before_open,
        // We map long mouse hold to taphold
        // Right click still works
        taphold: true,
        select: Squirrel.ContextMenu.choice
    };

    $root.contextmenu(menu);
};

/**
 * Handler for context menu items
 */
Squirrel.ContextMenu.choice = function(e, ui) {
    "use strict";

    var $node = ui.target.closest("li");

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
	Squirrel.edit_node($node, "key");
        break;

    case "edit":
        if (DEBUG) console.debug("Editing");
	Squirrel.edit_node($node, "value");
        break;

    case "add_value":
        if (DEBUG) console.debug("Adding value to " + Squirrel.Tree.path($node).join("/"));
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