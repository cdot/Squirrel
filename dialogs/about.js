/*@preserve Copyright (C) 2019 Crawford Currie http://c-dot.co.uk license MIT*/
/* eslint-env browser */

/**
 * About dialog
 */
define(["js/Dialog", "js/jq/template"], function(Dialog) {

    class AboutDialog extends Dialog {

        initialise() {
            this.find(".template").template();
            this.control("built").template(
                "expand", $("meta[name='build-date']").attr("content"));
        }
    }
    return AboutDialog;
});

