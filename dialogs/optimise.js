define(["dialogs/Dialog"], function(Dialog) {
    class OptimiseDialog extends Dialog {
        initialise() {
            this.control("optimise")
                .on(this.tapEvent(), function () {
                    this.app().client
                        .hoard.clear_actions();
                    this.app().construct_new_cloud(function () {
                        this.close();
                    });
                    // Local actions will now be reflected in the cloud,
                    // so we can clear them
                    return false;
                });
            this.control("optimise").icon_button();
        }

        open() {
            let squirrel = this.app();
            this.control("study").hide();
            this.control("pointless").hide();
            this.control("optimise")
                .icon_button("disable");
            this.control("calculating")
                .show()
                .toggle("pulsate", 101);

            if (squirrel) {
                console.log("WTF",squirrel);
                this.control("existing")
                .template(
                    "expand",
                    squirrel.cloud.hoard.actions.length);
                let hoard = squirrel.client.hoard;
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
                        this.control("calculating").hide();
                        this.control("study")
                            .template(
                                "expand",
                                counts.N, counts.A, counts.X,
                                counts.N + counts.A + counts.X)
                            .show();
                        if (counts.N + counts.A + counts.X <
                            this.app().cloud.hoard.actions.length)
                            this.control("optimise").icon_button("enable");
                        else
                            this.control("pointless").show();
                    });
            }
        }
    }
    return OptimiseDialog;
});
