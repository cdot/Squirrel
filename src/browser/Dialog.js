/*@preserve Copyright (C) 2019-2023 Crawford Currie http://c-dot.co.uk license MIT*/
/* eslint-env browser,jquery */

import "jquery";
import "jquery-ui";
//import "@rwap/jquery-ui-touch-punch";

import "../jq/cookie.js";
import "../jq/icon_button.js";
import "../jq/twisted.js";
import "../jq/template.js";

import { Serror } from "../common/Serror.js";
import { Utils } from "../common/Utils.js";
import { Progress } from "../common/Progress.js";

// Default options
const default_dialog_options = {};

// Promises for HTML modules waiting for load
const htmls = [];

// Cache of loaded code modules
const classes = {};

/**
 * Dynamic dialog loader and Base class of modal dialogs. Loads
 * dialogs dynamically. Dialogs are defined using (1) an HTML `div`
 * which can either be embedded in the the main HTML or loaded using
 * from a file found using import, and (2) a JS subclass of
 * `Dialog` again loaded by import.
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

    this.debug = options.debug;
    this.$dlg = $dlg;

    // Default options
    this.options = $.extend({}, options);

    const jq_options = $.extend({
      modal: true,
      width: "auto",
      autoOpen: false,
      closeOnEscape: false,

      open: (/*event, ui*/) => {
        // jquery ui dialog open event

        // Lazy initialisation
        if (!$dlg.hasClass("dlg-initialised"))
          this._initialise();

        this._oked = false;
        this._result = false;
        this._resolve = undefined;
        this._reject = undefined;
        this.onOpened();
      },

      beforeClose: () => {
        if (this._oked && this._resolve)
          this._resolve(this._result);
        else if (!this.oked && this._reject)
          this._reject(this);
        return true;
      },

			close: () => {
				this.onClosed();
			}
    }, options);

    // On touch capable devices, position the dialog at the
    // left top of the body by default. On other devices it
    // will default to the centre.
    if ($.support.touch && !jq_options.position) {
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
   * be loaded from `html/<id>.html` and js from
   * `src/browser/<id>.js`
   * @param {object} options optional options that override
   * options set using `$.set_dialog_options()`. These are
   * passed to the Dialog subclass during construction. The only
   * option used in this class is `debug` - an optional debug
   * function
   * @return {Promise} resolves to the Dialog object
   */
  static load(id, options) {
    options = $.extend({}, default_dialog_options, options);
    const $dlg = $(`#${id}_dlg`);
    let p;

    // Load HTML first (if we need to), then js.
    if ($dlg.length > 0) {
      //if (options.debug)
      //  options.debug("HTML for dialog", id, "is already loaded");
      $dlg.data("id", id);
      p = Promise.resolve($dlg);
    } else {
      let html_path;
      if (typeof global === "undefined")
        html_path = "./html";
      else {
        html_path = import.meta.url.toString().replace(
          /Dialog.js$/, "../../html");
      }
      let html_url = `${html_path}/${id}.html`;

      // testing only
      if (options.htmlRoot)
        html_url = `${options.htmlRoot}/${id}.html`;

      //if (options.debug)
      //    options.debug(
      //        "Loading HTML for dialog", id, "from", html_url);

      if (!htmls[html_url]) {
        htmls[html_url] = $.get(html_url)
        .then(html => {
          //if (options.debug)
          //  options.debug("HTML for",id,"was loaded");
          const $dlg = $(html);
          $("body").append($dlg);

          $("[data-i18n]", $dlg)
          .i18n();

          $("[data-i18n-placeholder]", $dlg)
          .each(function() {
            $(this).attr("placeholder", $.i18n(
              $(this).data("i18n-placeholder")));
          });

          $("[data-i18n-title]", $dlg)
          .add($dlg.filter("[data-i18n-title]")) // add root
          .each(function() {
            $(this).attr("title", $.i18n(
              $(this).data("i18n-title")));
          });

          // SMELL: can trip over data-i18n-title= attribute
          $("[data-i18n-tooltip]", $dlg)
          .each(function() {
            $(this).attr("title", $.i18n(
              $(this).data("i18n-tooltip")));
          });

          // force the id so we can find it again
          $dlg.attr("id", `${id}_dlg`);
          $dlg.data("id", id);
          // force the CSS class - should hide it
          $dlg.addClass("dlg-dialog");

          return $dlg;
        });
      }
      p = htmls[html_url];
    }

    return p.then($dlg => {
      const id = $dlg.data("id");
      if (!(id in classes)) {
        //if (this.debug) this.debug(`Require ${id}`);
        console.log(import.meta.url);
        return import(`./${id}.js`)
				.then(mod => {
          const dlgClass = mod[id];
          //if (options.debug) options.debug(`JS for ${id} was loaded`);

          classes[id] = new dlgClass($dlg, options);
          return classes[id];
        })
				.catch(e => {
          console.error(`Error loading ${id}: ${e}`);
          // Don't strictly need a .js
          Serror.assert(`Missing dialog ${id}.js`);
        });
      }

      return classes[id];
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
    .then(dlg => {
      dlg.options = $.extend(dlg.options, options);
      dlg.$dlg.dialog("open");
      return dlg.wait();
    });
  }

  /**
   * Promise to wait for a dialog that was opened using Dialog.open to
   * be closed (e.g.
   * Dialog.open("ThingDialog").then(dlg => {
   *    return dlg.wait();
   * })
   * .then(dlg => { if (dlg.wasOked()) ... });
   * @return {Promise} resolves to the Dialog object when
   * the dialog is closed.
   */
  wait() {
    //this.$dlg.parent().find(".ui-dialog-titlebar>button").hide();
    return new Promise((resolve, reject) => {
      this._resolve = resolve;
      this._reject = reject;
    });
  }

  _initialise() {
		const $title = this.$dlg.parent().find(".ui-dialog-title");

    this.initialise();

    // On devices with touch capability, hovering over an element
    // to see the tooltip doesn't work. So on these devices we
    // open the title in a dialog.
    if ($.support.touch) {
      this.$dlg.find(".tooltip-twisty").each((i, el) => {
        const $this = $(el);
        const $div = $("<div data-open='ui-icon-info'></div>");
        $div.addClass("twisted");
        $div.text($.i18n($this.attr("title")));
        $this.after($div);
      });

      // If an element has the tooltip-bequeath class, copy the
      // title down to the elements and add the tooltip-dialog
			// class so they get an info button
      this.$dlg.find(".tooltip-bequeath").each((i, el) => {
        const $el = $(el);
        const text = $el.attr("title");
        $el
				.removeClass("tooltip-bequeath")
        .children()
				.each((j, kid) => {
          $(kid)
          .attr("title", $.i18n(text))
          .data("i18n", text);
        });
      });

			const info = $.i18n("Information");
      this.$dlg
			.find(".tooltip-dialog")
			.each((i, dlg) => {
        const $this = $(dlg);
        $("<button data-icon='ui-icon-info'></button>")
        .insertAfter($this)
        .icon_button()
        .on(Dialog.tapEvent(), () =>
            Dialog.confirm("AlertDialog", {
              title: info,
              alert: $this.attr("title")
            }));
      });
    }
    
    this.$dlg.find(".template").template();
    this.$dlg.find(".twisted").twisted();
    this.$dlg.find("button").icon_button();

    // Add handler to default OK control
    const $ok = this.$control("ok", true);
    if ($ok) {
      $ok.on(Dialog.tapEvent(), () => {
        this._result = true;
        this._oked = true;
        this._result = this.onOK();
        this.close();
      });
    }
    
    const $cancel = this.$control("cancel", true);
    if ($cancel)
      $cancel.on(Dialog.tapEvent(), () => {
        this._result = false;
        this._oked = false;
        this.close();
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
  onOpened() {
  }

  /**
   * Override in subclasses for actions when the dialog is
	 * closed
   */
  onClosed() {
  }

  /**
   * Override in subclasses to change behavior when OK button
   * is clicked.
   * @return {object} return value, or undefined to cancel the close.
	 * Default is to return `true`.
   */
  onOK() {
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
  $control(key, mayBeMissing) {
    const $el = $(`[data-id='${key}']`, this.$dlg);
    if (this.debug && $el.length === 0 && !mayBeMissing) {
      this.debug("Unknown control", key);
      throw new Serror(500, `Unknown control ${key}`);
    }
    return $el;
  }

  /**
   * Service for subclasses.
   * Get the tap event
   */
  static tapEvent() {
    return "click";
  }

  /**
   * Service for subclasses.
   * Get the double-tap event
	 * @return {string} either `doubletap` or `dblclick`
   */
  static doubleTapEvent() {
    return "dblclick";
  }

  /**
   * Service for subclasses.
   * Close the dialog
   */
  close() {
    this.$dlg.dialog("close");
  }
}

export { Dialog }
