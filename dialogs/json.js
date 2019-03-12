/*@preserve Copyright (C) 2019 Crawford Currie http://c-dot.co.uk license MIT*/
/**
 * Edit JSON
 * Options:
 * app (required)
 */
define(["js/Dialog"], function(Dialog) {
    class JSONDialog extends Dialog {
        initialise() {
            let self = this;
            this.control("text")
                .on("input", function () {
                    self.control("ok").icon_button("enable");
                });
        }

        ok() {
            return Dialog.open("alert", {
                title: TX.tx("Loading")
            })
            .then((progress) => {
                let datum;
                try {
                    datum = JSON.parse(this.control("text").val());
                } catch (e) {
                    progress.add({
                        severity: "error",
                        message: tx("JSON could not be parsed: " + e),
                    })
                    return false;
                }
                this.control("ok").icon_button("disable");
                this.options.app.insert_data([], datum, progress);
                return true;
            });
        }

        open() {
            let data = this.options.app.client.hoard.JSON();
            this.control("text")
                .text(data)
                .select();
            this.control("ok").icon_button("disable");
        }
    }
    return JSONDialog;
});

