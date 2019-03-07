define(function() {
    return function($dlg) {
        $dlg.on('dlg-initialise', function () {
            $dlg.squirrel_dialog("control", "text")
                .on("input", function () {
                    $dlg.squirrel_dialog("control", "ok")
                        .icon_button("enable");
                });

            $dlg.squirrel_dialog("control", "ok")
                .on($.getTapEvent ? $.getTapEvent() : "click", function () {
                    $dlg.squirrel_dialog("close");
                    let datum;
                    try {
                        datum = JSON.parse($dlg.squirrel_dialog("control", "text")
                                           .val());
                    } catch (e) {
                        $dlg.squirrel_dialog("squirrel").alert({
                            title: TX.tx("JSON could not be parsed"),
                            severity: "error",
                            message: e
                        });
                        return false;
                    }
                    $dlg.squirrel_dialog("control", "ok")
                        .icon_button("disable");
                    let self = $dlg.squirrel_dialog("instance");
                    if (self.options.debug) self.options.debug("Importing...");
                    $dlg.squirrel_dialog("squirrel").insert_data([], datum);
                    return true;
                });
        });

        $dlg.on('dlg-open', function () {
            let $dlg = $(this);

            let data = $dlg.squirrel_dialog("squirrel").client
                .hoard.JSON();
            $dlg.squirrel_dialog("control", "text")
                .text(data)
                .select();
            $dlg.squirrel_dialog("control", "ok")
                .icon_button("disable");
        });
    };
});

