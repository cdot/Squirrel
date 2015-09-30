/* Copyright (C) 2015 Crawford Currie http://c-dot.co.uk / MIT */

/**
 * Event handler to update the tree view when data changes
 */
Squirrel.update_tree = function(/*event*/) {
    "use strict";
    console.debug("Refresh tree");
};

Squirrel.expand_new_node = function ($node) {
    // SMELL: not sure this is right or needed?
    $node.treenode("open");
};

// Once logged in, switch to "authenticated" state
Squirrel.authenticated = function() {
    Page_get("authenticated").open(
        {
            replace: true,
            on_open: function () {
                Utils.soon(Squirrel.load_client_hoard);
            }
        });
}

/**
 * Event handler to update the save button based on hoard state
 */
Squirrel.update_save = function(/*event*/) {
    "use strict";

    var authpage = Page_get("authenticated");
    authpage.control("undo").toggle(Squirrel.Tree.can_undo());
    var us = Squirrel.unsaved_changes(3);
    var $sb = authpage.control("save");
    if (us !== null) {
        if (Squirrel.client.hoard.options.autosave) {
            Squirrel.save_hoards();
        } else {
            $sb.attr(
                "title",
                TX.tx("Save is required because: ") + us);
            $sb.show();
        }
    } else {
        $sb.hide();
    }
};

Squirrel.open_menu = function($node) {
    var path = $node.treenode("get_path");

    var is_leaf = $node.data("is_leaf");
    var value = $node.find(".value").first().text();
    var key = $node.find(".key").first().text();
    var $menu = $("#menu");

    $menu.find(".leaf_only").toggle(is_leaf);
    $menu.find(".collection_only").toggle(!is_leaf);
    $("#menu_alarm_action").text(TX.tx("Add reminder"));
    // If there's an existing alarm, change the text
    $node.children(".alarm").each(function() {
        $("#menu_alarm_action").text(TX.tx("Modify reminder"));
    });
    $menu.trigger("updatelayout");
    $menu.data("node", 
                    {
                        node: $node,
                        path: path
                    });
    $("#menu_name").text(key);
    var pp = path.slice();
    pp.pop();
    $("#menu_parent_path").text(pp.join("/") + "/");
    if (is_leaf)
        $("#menu_value").text(value);
    $("#sites-node").find(".open-menu").hide();
    $node.find(".close-menu").first().show();
    $menu.panel("open");
};

/**
 * Initialise handlers and jQuery UI components
 */
Squirrel.init_ui = function() {
    "use strict";

    // Initialise widgets
debugger;

    $("body").pagecontainer({
        defaults: true
    });

    $("[data-role='page']").trigger("create");

    $("#sites-node").treenode({
        is_root: true
    });

    // Initialise pull-right node panel
    $("#menu").panel({
        close: function(event, ui) {
            var info = $("#menu").data("node");
            info.node.find(".close-menu").first().hide();
            //info.node.find(".open-menu").first().show();
            $("#sites-node").find(".open-menu").show();
        }});
    $("#menu_controls").controlgroup();

    $("#menu_pick").on("vclick", function() {
        var info = $("#menu").data("node");
        Page_get("pick").open(info);
    });
    $("#menu_add_alarm").on("vclick", function() {
        var info = $("#menu").data("node");
        Page_get("alarm").open(info);
    });
    $("#menu_path").on("vclick", function() {
        var info = $("#menu").data("node");
        var w = $("#menu_path").width() - $("#menu_name").position().left;
        $("#menu_name").parents().each(function() {
            w -= $(this).position().left;
        });
        $("#menu_name").edit_in_place({
            width: w,
            changed: function(s) {
                $("#menu_name").text(s);
                var e = Squirrel.client.hoard.record_action(
                    { type: "R",
                      path: info.node.treenode("get_path"),
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
                    Squirrel.Dialog.squeak({
                        title: Pages.activity.titles.error,
                        message: e.message
                    });
            }
        });
    });
    $("#menu_value").on("vclick", function() {
        var info = $("#menu").data("node");
        var w = $("#menu_path").width();
        $("#menu_value").parents().each(function() {
            w -= $(this).position().left;
        });
        $("#menu_value").edit_in_place({
            width: w,
            changed: function(s) {
                $("#menu_value").text(s);
                var e = Squirrel.client.hoard.record_action(
                    { type: "E",
                      path: info.node.treenode("get_path"),
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
                    Squirrel.Dialog.squeak({
                        title: Pages.activity.titles.error,
                        message: e.message
                    });
            }
        });
    });
    $("#menu_randomise").on("vclick", function() {
        var info = $("#menu").data("node");
        Page_get("randomise").open(info);
    });
    $("#menu_add_value").on("vclick", function() {
        var info = $("#menu").data("node");
        info.node.treenode("open");
        Squirrel.add_child_node(info.node, "New value", "none");
    });
    $("#menu_add_subtree").on("vclick", function() {
        var info = $("#menu").data("node");
        Page_get("add_subtree").open(info);
    });
    $("#menu_delete_node").on("vclick", function() {
        var info = $("#menu").data("node");
        Page_get("delete_node").open(info);
    });

    $(".help").each(function() {
        var $this = $(this);
        var $help = $("<button></button>");
        var $close = $("<button></button>");

        var $enhanced_help = $help
            .insertBefore($this)
            .button({
                mini: true,
                inline: true,
                icon: "info",
                iconpos: "notext"
            })
            .parent();
        $enhanced_help
            .addClass("info-button")
            .on("vclick", function() {
                $this.show();
               $enhanced_help.hide();
            });

        var $enhanced_close = $close
            .prependTo($this)
            .button({
                mini: true,
                inline: true,
                icon: "minus",
                iconpos: "notext"
            })
            .parent();
        $enhanced_close
            .addClass("help-close")
            .on("vclick", function() {
                $this.hide();
                $enhanced_help.show();
            });

        $this.hide();
    });

    Squirrel.Tree.set_root($("#sites-node"));

    $(document)
        .on("check_alarms", Squirrel.check_alarms)
        .on("update_save", Squirrel.update_save)
        .on("update_tree", Squirrel.update_tree);

    // Have to do a change_page to override any #page fragment in the
    // URL and force our startup screen
    Page_get("unauthenticated").open(
        {
            replace: true,
            // Initialise the cloud store as soon as the page has changed
            on_open: Squirrel.init_cloud_store
        });
};


