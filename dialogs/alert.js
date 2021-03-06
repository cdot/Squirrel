/*@preserve Copyright (C) 2015-2019 Crawford Currie http://c-dot.co.uk license MIT*/
/* eslint-env browser */

/**
 * Notification dialog
 */
define("dialogs/alert", ["js/Dialog"], function(Dialog) {

    let $http = null;

    class AlertDialog extends Dialog {

        // @Override
        open() {
            this.control("messages").empty();

            if (this.options.title)
                this.$dlg.dialog("option", "title", this.options.title);

            if (this.options.alert)
                this.push(this.options.alert);
        }

        /**
         * Add a message to the dialog
         * @param lert object {severity, message}:
         *  severity: one of "notice", "warning", "error"
         *  message: the translated message text
         * Can also be an array of these objects
         * @param first if true, add to the start of the message list
         */
        add(lert, first) {
            if (lert instanceof Array) {
                if (first)
                    for (let i = lert.length - 1; i >= 0; i--)
                        this.add(lert[i], true);
                else
                    for (let i in lert)
                        this.add(lert[i], false);
                return;
            }
            if (typeof lert === "string")
                lert = { message: lert };
            else if (lert.http) {
                if (!$http) {
                    let http_url = requirejs.toUrl("dialogs/http.html");
                    let self = this;
                    let morlert = $.extend({ first: true }, lert);
                    $.get(http_url)
                    .then((html) => {
                        $http = $(html);
                        $("body").append($http);
                        self.translate($http);
                        self.add(morlert, first);
                    });
                    return;
                }
                lert.message = $http.find(
                    "[title='http" + lert.http + "']").html();
            }
            if (!lert.severity)
                lert.severity = "notice";
            let mess = lert.message;
            if (mess instanceof Array)
                mess = mess.join("<br />");

            let $mess = $("<div>" + mess + "</div>")
                .addClass('dlg-' + lert.severity);
            if (first)
                this.control("messages").prepend($mess);
            else
                this.control("messages").append($mess);
        }

        /**
         * Add a message to the start of the message list.
         * @param lert see `add()' for details
         */
        unshift(lert) {
            this.add(lert, true);
        }
        
        /**
         * Add a message to the end of the message list.
         * @param lert see `add()' for details
         */
        push(lert) {
            this.add(lert, false);
        }
    }
    return AlertDialog;
});
