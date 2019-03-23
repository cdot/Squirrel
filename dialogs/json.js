/*@preserve Copyright (C) 2019 Crawford Currie http://c-dot.co.uk license MIT*/
/**
 * Edit JSON
 * Options:
 * app (required)
 */
define(["js/Dialog"], function(Dialog) {

    class JSONDialog extends Dialog {

        _parse() {
            try {
                this.parsed = JSON.parse(this.control("text").val());
                this.control("messages").text("");
                this.control("ok").icon_button("enable");
                return true;
            } catch (e) {
                this.control("messages").html(
                    this.tx("JSON could not be parsed:") + " " + e);
                this.control("ok").icon_button("disable");
                return false;
            }
        }
        
        initialise() {
            let self = this;

            this.control("text")
            .on("input", function () {
                self._parse();
            });
        }

        ok() {
            return this.options.app.insert_data([], self.parsed, self);
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

