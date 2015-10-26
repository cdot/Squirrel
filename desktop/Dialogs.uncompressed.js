/*@preserve Copyright (C) 2015 Crawford Currie http://c-dot.co.uk license MIT*/

(function($, S) {
    "use strict";

    var SD = S.Dialog;

    // Desktop customisation of dialogs 
    SD.init_dialog = function($dlg) {
        $("#" + $dlg.attr("id") + "_cancel")
            .button()
            .click(function() {
                $dlg.dialog("close");
                return false;
            });
    };

    SD.open_dialog = function($dlg) {
        $dlg.dialog({
            modal: true,
            width: "auto",
            closeOnEscape: false
        });
    };

    SD.close_dialog = function($dlg) {
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
    SD.squeak = function(p) {
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
        SD.squeak_more(p);

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
})(jQuery, Squirrel);
