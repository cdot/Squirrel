/* Copyright (C) 2015 Crawford Currie http://c-dot.co.uk / MIT */

// Desktop customisation of dialogs 
Squirrel.Dialog.init_dialog = function($dlg) {
    "use strict";
    $("#" + $dlg.attr("id") + "_cancel")
        .button()
        .click(function() {
            $dlg.dialog("close");
            return false;
        });
};

Squirrel.Dialog.open_dialog = function($dlg) {
    "use strict";
    $dlg.dialog({
        modal: true,
        width: "auto",
        closeOnEscape: false
    });
};

Squirrel.Dialog.close_dialog = function($dlg) {
    "use strict";
    $dlg.dialog("close");
};

/**
 * Generate a modal alert dialog
 * @param p either a string message, or a structure containing:
 *  title - dialog title
 *  message - (string or $object or elem)
 *  severity - may be one of notice (default), warning, error
 *  after_close - callback on dialog closed
 */
Squirrel.Dialog.squeak = function(p) {
    "use strict";

    var $dlg = $("#squeak");
    if (typeof p === "string")
        p = { message: p, severity: "notice" };

    $dlg.data("after_close", p.after_close);

    var called_back = false;
    if ($dlg.hasClass("hidden")) {
        $("#squeak_close")
            .button()
            .click(function(e) {
                var ac = $dlg.data("after_close");
                $dlg.removeData("after_close");
                $dlg.dialog("close");
                if (typeof ac === "function")
                    ac();
                return false;
            });
        $dlg.removeClass("hidden");
    }

    $("#squeak_message").empty();
    Squirrel.Dialog.squeak_more(p);

    var options = {
        modal: true,
        close: function() {
            if (!called_back) {
                if (typeof p.after_close === "function")
                    p.after_close();
            }
        }
    };
    if (p.title)
        options.title = p.title;

    $dlg.dialog(options);
};
