/*@preserve Copyright (C) 2019 Crawford Currie http://c-dot.co.uk license MIT*/
/* eslint-env browser */

/**
 * Store optimisiation control dialog
 */
define("dialogs/optimise", ["dialogs/alert", "js/jq/template"], function(AlertDialog) {

    class OptimiseDialog extends AlertDialog {

        initialise() {
            this.control("existing").template();
            this.control("study").template();
        }

        ok() {
            let app = this.options.app;
            // Local actions will now be fully reflected in the cloud,
            // so we can clear them
            app.client.hoard.clear_history();
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
                app.cloud.hoard.history.length);
            let hoard = app.client.hoard;
            let counts = {
                "N": 0,
                "A": 0,
                "X": 0
            };

            let acts = hoard.actions_to_recreate();
            for (let act of acts) {
                counts[act.type]++;
            }

            this.control("calculating").hide();
            this.control("study")
            .template(
                "expand",
                counts.N, counts.A, counts.X,
                counts.N + counts.A + counts.X)
            .show();
            if (counts.N + counts.A + counts.X >=
                app.cloud.hoard.history.length)
                this.push(this.tx("Optimisation will not improve performance"));
        }
    }
    return OptimiseDialog;
});
