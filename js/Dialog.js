/*@preserve Copyright (C) 2019-2021 Crawford Currie http://c-dot.co.uk license MIT*/
/* eslint-env browser */

define("js/Dialog", ["js/Translator", "js/Serror", "js/Progress", "jquery", "jquery-ui", "js/jq/icon_button", "js/jq/twisted"], function(Translator, Serror, Progress) {

    // Default options
    let default_dialog_options = {};

    // Promises for HTML modules waiting for load
    let htmls = [];
    
    // Cache of loaded code modules
    let classes = {};

	/**
	 * Dynamic dialog loader and Base class of modal dialogs. Loads
	 * dialogs dynamically. Dialogs are defined using (1) an HTML `div`
	 * which can either be embedded in the the main HTML or loaded using
	 * from a file found using requirejs, and (2) a JS subclass of
	 * `Dialog` again loaded by requirejs.
	 * @extends Progress
	 */
    class Dialog extends Progress {

        /**
         * Set default options for all dialogs that will be created using
         * Dialog.load()
         */
        static set_default_options(options) {
            $.extend(default_dialog_options, options);
        }

        /**
         * @param {jQuery} $dlg jQuery object for the dialog being constructed
         * @param {object} options options that will be passed on the
         * the jQuery UI $.dialog() constructor
		 * @param {function} options.debug only option used by this class,
		 * the rest are passed on to $.dialog
         */
        constructor($dlg, options) {
			super();
            let self = this;
            this.debug = options.debug;
            this.$dlg = $dlg;

            // Default options
            self.options = $.extend({}, options);

            let jq_options = $.extend({
                modal: true,
                width: "auto",
                autoOpen: false,
                closeOnEscape: false,
                open: function(/*event, ui*/) {
                    // jqueryui.dialog open event

                    // Lazy initialisation
                    if (!$dlg.hasClass("dlg-initialised"))
                        self._initialise();

                    self._oked = false;
                    self._result = false;
                    self._resolve = undefined;
                    self._reject = undefined;
                    self.open();
                },
                beforeClose: function() {
                    if (self._oked && self._resolve)
                        self._resolve(self._result);
                    else if (!self.oked && self._reject)
                        self._reject(self);
                    return true;
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
         * Return a promise to load and initialise the code for a dialog.
         * @param {string} id the root name of the dialog. HTML will
         * be loaded from `dialogs/<id>.html` and js from
         * `dialogs/<id>.js`
         * @param {object} options optional options that override
         * options set using `$.set_dialog_options()`. These are
         * passed to the Dialog subclass during construction. The only
         * option used in this class is `debug` - an optional debug
         * function
         * @return {Promise} resolves to the Dialog object
         */
        static load(id, options) {
            options = $.extend({}, default_dialog_options, options);
            let $dlg = $(`#${id}_dlg`);
            let p;

            // Load HTML first (if we need to), then js. We don't use
            // requirejs to load the html because the text! plugin is
            // stupid, but we do use requirejs.toUrl to locate the
            // resource.
            if ($dlg.length > 0) {
                //if (options.debug)
                //    options.debug("HTML for dialog", id, "is already loaded");
                p = Promise.resolve($dlg);
            } else {
                let html_url = requirejs.toUrl(`dialogs/${id}.html`);

                // testing only
                if (options.htmlRoot)
                    html_url = `${options.htmlRoot}dialogs/${id}.html`;

                //if (options.debug)
                //    options.debug(
                //        "Loading HTML for dialog", id, "from", html_url);

                if (!htmls[html_url]) {
                    htmls[html_url] = $.get(html_url)
                    .then((html) => {
                        if (options.debug)
                            options.debug("HTML for",id,"was loaded");
                        let $dlg = $(html);
                        Translator.instance().translate($dlg[0]);
                        // force the id so we can find it again
                        $dlg.attr("id", id + "_dlg");
                        // force the CSS class - should be hidden
                        $dlg.addClass("dlg-dialog");

                        $("body").append($dlg);

                        return $dlg;
                    });
                }
                p = htmls[html_url];
            }

            return p.then(($dlg) => {
                if (typeof classes[id] === "undefined") {
                    classes[id] = new Promise((resolve) => {
                        requirejs(
                            [`dialogs/${id}`],
                            function(dlgClass) {
                                classes[id] = new dlgClass($dlg, options);
                                resolve(classes[id]);
                            },
                            function(/*err*/) {
                                // Don't strictly need a .js
                                Serror.assert(`Missing dialog ${id}.js`);
                            });
                    });
                }
                else if (classes[id] instanceof Promise)
                    return classes[id];

                return Promise.resolve(classes[id]);
            });
        }

        /**
         * Return a promise to load (if necessary) and open a non-blocking
         * dialog. See #load for a description of parameters.
         * @return {Promise} resolves to the Dialog object
         */
        static open(id, options) {
            this.resolve = undefined;
            return Dialog.load(id, options)
            .then(dlg => {
                dlg.options = $.extend(dlg.options, options);
                dlg.$dlg.dialog("open");
                return dlg;
            });
        }

        /**
         * Return a promise to open a blocking
         * dialog. The promise returned will not resolve until the dialog
         * is explicitly closed. Most dialogs are of this type.
		 * See #load for a description of parameters.
         * @return {Promise} resolves to the Dialog object when
         * the dialog is closed.
         */
        static confirm(id, options) {
            return Dialog.load(id, options)
            .then((dlg) => {
                dlg.options = $.extend(dlg.options, options);
                dlg.$dlg.dialog("open");
                return dlg.wait();
            });
        }

        /**
         * Promise to wait for a dialog that was opened using Dialog.open to
         * be closed (e.g.
         * Dialog.open("dialog").then((dlg) => {
         *    return dlg.wait();
         * })
         * .then((dlg) => { if (dlg.wasOked()) ... });
         * @return {Promise} resolves to the Dialog object when
         * the dialog is closed.
         */
        wait() {
            let self = this;
            //this.$dlg.parent().find(".ui-dialog-titlebar>button").hide();
            return new Promise((resolve, reject) => {
                self._resolve = resolve;
                self._reject = reject;
            });
        }

        _initialise() {
            let self = this;

            this.initialise();

            // On devices with touch capability, hovering over an element
            // to see the tooltip doesn't work. So on these devices we
            // open the title in a dialog.
            if ($.isTouchCapable()) {
                this.find(".tooltip-twisty").each(function() {
                    //if (!$.isTouchCapable())
                    //    return;
                    let $this = $(this);
                    let $div = $("<div data-open='ui-icon-info'></div>");
                    $div.addClass("twisted");
                    $div.addClass("TX_text");
                    $div.text($this.attr("title"));
                    $this.after($div);
                });

                this.find(".tooltip-tr").each(function() {
                });

                // If a TR has the the dialog attr, transfer it
                // down to the first element in the first cell in the table
                this.find("tr.tooltip-dialog").each(function() {
                    let $tr = $(this);
                    let text = $tr.attr("title");
                    $tr.removeClass("tooltip-dialog");
                    $tr.children("td,th")
                    .first().children().first().each(function() {
                        $(this)
                        .attr("title", text)
                        .addClass("tooltip-dialog TX_title");
                    });
                });
                
                this.find(".tooltip-dialog").each(function() {
                    let $this = $(this);
                    $("<button data-icon='ui-icon-info'></button>")
                    .insertAfter($this)
                    .icon_button()
                    .on(Dialog.tapEvent(), function() {
                        Dialog.confirm("alert", {
                            title: self.tx("Information"),
                            alert: $this.attr("title")
                        });
                    });
                });
            }
            
            this.find(".twisted").twisted();
            this.find("button").icon_button();

            
            // Add handler to default OK control
            let $ok = this.control("ok", true);
            if ($ok) {
                $ok.on(Dialog.tapEvent(), function () {
                    self._result = true;
                    self._oked = true;
                    if (self.ok)
                        self._result = self.ok();
                    self.close();
                });
            }

            let $cancel = this.control("cancel", true);
            if ($cancel)
                $cancel.on(Dialog.tapEvent(), () => {
                    self._result = false;
                    self._oked = false;
                    self.close();
                });

            this.$dlg.addClass("dlg-initialised");
        }

        /**
         * Override in subclasses for actions when the dialog is being
         * initialised e.g. handlers
         * @private
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
         * @return {boolean} false to cancel the close.
         */
        ok() {
            return true;
        }

        /**
         * Service for subclasses.
		 * @return {boolean} true if the dialog is currently open
         */
        isOpen() {
            return this.$dlg.dialog("isOpen");
        }

        /**
         * Service for subclasses.
         * Get the control in the dialog identified by the key
         * @param key data-id
         * @param optional, true if it's OK if the key is missing
		 * @return {jQuery} the control
         */
        control(key, mayBeMissing) {
            let $el = this.$dlg.find(`[data-id='${key}']`);
            if (this.debug && $el.length === 0 && !mayBeMissing) {
                this.debug("Unknown control", key);
                throw new Serror(500,`Unknown control ${key}`);
            }
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
        static tapEvent() {
            return $.getTapEvent();
        }

        /**
         * Service for subclasses.
         * Get the double-tap event
		 * @return {string} either `doubletap` or `dblclick`
         */
        static doubleTapEvent() {
            return $.isTouchCapable && $.isTouchCapable() ?
            "doubletap" : "dblclick";
        }

        /**
         * Service for subclasses.
         * Close the dialog
         */
        close() {
            this.$dlg.dialog("close");
        }

        /**
         * Service for subclasses.
         * Translate the string (and option parameters) passed
         * @return {string} the translation
         */
        tx() {
            return Translator.prototype.tx.apply(
                Translator.instance(), arguments);
        }

        /**
         * Service for subclasses.
         * Translate the dom passed. Translation occurs in-place.
		 * @return {string} the translated dom
         */
        translate(dom) {
            return Translator.instance().translate(dom);
        }
    }
    return Dialog;
});
