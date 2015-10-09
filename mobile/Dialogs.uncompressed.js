/* Copyright (C) 2015 Crawford Currie http://c-dot.co.uk / MIT */

// Mobile customisation of dialogs
Squirrel.Dialog.init_dialog = function($dlg) {
    $dlg
        .removeClass("hidden")
        .popup({ history: false });
};

Squirrel.Dialog.open_dialog = function($dlg) {
    $dlg.popup("open");
}

Squirrel.Dialog.close_dialog = function($dlg) {
    $dlg.popup("close");
};

Squirrel.Dialog.squeak = function(p) {
    "use strict";

    var $dlg = $("#activity");

    if (typeof p === "string")
        p = { message: p };

    if (typeof p.title === "string")
        $("#activity_title").text(p.title).show();
    else
        $("#activity_title").hide(); 
    
    if ($dlg.hasClass("hidden")) {
        $("#activity_close")
            .click(function() {
                $dlg.popup("close");
                if (typeof p.after_close === "function")
                    Utils.soon(p.after_close);
            });
        Squirrel.Dialog.init_dialog($dlg);
    }

    if (typeof p.message === "string")
        $("#activity_message").html(p.message);
    else
        $("#activity_message").empty().append(p.message);

    Squirrel.Dialog.open_dialog($dlg);
};
