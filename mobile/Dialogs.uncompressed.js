/*@preserve Copyright (C) 2015 Crawford Currie http://c-dot.co.uk license MIT*/

/* eslint-env jquery */
/* global Utils */
/* global Squirrel */

// Mobile customisation of dialogs
(function($, S) {
        "use strict";
    var SD = S.Dialog;

    SD.init_dialog = function($dlg) {
        // Add a close button
        $("<button class='ui-btn ui-icon-delete ui-btn-icon-notext ui-shadow ui-corner-all dialog-close-button'></button>")
            .prependTo($("div[data-role='header']", $dlg))
            .click(function() {
                $dlg.popup("close");
            });
        $dlg
            .removeClass("hidden")
            .popup({ history: false });
    };

    SD.open_dialog = function($dlg) {
        $dlg.popup("open");
    };

    SD.close_dialog = function($dlg) {
        $dlg.popup("close");
    };

    SD.squeak = function(p) {
        var $dlg = $("#squeak");

        if (typeof p === "string")
            p = { message: p };

        if (typeof p.title === "string")
            $("#squeak_title").text(p.title).show();
        else
            $("#squeak_title").hide(); 
        
        if ($dlg.hasClass("hidden")) {
            $("#squeak_close")
                .click(function() {
                    $dlg.popup("close");
                    if (typeof p.after_close === "function")
                        Utils.soon(p.after_close);
                });
            SD.init_dialog($dlg);
        }

        if (typeof p.message === "string")
            $("#squeak_message").html(p.message);
        else
            $("#squeak_message").empty().append(p.message);

        SD.open_dialog($dlg);
    };
})(jQuery, Squirrel);
