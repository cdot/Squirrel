/*@preserve Copyright (C) 2017 Crawford Currie http://c-dot.co.uk license MIT*/

/* eslint-env jquery */

/**
 * Supports two simple styles of template expansion.
 *
 * For simple expansion, a call to $el.template("expand", ...)
 * will expand $1..$N in the template's HTML.
 *
 * For a pick, a container that has class "pick-one" has one or more
 * children each with a unique data-id. A call of $el.template("pick",
 * id) will show the child with matching data-id and return it.
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

(function($) {

    "use strict";

    $.widget("squirrel.template", {
        _create: function() {
            if (this.element.hasClass("pick-one")) {
                // Nothing picked yet, show the first
                this.element.children().hide().first().show();
            }
        },

        pick: function(id) {
            this.element.children().hide();
            var $picked = this.element.children("[data-id='" + id + "']");
            $picked.show();
            return $picked;
        },
        
        expand: function() {
            var tmpl = this.element.data("raw-template");
            if (!tmpl)
                this.element.data(
                    "raw-template", tmpl = this.element.html());
            var args;
            if (typeof arguments[0] === "object")
                args = arguments[0];
            else
                args = arguments;
            tmpl = tmpl.replace(/\$(\d+)/g, function(m, p1) {
                var i = parseInt(p1);
                return args[i - 1];
            })
            this.element.html(tmpl);
        }
    });
})(jQuery);
