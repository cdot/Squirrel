/*@preserve Copyright (C) 2019 Crawford Currie http://c-dot.co.uk license MIT*/
/* eslint-env browser */

/**
 * About dialog
 */
define("dialogs/about", ["js/Dialog", "js/jq/template"], Dialog => {

    class AboutDialog extends Dialog {

        initialise() {
            this.$dlg.find(".template").template();
            this.$control("built").template(
                "expand", $("meta[name='build-date']").attr("content"));
        }
    }
    return AboutDialog;
});

