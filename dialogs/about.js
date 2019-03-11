/**
 * About dialog
 */
define(["js/Dialog", "jsjq/template"], function(Dialog) {

    const BUILD_DATE = "TODO: Work out a way to do this";

    class AboutDialog extends Dialog {

        initialise() {
            this.find(".template").template();
            this.control("built").template("expand", BUILD_DATE);
        }
    }
    return AboutDialog;
});
      
