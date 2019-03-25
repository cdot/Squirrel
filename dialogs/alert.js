/*@preserve Copyright (C) 2015-2019 Crawford Currie http://c-dot.co.uk license MIT*/
/* eslint-env browser */

/**
 * Notification dialog
 */
define(["js/Dialog"], function(Dialog) {

    let $http = null;

    class AlertDialog extends Dialog {

        /**
         * @param p map with following fields:
         *  severity: one of "notice", "warning", "error"
         *   message: the translated message text
         *   transitory: if true, will delete the message on the next alert
         * If p is undefined the dialog will be closed
         */
        open() {
            this.control("messages").empty();

            if (this.options.title)
                this.$dlg.dialog("option", "title", this.options.title);

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
                        self.add(morlert);
                    });
                    return;
                }
                lert.message = $http.find(
                    "[title='http" + lert.http + "']").html();
            }
            if (!lert.severity)
                lert.severity = "notice";
            let $mess = $("<div>" + lert.message + "</div>")
                .addClass('dlg-' + lert.severity);
            if (lert.first)
                this.control("messages").prepend($mess);
            else
                this.control("messages").append($mess);
        }
    }
    return AlertDialog;
});
