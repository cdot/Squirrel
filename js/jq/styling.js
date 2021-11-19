/*@preserve Copyright (C) 2017 Crawford Currie http://c-dot.co.uk license MIT*/
/* eslint-env browser,jquery */

define("js/jq/styling", [
	"js/RGBA", "js-cookie", "jquery", "jquery-ui"
], (RGBA, Cookies) => {

    /**
     * Plugin to manage custom styling for a UI theme
     */

    $.styling = {

        /**
         * Initialise styling according to options drawn from an
         * options block or, failing that, Cookies
         * @param options { theme, scale
         */
         init: function(options) {
             options = options || {};

             options.theme = options.theme || Cookies.get("ui_theme");

             if (options.theme && options.theme !== "base")
                 $.styling.theme(options.theme);

             options.scale = options.scale || Cookies.get("ui_scale");

             if (options.scale && options.scale > 0)
                $.styling.scale(options.scale);
        },

        /**
         * Reset the theme by finding all font, color and
         * background-color settings currently set in the theme for
         * dialogs, then recolouring our custom styles to achieve the
         * same look.
         */
        reset: function () {
            const styles = [];
            const $picker = $("<div></div>");
            $("body").append($picker);

            // In theory only local stylesheets can be
            // found this way. Stylesheets loading from other domains
            // (i.e. CDNs) are not local. However that's not always
            // the case....
            for (let sheet of document.styleSheets) {
                if (!sheet)
                    continue;
                let rules;
                try {
                    rules = sheet.rules || sheet.cssRules;
                } catch (e) {
                    // Probably a SecurityException on a CDN stylesheet.
                    // Ignore it and continue
                }
                if (!rules)
                    continue;
                for (let rule of rules) {
                    const m = /(.*)\.inherit_(.*)$/.exec(rule.selectorText);
                    if (m) {
                        const selector = m[1];
                        const superclass = m[2].split('_').join(' ');

                        $picker.addClass(superclass);
                        let s = "";
                        for (let attr of rule.style) {
                            let v;
                            if (rule.style[attr] === "inherit")
                                v = $picker.css(attr);
                            else
                                v = rule.style[attr];
                            s += `${attr}: ${v};`;
                            $(selector).css(attr, v);
                        }
                        $picker.removeClass(superclass);
                        
                        if (s.length > 0)
                            styles.push(`${selector}{${s}}`);
                    }
                }
            }

            $picker.remove();
            $("#computed-styles").remove();
            if (styles.length === 0)
                return;
            const $style = $("style")
                .attr("id", "computed-styles")
                .text(styles.join("\n"));
            $("body").prepend($style);
        },

        theme: function(theme) {
            if (typeof theme !== 'undefined') {
                const promises = [];
                $("#jQueryTheme")
                .each(function () {
                    this.href = this.href.replace(
                        /\/themes\/[^/]+/, `/themes/${theme}`);
                    $(this).replaceWith($(this));
                    // Use the loading of the CSS as an image (which will
                    // trigger an error) to tell us when we can reset the
                    // styling
                    const $img = $("<img />");
                    $img.attr("src", this.href).hide();
                    $("body").append($img);
                    promises.push(new Promise(resolve =>
                        $img.on("error", () => {
                            resolve();
                            $img.remove();
                        })));
                });
                // Allow time for the new style to kick in before
                // resetting the styling
                Promise.all(promises)
                .then(() => $.styling.reset());

                if (theme === "base") {
                    Cookies.remove("ui_theme");
                } else {
                    Cookies.set("ui_theme", theme, {
                        expires: 365,
						samesite: "strict"
                    });
                }
            }
            return Cookies.get("ui_theme");
        },

        scale: function(scale) {
            let now = $("body").css("font-size").replace(/px/, "");
            if (typeof scale !== 'undefined' && scale > 6) { // don't go below 6px
                now = scale;
                $("body").css("font-size", scale + "px");
                Cookies.set("ui_scale", scale, {
                    expires: 365,
					samesite: "strict"
                });
            }
            return now;
        }
    };
});
