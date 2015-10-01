/* Copyright (C) 2015 Crawford Currie http://c-dot.co.uk / MIT */

/**
 * Event handler to update the tree view when data changes
 */
Squirrel.update_tree = function(/*event*/) {
    "use strict";

    console.debug("Refresh tree");
    $(".unauthenticated").hide();
    $(".authenticated").show();
};

Squirrel.close_menus = function() {
    "use strict";

    //$(".treenode").contextmenu("close");
    $("#extras_menu").hide();
};

// Once logged in, switch to "authenticated" state
Squirrel.authenticated = function() {
    $(".unauthenticated").hide();
    $(".authenticated").show();
    $("#whoami").text(Squirrel.client.store.user());
    Utils.soon(Squirrel.load_client_hoard);
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

    $("#save_button")
        .button({
            icons: {
                primary: "ui-icon-squirrel-save"
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
                primary: "ui-icon-squirrel-undo"
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
                case "about":
                    $("#dlg_about").dialog({
                        modal: true
                    });
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
                primary: "ui-icon-squirrel-gear"
            },
            text: false
        })
        .on("click", function(/*evt*/) {
            //$("#sites-node").contextmenu("close");
            $("#extras_menu")
                .show()
                .position({
                    my: "left top",
                    at: "left bottom",
                    of: this
                });
            return false;
        });

    var $root = $("#sites-node");
    $root.treenode({
        is_root: true
    });
    Squirrel.ContextMenu.init();

    $("#search")
        .on("click", Squirrel.close_menus)
        .on("change", function(/*evt*/) {
            Squirrel.close_menus();
            $("#search_hits").text(TX.tx("Searching..."));
            Squirrel.search($(this).val());
        });

    Squirrel.clipboard = null;

    $(document)
        .on("check_alarms", Squirrel.check_alarms)
        .on("update_save", Squirrel.update_save)
        .on("update_tree", Squirrel.update_tree);

    // Kick off by initialising the cloud store.
    Squirrel.init_cloud_store();
};
