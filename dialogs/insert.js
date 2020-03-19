/*@preserve Copyright (C) 2019 Crawford Currie http://c-dot.co.uk license MIT*/
/* eslint-env browser */

/**
 * Insert a copy of data
 * Options:
 * $node (required)
 * data: data value to insert
 */
define("dialogs/insert", ["dialogs/add"], function(AddDialog) {
    class InsertDialog extends AddDialog {
        validateValue() {
            let $ta = this.control("value");
            let text = $ta.val();
            
            try {
                JSON.parse(text);
                this.control("ok").icon_button("enable");
                $ta
                .removeClass("dlg-disabled")
                .attr("title", this.tx("Edit valid JSON"));
            } catch (e) {
                this.control("ok").icon_button("disable");
                $ta
                .addClass("dlg-disabled")
                .attr("title", e);
            }
        }

        initialise() {
            let self = this;
            super.initialise();
            this.control("value")
            .on("input", function () {
                self.validateValue();
            })
        }
        
        open() {
            super.open();
            this.validateValue();
        }
    }
    return InsertDialog;
});
