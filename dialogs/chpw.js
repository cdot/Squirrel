/**
 * Encryption password change dialog
 */
define(function() {
    return function($dlg) {
        $dlg.on('dlg-initialise', function () {
            let $dlg = $(this);

            $dlg.squirrel_dialog("control", "show")
                .on("change", function () {
                    if ($dlg.squirrel_dialog("control", "show")
                        .prop("checked")) {
                        $dlg.squirrel_dialog("control", "pass")
                            .attr("type", "text");
                        $dlg.squirrel_dialog("control", "conf")
                            .attr("type", "text");
                    } else {
                        $dlg.squirrel_dialog("control", "pass")
                            .attr("type", "password");
                        $dlg.squirrel_dialog("control", "conf")
                            .attr("type", "password");
                    }
                });

            $dlg.data("validate", function () {
                let p = $dlg.squirrel_dialog("control", "pass")
                    .val(),
                    c = $dlg.squirrel_dialog("control", "conf")
                    .val();

                $dlg.squirrel_dialog("control", "nomatch")
                    .toggle(p !== c);
                return (p === c);
            });

            $dlg.squirrel_dialog("control", "conf")
                .on("change", function () {
                    $dlg.data("validate")
                        .call();
                });

            $dlg.squirrel_dialog("control", "set")
                .on($.getTapEvent(), function () {
                    if (!$dlg.data("validate")
                        .call())
                        return false;
                    $dlg.squirrel_dialog("close");
                    let p = $dlg.squirrel_dialog("control", "pass")
                        .val();
                    let app = $dlg.squirrel_dialog("squirrel");
                    app.client
                        .store.option("pass", p);
                    app.client.status = app.NEW_SETTINGS;
                    app.cloud
                        .store.option("pass", p);
                    app.cloud.status = app.NEW_SETTINGS;
                    app.trigger("update_save");

                    return true;
                });
        });

        $dlg.on('dlg-open', function () {
            let $dlg = $(this);
            $dlg.data("validate")
                .call();
        });
    };
});
      
