/* Copyright (C) 2015 Crawford Currie http://c-dot.co.uk / MIT */

// Desktop customisation of dialogs 
Squirrel.Dialog.init_dialog = function($dlg) {
    $('#' + $dlg.attr("id") + "_cancel")
        .button()
        .click(function() {
            $dlg.dialog("close");
            return false;
        });
};

Squirrel.Dialog.open_dialog = function($dlg) {
    $dlg.dialog({
        modal: true,
        width: "auto",
        closeOnEscape: false
    });
};

Squirrel.Dialog.close_dialog = function($dlg) {
    $dlg.dialog("close");
};

/**
 * Generate a modal alert dialog
 * @param p either a string message, or a structure containing:
 *  title - dialog title
 *  message - (string or $object or elem)
 *  after_close - callback on dialog closed
 */
Squirrel.Dialog.squeak = function(p) {
    "use strict";

    var $dlg = $("#activity");

    if (typeof p === "string")
        p = { message: p };


    var called_back = false;
    if ($dlg.hasClass("hidden")) {
        $("#activity_close")
            .button()
            .click(function(/*e*/) {
                if (typeof p.after_close !== "undefined") {
                    p.after_close();
                    called_back = true;
                }
                $dlg.dialog("close");
                return false;
            });
        $dlg.removeClass("hidden");
    }

    if (typeof message === "string")
        $("#activity_message").html(p.message);
    else
        $("#activity_message").empty().append(p.message);

    var options = {
        modal: true,
        close: function() {
            if (!called_back) {
                if (typeof p.after_close !== "undefined")
                    p.after_close();
            }
        }
    };
    if (p.title)
        options.title = p.title;

    $dlg.dialog(options);
};
