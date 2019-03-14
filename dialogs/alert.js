/*@preserve Copyright (C) 2015-2019 Crawford Currie http://c-dot.co.uk license MIT*/
/**
 * Notification dialog
 */
define(["js/Dialog"], function(Dialog) {

    class AlertDialog extends Dialog {
        
        /**
         * @param p map with following fields:
         *  severity: one of "notice", "warning", "error"
         *   message: the translated message text
         *   transitory: if true, will delete the message on the next alert
         * If p is undefined the dialog will be closed
         */
        open() {
            let self = this;
            //if (self.debug) self.debug(this.options.alert);
            self.control("messages").empty();
            if (this.options.alert)
                this.add(this.options.alert);
        }

        add(lert) {
            if (lert instanceof Array) {
                for (let i in lert)
                    this.add(lert[i]);
                return;
            }
            if (typeof lert === "string")
                lert = { message: lert };
            if (!lert.severity)
                lert.severity = "notice";
            let $mess = $("<div></div>").addClass('dlg-' + lert.severity);
            $mess.append(lert.message);
            this.control("messages").append($mess);
        }
    }
    return AlertDialog;
});
