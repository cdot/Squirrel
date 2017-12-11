/*@preserve Copyright (C) 2017 Crawford Currie http://c-dot.co.uk license MIT*/

/* eslint-env jquery */
/* global Utils:true */

/**
 * Supports two simple styles of template expansion.
 *
 * For simple expansion, a call to $el.template("expand", ...)
 *
 * For a pick, a container that has class "pick-one" has one or more
 * children each with a unique data-id. A call of $el.template("pick",
 * id) will show the child with matching data-id and return it.
 *
 * Expansion of arguments to "expand" is done using Utils.expandTemplate
 *
 * You can chain the calls e.g.
 * ```
 * <p class="template pick-one">
 *   <p data-id="sex" class="template">
 *     $1 enjoys sex
 *   </p>
 *   <p data-id="drugs" class="template">
 *     $1 doesn't use drugs
 *   </p>
 * </p>
 *
 * $el.template("pick", "sex").template("expand", "Everyone")
 * ```
 * Note: always "pick" before you "expand".
 *
 * Classes used:
 * .pick-one
 *
 * data- used:
 * raw-template - records the unexpanded template
 */

if (typeof module !== "undefined")
    Utils = require("./Utils");

(function ($) {

    "use strict";

    $.widget("squirrel.template", {
        _create: function () {
            if (this.element.hasClass("pick-one")) {
                // Nothing picked yet, show the first
                this.element.children()
                    .hide()
                    .first()
                    .show();
            }
        },

        pick: function (id) {
            this.element.children()
                .hide();
            var $picked = this.element.children("[data-id='" + id + "']");
            $picked.show();
            return $picked;
        },

        expand: function () {
            var tmpl = this.element.data("raw-template");
            if (!tmpl)
                this.element.data(
                    "raw-template", tmpl = this.element.html());

            var args = [tmpl];
            // can't use concat() with an Arguments object :-(
            for (var i = 0; i < arguments.length; i++)
                args.push(arguments[i]);
            tmpl = Utils.expandTemplate.apply(null, args);

            this.element.html(tmpl);
        }
    });
})(jQuery);