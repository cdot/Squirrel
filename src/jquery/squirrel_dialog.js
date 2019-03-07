/*@preserve Copyright (C) 2015-2018 Crawford Currie http://c-dot.co.uk license MIT*/

/* eslint-env jquery */

/**
 * Common code for dialogs. This is implemented in the form of a jQuery
 * widget called "squirrel_dialog".
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

define(["jquery", "jquery-ui"], function () {

    let default_dialog_options = {};
    
    $.set_dialog_options = function(options) {
        $.extend(default_dialog_options, options);
    };
    
    $.load_dialog = function(id, options) {
        options = $.extend({}, default_dialog_options, options);
        let $dlg = $(id + "_dlg");
        if ($dlg.length > 0)
            return Promise.resolve($dlg);
        
        if (options.debug) options.debug("loading dialog", id);

        // Use requirejs to locate the resources
        let html_url = requirejs.toUrl("dialogs" + "/" + id + ".html");

        // HTML first, then js. We don't use requirejs to load the html
        // because the text! plugin is stupid.
        return new Promise((resolve, reject) => {
            $.get(html_url)
            .then((html) => {
                let $dlg = $(html);
                if (options.onload)
                    options.onload($dlg);
                console.log("loaded html", html_url);
                $dlg.squirrel_dialog(options);
                requirejs(
                    ["dialogs/" + id], function(js) {
                        js($dlg);
                        resolve($dlg);
                    },
                    function(err) {
                        // Don't strictly need a .js
                        resolve($dlg);
                    });
            });
        });
    };

    $.widget("squirrel.squirrel_dialog", $.ui.dialog, {
        // Default options
        options: {
            modal: true,
            width: "auto",
            closeOnEscape: false,
            loadFrom: "dialogs",
            nocache: false
        },

        /**
         * Get the control in the dialog identified by the data-id="name"
         */
        control: function (name) {
            let $el = this.element.find("[data-id='" + name + "']");
            if ($el.length === 0)
                $el = this.element.find("[name='" + name + "']");
            if ($el.length === 0)
                $el = this.element.find("#" + name);
            return $el;
        },

        /**
         * Get the Squirrel instance for which this dialog has been created
         * @returns {Squirrel} instance
         */
        squirrel: function() {
            // toss up between $dlg.squirrel_dialog("squirrel") and
            // $dlg.squirrel_dialog("instance").options.squirrel
            return this.options.squirrel;
        },
        
        /**
         * e.g. $("my_dlg").squirrel_dialog("open", { $node: $node });
         * The $node is automatically placed in the data-node attribute
         * the the dialog. All other options are passed on to the
         * dlg-open handler(s)
         */
        open: function (options) {
            let self = this;
            let $dlg = self.element;

            if (!$dlg.hasClass("dlg-initialised")) {
                console.log("init");
                self.control("cancel")
                    .on($.getTapEvent ? $.getTapEvent() : "click",
                        function () {
                            $dlg.squirrel_dialog("close");
                            return false;
                        });
                $dlg.addClass("dlg-initialised");
                $dlg.trigger("dlg-initialise");
            }

            if ($.isTouchCapable && $.isTouchCapable()
                && !this.options.position) {
                this.options.position = {
                    my: "left top",
                    at: "left top",
                    of: $("body")
                };
            }
            
            // We can't delay this until the promise is resolved;
            this._super();

            if (typeof this.options.$node !== "undefined")
                $dlg.data("node", this.options.$node);
            $dlg.trigger("dlg-open", this.options);
        }
    });
});
