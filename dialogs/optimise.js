define(function() {
    return function($dlg) {
        $dlg.on('dlg-initialise', function () {
            let $dlg = $(this);

            $dlg.squirrel_dialog("control", "optimise")
                .on($.getTapEvent(), function () {
                    $dlg.squirrel_dialog("squirrel").client
                        .hoard.clear_actions();
                    $dlg.squirrel_dialog("squirrel").construct_new_cloud(function () {
                        $dlg.squirrel_dialog("close");
                    });
                    // Local actions will now be reflected in the cloud,
                    // so we can clear them
                    return false;
                });
        });

        $dlg.on('dlg-open', function () {
            let $dlg = $(this);

            $dlg.squirrel_dialog("control", "existing")
                .template(
                    "expand",
                    $dlg.squirrel_dialog("squirrel").cloud
                        .hoard.actions.length);
            $dlg.squirrel_dialog("control", "study").hide();
            $dlg.squirrel_dialog("control", "pointless").hide();
            $dlg.squirrel_dialog("control", "optimise")
                .icon_button("disable");
            $dlg.squirrel_dialog("control", "calculating")
                .show()
                .toggle("pulsate", 101);

            let hoard = $dlg.squirrel_dialog("squirrel").client.hoard;
            let counts = {
                "N": 0,
                "A": 0,
                "X": 0
            };
            hoard.actions_from_hierarchy(
                hoard.cache,
                function (e, follow) {
                    counts[e.type]++;
                    if (follow)
                        follow();
                },
                null,
                function () {
                    $dlg.squirrel_dialog("control", "calculating").hide();
                    $dlg.squirrel_dialog("control", "study")
                        .template(
                            "expand",
                            counts.N, counts.A, counts.X,
                            counts.N + counts.A + counts.X)
                        .show();
                    if (counts.N + counts.A + counts.X <
                        $dlg.squirrel_dialog("squirrel").cloud.hoard.actions.length)
                        $dlg.squirrel_dialog("control", "optimise").icon_button("enable");
                    else
                        $dlg.squirrel_dialog("control", "pointless").show();
                });
        });
    }
});
