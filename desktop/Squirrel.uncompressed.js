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

    $("button").each(function() {
        var self = $(this);
        var opts = {};

        if (typeof self.data("icon") !== "undefined") {
            opts.icons =  {
                primary: self.data("icon")
            };
            opts.text = false;
        }
        self.button(opts);
    });

    var $root = $("#sites-node");
    $root.treenode({
        is_root: true
    });
    Squirrel.ContextMenu.init();

    Squirrel.clipboard = null;

    $(document)
        .on("check_alarms", Squirrel.check_alarms)
        .on("update_save", Squirrel.update_save)
        .on("update_tree", Squirrel.update_tree);

    // Kick off by initialising the cloud store.
    Squirrel.init_cloud_store();
};
