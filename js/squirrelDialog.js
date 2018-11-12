/*@preserve Copyright (C) 2015-2018 Crawford Currie http://c-dot.co.uk license MIT*/

/* eslint-env jquery */

/**
 * Common code for dialogs. This is implemented in the form of a jQuery
 * widget called "squirrelDialog".
 *
 * Dialog HTML consists of a DIV with a unique id and the class "dlg-dialog".
 * input elements within the dialog are identified using data-id attributes
 * that are unique within the dialog, but need not be unique within the
 * document. This allows us to re-use the same identifier in several dialogs.
 *
 * Each dialog has optional methods, an initialiser and/or an opener.
 *
 * The initialiser is run the first time the dialog is instantiated.
 * This does things like attaching handlers to controls.
 *
 * The opener is run each time the dialog is opened. This characterises
 * the dialog for the specific context.
 *
 * These are attached using listeners e.g.
 *
 * $("#my_dlg").on("dlg-open", function(e, options) ...
 * $("#my_dlg").on("dlg-initialise", function(e) ...
 *
 * Event handlers are called this set to the widget.
 */

(function ($) {
    "use strict";

    $.widget("squirrel.squirrelDialog", $.ui.dialog, {
        /**
         * Get the control in the dialog identified by the data-id="name"
         */
        control: function (name) {
            return this.element.find("[data-id='" + name + "']");
        },

        /**
         * e.g. $("my_dlg").squirrelDialog("open", { $node: $node });
         * The $node is automatically placed in the data-node attribute
         * the the dialog. All other options are passed on to the
         * dlg-open handler(s)
         */
        open: function (options) {
            var $dlg = this.element;

            if (!$dlg.hasClass("dlg-initialised")) {
                $dlg.addClass("dlg-initialised");
                this.control("cancel")
                    .on($.getTapEvent(), function () {
                        $dlg.squirrelDialog("close");
                        return false;
                    });
                $dlg.trigger("dlg-initialise");
            }

            if (options && options.$node)
                $dlg.data("node", options.$node);

            $dlg.trigger("dlg-open", options);

            if ($.isTouchCapable() && !this.options.position) {
                this.options.position = {
                    my: "left top",
                    at: "left top",
                    of: $("body")
                };
            }
            this.options.modal = true;
            this.options.width = "auto";
            this.options.closeOnEscape = false;

            return this._super();
        }
    });
})(jQuery);