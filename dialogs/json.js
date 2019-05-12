/*@preserve Copyright (C) 2019 Crawford Currie http://c-dot.co.uk license MIT*/
/* eslint-env browser */

/**
 * Edit JSON
 * Options:
 * app (required)
 */
define("dialogs/json", ["js/Dialog"], function(Dialog) {

    class JSONDialog extends Dialog {

        _parse() {
            try {
                this.parsed = JSON.parse(this.control("text").val());
                this.control("messages").text("");
                this.control("ok").show();
            } catch (e) {
                this.control("messages").text(
                    this.tx("JSON could not be parsed:") + " " + e);
                this.control("ok").hide();
            }
        }
        
        initialise() {
            let self = this;

            this.control("text")
            .on("input", function () {
                self.changed = true;
                self._parse();
            });
        }

        open() {
            this.control("text").text(this.options.json).select();
            this.parsed = undefined;
            this.changed = false;
            this._parse();
        }

        ok() {
            return (this.parsed != this.options.json) ? this.parsed : undefined;
        }

    }
    return JSONDialog;
});

