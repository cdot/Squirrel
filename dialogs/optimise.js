/*@preserve Copyright (C) 2019 Crawford Currie http://c-dot.co.uk license MIT*/
/**
* Store optimisiation control dialog
*/
define(["dialogs/alert", "js/jq/template"], function(AlertDialog) {

    class OptimiseDialog extends AlertDialog {

        initialise() {
            let self = this;

            this.control("existing").template();
            this.control("study").template();
        }

        ok() {
            let app = this.options.app;
            // Local actions will now be fully reflected in the cloud,
            // so we can clear them
            app.client.hoard.clear_actions();
            return app.construct_new_cloud(this);
        }

        open() {
            super.open();

            this.control("study").hide();
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
            let self = this;
            hoard.actions_from_tree(hoard.tree, (e) => {
                counts[e.type]++;
                return Promise.resolve();
            })
            .then(() => {
                this.control("calculating").hide();
                this.control("study")
                .template(
                    "expand",
                    counts.N, counts.A, counts.X,
                    counts.N + counts.A + counts.X)
                .show();
                if (counts.N + counts.A + counts.X >=
                    app.cloud.hoard.actions.length)
                    this.add(self.tx("Optimisation will not improve performance"));
            });
        }
    }
    return OptimiseDialog;
});
