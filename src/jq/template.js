/*@preserve Copyright (C) 2017-2023 Crawford Currie http://c-dot.co.uk license MIT*/
/* eslint-env browser,jquery */

import "jquery";
import "jquery-ui";
import "./i18n.js";

/**
 * JQuery-ui widget that supports two simple styles of template expansion,
 * `expand` and `pick`. See the function descriptions below for details.
 *
 * Note you can chain the calls e.g.
 * ```
 * $el.template("pick", "sex").template("expand", "Everyone")
 * ```
 * Note: always `pick` before you `expand`.
 *
 * Classes used:
 * * `.pick-one` - used to set the initial state
 *
 * `data-` attributes used:
 * * `raw-template` - records the unexpanded template
 * @namespace squirrel.template
 */
$.widget("squirrel.template", {

  _create: function () {
    if (this.element.hasClass("pick-one")) {
      // Nothing picked yet, show the first
      this.element.children("[data-id]")
      .hide()
      .first()
      .show();
    }
  },

	/**
	 * A container that has class `pick-one` has one or more
	 * children each with a unique `data-id`. A call of
	 *  `$el.template("pick", id)` will find the child with
	 * matching `data-id` and show it, hiding all other child node.
	 * Example HTML:
	 * ```
	 * <span id="conk" class="pick-one">
	 * Your nose is
	 *   <span data-id="big" class="template">Ginormous</span>
	 *   <span data-id="small" class="template">Titchy</span>
	 * </span>
	 * ```
	 * Example JS:
	 * ```
	 * $("#conk").template(); // initialise
	 * ...
	 * $("#conk").template("pick", "big");
	 * ```
	 * @name squirrel.template#pick
	 * @function
	 * @param {string} id the `data-id` of the child to pick
	 * @return {jQuery} the selected child
	 */
  pick: function (id) {
    this.element.children("[data-id]").hide();
    const $picked = this.element.children(`[data-id='${id}']`);
    $picked.show();
    return $picked;
  },

	/**
	 * Expand a template passing arguments for the expansion.
	 * Example HTML:
	 * ```
	 * <span id="gender"">$1 is $2</span>
	 * ```
	 * Example JS:
	 * ```
	 * $("#gender").template("expand", "Tony", "uncertain");
	 * ```
	 * Expansion of arguments to is done using $.i18n
   *
   * Alternatively:
	 * ```
	 * <span id="gender" data-i18n-template="$1 is $2"></span>
	 * ```
	 * {@link Utils.expandTemplate}
	 * @name squirrel.template#expand
	 * @function
	 */
  expand: function () {
    const tmpl = this.element.data("raw-template")
          || this.element.data("i18n-template")
          || this.element.html();
    this.element.data("raw-template", tmpl);
    let args = [tmpl];
    // can't use concat() with an Arguments object :-(
    for (let i = 0; i < arguments.length; i++)
      args.push(arguments[i]);
    const expansion = $.i18n.apply($, args);
    this.element.html(expansion);
  }
});
