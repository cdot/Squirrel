/*@preserve Copyright (C) 2019 Crawford Currie http://c-dot.co.uk license MIT*/

/**
 * Dynamic dialog loader and Base class of modal dialogs. Loads
 * dialogs dynamically. Dialogs are defined using (1) an HTML <div>
 * which can either be embedded in the the main HTML or loaded using
 * from a file found using requirejs, and (2) a JS subclass of
 * "Dialog" again loaded by requirejs.
 */
define(["js/Translator", "jquery", "jquery-ui", "jsjq/icon_button"], function(Translator) {
    
    // Default options
    let default_dialog_options = {};
    
    // Cache of loaded code modules
    let classes = {};

    class Dialog {

        /**
         * Set default options for all dialogs that will be created using
         * Dialog.load()
         */
        static set_default_options(options) {
            $.extend(default_dialog_options, options);
        }

        /**
         * Return a promise to load and initialise the code for a dialog.
         * @param id the root name of the dialog. HTML will be loaded from
         * dialogs/<id>.html and js from dialogs/<id>.js. dialogs/ is found
         * from the requirejs.config.
         * @param options optional options that override options set using
         * $.set_dialog_options(). These are passed to the Dialog subclass
         * during construction. The only options used in this module is
         * debug: optional debug function
         * @return a promise that resolves to the Dialog object
         */
        static load(id, options) {
            options = $.extend({}, default_dialog_options, options);
            let $dlg = $("#" + id + "_dlg");
            let p;
        
            // Load HTML first (if we need to), then js. We don't use
            // requirejs to load the html because the text! plugin is
            // stupid, but we do use requirejs.toUrl to locate the
            // resource.
            if ($dlg.length > 0) {
                if (options.debug)
                    options.debug("HTML for dialog", id, "is already loaded");
                p = Promise.resolve($dlg);
            } else {               
                let html_url = requirejs.toUrl("dialogs" + "/" + id + ".html");

                // testing only
                if (options.htmlRoot)
                    html_url = options.htmlRoot + "dialogs/" + id + ".html";
                
                if (options.debug)
                    options.debug(
                        "Loading HTML for dialog", id, "from", html_url);

                p = $.get(html_url)
                    .then((html) => {
                        if (options.debug) options.debug("HTML was loaded");
                        let $dlg = $(html);
                        
                        // force the id so we can find it again
                        $dlg.attr("id", id + "_dlg");
                        // force the CSS class - should be hidden
                        $dlg.addClass("dlg-dialog");
                        
                        $("body").append($dlg);
                        
                        return $dlg;
                    });
            }

            return p.then(($dlg) => {
                if (classes[id]) {
                    if (options.debug)
                        options.debug("JS for dialog", id, "is already loaded");
                    return Promise.resolve(classes[id]);
                }
            
                if (options.debug) options.debug("Loading JS for dialog", id);
                return new Promise((resolve) => {
                    requirejs(
                        ["dialogs/" + id],
                        function(dlgClass) {
                            classes[id] = new dlgClass($dlg, options);
                            resolve(classes[id]);
                        },
                        function(err) {
                            // Don't strictly need a .js
                            throw new Error("Missing dialog " + id + ".js");
                        });
                });
            });
        }

        /**
         * Return a promise to load (if necessary) and open a non-blocking
         * dialog.
         * @return a promise that will resolve to the Dialog object
         */
        static open(id, options) {
            return Dialog.load(id, options)
            .then((dlg) => {
                dlg.blocking = false;
                dlg.$dlg.parent().find(".ui-dialog-titlebar>button").show();
                dlg.options = $.extend(dlg.options, options);
                dlg.$dlg.dialog("open");
                return dlg;
            });
        }
        
        /**
         * Return a promise to load (if necessary) and open a blocking
         * dialog. The promise returned will not resolve until the dialog
         * is explicitly closed.
         * @return a promise that will resolve to the Dialog object when
         * the dialog is closed.
         */
        static confirm(id, options) {
            let self = this;
            return new Promise((resolve) => {
                Dialog.load(id, options)
                .then((dlg) => {
                    dlg.blocking = true;
                    dlg.$dlg.parent().find(".ui-dialog-titlebar>button").hide();
                    dlg.$dlg.dialog("option", "close", () => {
                        dlg.$dlg.dialog("option", "close", null);
                        resolve(dlg);
                    });
                    dlg.options = $.extend(dlg.options, options);
                    dlg.$dlg.dialog("open");
                });
            });
        }
        
        /**
         * @param $dlg jQuery object for the dialog being constructed
         * @param options options that will be passed on the the jQuery UI
         * $.dialog() constructor. This class will use the 'debug' option
         * which is a debug function.
         */
        constructor($dlg, options) {
            let self = this;
            this.debug = options.debug;
            this.$dlg = $dlg;

            // Default options
            self.options = $.extend({}, options);
            
            let bfc = options.beforeClose;
            options.beforeClose = (e) => {
                return !self.blocking;
                if (bfc)
                    return bfc(e);
                return true;
            };

            let jq_options = $.extend({
                modal: true,
                width: "auto",
                autoOpen: false,
                closeOnEscape: false,
                open: function(event, ui) {
                    // jqueryui.dialog open event

                    // Lazy initialisation
                    if (!$dlg.hasClass("dlg-initialised"))
                        self._initialise();

                    self.open();
                }
            }, options);

            // On touch capable devices, position the dialog at the
            // left top of the body by default. On other devices it
            // will default to the centre.
            if ($.isTouchCapable && $.isTouchCapable()
                && !jq_options.position) {
                jq_options.position = {
                    my: "left top",
                    at: "left top",
                    of: $("body")
                };
            }
            $dlg.dialog(jq_options);
        }

        /**
         * @private
         */
        _initialise() {
            let self = this;
            
            this.initialise();

            this.find("button").icon_button();
            
            // Add handler to default OK control
            this.control("ok", true)
                .on(this.tapEvent(), function () {
                    if (self.ok())
                        self.close();
                    return false;
                });
                    
            this.control("cancel", true)
                .on(this.tapEvent(), function () {
                    self.close();
                    return false;
                });
                    
            this.$dlg.addClass("dlg-initialised");
        }

        /**
         * Override in subclasses for actions when the dialog is being
         * initialised e.g. handlers
         */
        initialise() {
        }

        /**
         * Override in subclasses for actions when the dialog opens
         */
        open() {
        }

        /**
         * Override in subclasses to change behavior when OK button
         * is clicked.
         * @return false to cancel the close.
         */
        ok() {
            return true;
        }
        
        /**
         * Service for subclasses.
         */
        isOpen() {
            return this.$dlg.dialog("isOpen");
        }
        
        /**
         * Service for subclasses.
         * Get the control in the dialog identified by the key
         * @param key data-id
         * @param optional, true if it's OK if the key is missing
         */
        control(key, mayBeMissing) {
            let $el = this.$dlg.find("[data-id='" + key + "']");
            if (this.debug && $el.length === 0 && !mayBeMissing)
                throw new Error("Unknown control " + key);
            return $el;
        }

        /**
         * Service for subclasses.
         * Perform a jquery .find on the dialog
         */
        find(sel) {
            return this.$dlg.find(sel);
        }

        
        /**
         * Service for subclasses.
         * Get the tap event
         */
        tapEvent() {
            return $.getTapEvent ? $.getTapEvent() : "click";
        }
        
        /**
         * Service for subclasses.
         * Close the dialog
         */
        close() {
            this.blocking = false;
            this.$dlg.dialog("close");
        }
        
        /**
         * Service for subclasses.
         * Translate the string (and option parameters) passed
         * @return {String} the translation
         */
        tx() {
            return Translator.prototype.tx.apply(
                Translator.instance(), arguments);
        }
    }
    return Dialog;
});
