/*@preserve Copyright (C) 2015 Crawford Currie http://c-dot.co.uk license MIT*/

/**
 * Customisation for JQuery mobile
 */

(function($, S) {
    "use strict";

    var SD = S.Dialog;
    var ST = S.Tree;

    // Rewire handlers click to vclick
    $.fn.click = function(listener) {
        return this.each(function() {
            $(this).on("vclick", listener);
        });
    };

    // Once logged in, switch to "authenticated" state
    S.authenticated = function() {
        $("#authenticated_whoami").text(S.client.store.user());
        /*    $("body")
              .pagecontainer()
              .on("pagecontainerchange", function () {
              $("body").pagecontainer().off("pagecontainerchange");
              });*/
        $("body").pagecontainer("change", $("#authenticated"), {
            transition: "fade",
            changeHash: false
        });
    };

    // invoked by mobile/Tree.uncompressed.js
    S.open_menu = function($node) {
        var $menu = $("#menu");

        // Is menu already open/opening? We get this because taphold
        // stopPropagation doesn't seem to work (or perhaps there are
        // multiple taphold events?)
        if ($menu.hasClass("menu-open"))
            return;
        $menu.addClass("menu-open");

        var path = $node.treenode("get_path");

        var is_leaf = $node.data("is_leaf");
        var value = $node.find(".value").first().text();
        var key = $node.find(".key").first().text();

        $menu.find(".leaf_only").toggle(is_leaf);
        $menu.find(".collection_only").toggle(!is_leaf);
        if (typeof $node.data("alarm") !== "undefined")
            $("#menu_alarm_action").text(TX.tx("Modify reminder"));
        else
            $("#menu_alarm_action").text(TX.tx("Add reminder"));

        $menu.trigger("updatelayout");
        $menu.data("node", $node);

        $("#menu_name").text(key);
        var pp = path.slice();
        pp.pop();
        $("#menu_parent_path").text(pp.join("/") + "/");
        if (is_leaf)
            $("#menu_value").text(value);
        $menu.panel("open");
    };

    /**
     * Initialise handlers and jQuery UI components
     */
    S.init_custom_ui = function() {
        // Initialise widgets

        $("body").pagecontainer({
            defaults: true
        });

        $("#sites-node").treenode({
            is_root: true
        });

        // Initialise pull-right node panel
        $("#menu")
            .removeClass("hidden") // If it's there
            .panel({
                close: function(event, ui) {
                    $("#menu")
                        .removeClass("menu-open");
                }
            });
        $("#menu_controls").controlgroup();

        $("#menu_pick").click(function() {
            $("#menu").panel("close");
            SD.pick($("#menu").data("node"));
        });
        $("#menu_add_alarm").click(function() {
            $("#menu").panel("close");
            SD.alarm($("#menu").data("node"));
        });
        $("#menu_path").click(function() {
            var info = $("#menu").data("node");
            var w = $("#menu_path").width() - $("#menu_name").position().left;
            $("#menu_name").parents().each(function() {
                w -= $(this).position().left;
            });
            $("#menu_name").edit_in_place({
                width: w,
                changed: function(s) {
                    $("#menu_name").text(s);
                    var e = S.client.hoard.record_action(
                        { type: "R",
                          path: info.node.treenode("get_path"),
                          data: s },
                        function(ea) {
                            ST.action(
                                ea,
                                function(/*$newnode*/) {
                                    Utils.sometime("update_save");
                                }, true);
                        });
                    if (e !== null)
                        SD.squeak({
                            title: TX.error(),
                            severity: "error",
                            message: e.message
                        });
                }
            });
        });
        $("#menu_value").click(function() {
            var info = $("#menu").data("node");
            var w = $("#menu_path").width();
            $("#menu_value").parents().each(function() {
                w -= $(this).position().left;
            });
            $("#menu_value").edit_in_place({
                width: w,
                changed: function(s) {
                    $("#menu_value").text(s);
                    var e = S.client.hoard.record_action(
                        { type: "E",
                          path: info.node.treenode("get_path"),
                          data: s },
                        function(ea) {
                            ST.action(
                                ea,
                                function(/*$newnode*/) {
                                    Utils.sometime("update_save");
                                }, true);
                        });
                    if (e !== null)
                        SD.squeak({
                            title: TX.error,
                            severity: "error",
                            message: e.message
                        });
                }
            });
        });
        $("#menu_randomise").click(function() {
            $("#menu").panel("close");
            SD.randomise($("#menu").data("node"));
        });
        $("#menu_add_value").click(function() {
            $("#menu").panel("close");
            var node = $("#menu").data("node");
            node.treenode("open");
            S.add_child_node(node, TX.tx("A new value"), TX.tx("none"));
        });
        $("#menu_add_subtree").click(function() {
            $("#menu").panel("close");
            var node = $("#menu").data("node");
            node.treenode("open");
            S.add_child_node(node, TX.tx("A new folder"));
        });
        $("#menu_delete_node").click(function() {
            $("#menu").panel("close");
            SD.delete_node($("#menu").data("node"));
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
                .click(function() {
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
                .click(function() {
                    $this.hide();
                    $enhanced_help.show();
                });

            $this.hide();
        });
    };
})(jQuery, Squirrel);
