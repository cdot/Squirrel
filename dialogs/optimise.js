/*@preserve Copyright (C) 2019 Crawford Currie http://c-dot.co.uk license MIT*/
/**
* Store optimisiation control dialog
*/
define(["js/Dialog", "js/jq/template"], function(Dialog) {

    class OptimiseDialog extends Dialog {

        initialise() {
            let self = this;

            this.control("optimise")
            .on(Dialog.tapEvent(), function () {
                this.app.client.hoard.clear_actions();
                this.app.construct_new_cloud(function() {
                })
                .then(function () {
                    self.close();
                });
                // Local actions will now be fully reflected in the cloud,
                // so we can clear them
                return false;
            });
            this.control("optimise").icon_button();
            this.control("existing").template();
        }

        open() {
            this.control("study").hide();
            this.control("pointless").hide();
            this.control("optimise")
            .icon_button("disable");
            this.control("calculating")
            .show()
            .toggle("pulsate", 101);

            let app = this.options.app;

            this.control("existing")
            .template(
                "expand",
                app.cloud.hoard.actions.length);
            let hoard = app.client.hoard;
            let counts = {
                "N": 0,
                "A": 0,
                "X": 0
            };
            hoard.actions_from_tree(hoard.tree, (e) => {
                counts[e.type]++;
            })
            .then(() => {
                this.control("calculating").hide();
                this.control("study")
                .template(
                    "expand",
                    counts.N, counts.A, counts.X,
                    counts.N + counts.A + counts.X)
                .show();
                if (counts.N + counts.A + counts.X <
                    app.cloud.hoard.actions.length)
                    this.control("optimise").icon_button("enable");
                else
                    this.control("pointless").show();
            });
        }
    }
    return OptimiseDialog;
});
