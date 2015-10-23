/* Copyright (C) 2015 Crawford Currie http://c-dot.co.uk / MIT */

// Mobile customisation of dialogs
Squirrel.Dialog.init_dialog = function($dlg) {
    "use strict";
    $dlg
        .removeClass("hidden")
        .popup({ history: false });
};

Squirrel.Dialog.open_dialog = function($dlg) {
    "use strict";
    $dlg.popup("open");
};

Squirrel.Dialog.close_dialog = function($dlg) {
    "use strict";
    $dlg.popup("close");
};

Squirrel.Dialog.squeak = function(p) {
    "use strict";

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
        Squirrel.Dialog.init_dialog($dlg);
    }

    if (typeof p.message === "string")
        $("#squeak_message").html(p.message);
    else
        $("#squeak_message").empty().append(p.message);

    Squirrel.Dialog.open_dialog($dlg);
};
