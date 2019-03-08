define(["dialogs/Dialog"], function(Dialog) {
    class JSONDialog extends Dialog {
        initialise() {
            this.control("text")
                .on("input", function () {
                    this.control("ok").icon_button("enable");
                });
        }

        ok() {
            let datum;
            try {
                datum = JSON.parse(this.control("text")
                                   .val());
            } catch (e) {
                this.app().alert({
                    title: TX.tx("JSON could not be parsed"),
                    severity: "error",
                    message: e
                });
                return false;
            }
            this.control("ok").icon_button("disable");
            this.app().insert_data([], datum);
            return true;
        }

        open() {
            let data;
            if (this.app())
                data = this.app().client.hoard.JSON();
            else
                data = '{"some":"json"}'; /// test
            this.control("text")
                .text(data)
                .select();
            this.control("ok").icon_button("disable");
        }
    }
    return JSONDialog;
});

