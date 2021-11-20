/*@preserve Copyright (C) 2017 Crawford Currie http://c-dot.co.uk license MIT*/
/* eslint-env browser,jquery */

define("js/jq/styling", [
	"js/RGBA", "js-cookie", "jquery", "jquery-ui"
], (RGBA, Cookies) => {

    /**
     * JQuery plugin to manage custom styling for a UI theme.
	 * Styling is controlled through use of a `link` tag that has
	 * id `jQueryTheme`. Styling is initialised by reading the `ui_theme`
	 * cookie for the name of a jquery-ui theme, that is then used to
	 * edit the `jQueryTheme` link to reload the stylesheets. On reset,
	 * all stylesheets are scanned to extract tags with `.inherit_*` classes.
	 * The styling from the imported theme stylesheet is then pushed onto
	 * those tags.
	 *
	 * Also supports is body font scaling, using $.scale to set a pixel font
	 * size globally.
	 * @namespace $.styling
     */
    $.styling = {

        /**
         * Initialise styling according to options drawn from an
         * options block or, failing that, Cookies
         * @param options { theme, scale
         */
         init: options => {
             options = options || {};

             options.theme = options.theme || Cookies.get("ui_theme");

             if (options.theme && options.theme !== "base")
                 $.styling.theme(options.theme);

             options.scale = options.scale || Cookies.get("ui_scale");

             if (options.scale && options.scale > 0)
                 $.styling.scale(options.scale);

			 $.styling._resetOnLoad($("#jQueryTheme").attr("href"));
        },

		// Many browsers don't support onlod on the link element
		// - see https://pie.gd/test/script-link-events/ so
		// we need an alternative.
		_resetOnLoad: (href) => {
			// We would like to use:
			// $("#jQueryTheme").on("load", () => $.styling.reset());
			// but it doesn't work. So, muddy boots, lead the CSS into an
			// IMG tag. This will throw an error, but at least give
			// us an idea that the stylesheet has been loaded.
			const $img = $(`<img src="${href}" />`);
			$("body").append($img);
			$img.on("error", () => {
				$img.remove();
				$.styling.reset();
            });
		},
		
        /**
         * Reset the theme by finding all font, color and
         * background-color settings currently set in the theme for
         * dialogs, then recolouring our custom styles to achieve the
         * same look.
         */
        reset: () => {
			console.debug("Resetting styling");
            const styles = [];
			// Temporary element used to extract styling
            const $picker = $("<div></div>");
            $("body").append($picker);

            // In theory, only local stylesheets can be
            // found this way. Stylesheets loading from other domains
            // (i.e. CDNs) are not local. However that's not always
            // the case! This works, at least in Chrome and Firefox.
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
					// Not able to get rules, possible because they
					// are "external"?
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

		/**
		 * Change the theme.
		 * @param {string} theme name, e.g. swanky-purse. This is one of the
		 * predefined themes in the theme library you are using (set by an
		 * HTML `link` element, with `id="jQueryTheme"`)
		 * @return {string} the theme name
		 */
        theme: theme => {
            if (typeof theme !== 'undefined') {
                let promise;
                $("#jQueryTheme")
                .each(function () {
                    this.href = this.href.replace(
                        /\/themes\/[^/]+/, `/themes/${theme}`);
					$.styling._resetOnLoad(this.href);
                });

                if (theme === "base")
                    Cookies.remove("ui_theme");
				else {
                    Cookies.set("ui_theme", theme, {
                        expires: 365,
						sameSite: "strict"
                    });
                }
            }
            return Cookies.get("ui_theme");
        },

		/**
		 * Getter/setter for the body font size.
		 * @param {number=} scale font size in pixels (px) - must be > 6
		 * or it will be ignored. 
		 * @return {number} the (new) scale
		 */
        scale: scale => {
            let now = $("body").css("font-size").replace(/px/, "");
            if (typeof scale !== 'undefined' && scale > 6) {
                now = scale;
                $("body").css("font-size", `${scale}px`);
                Cookies.set("ui_scale", scale, {
                    expires: 365,
					sameSite: "strict"
                });
            }
            return now;
        }
    };
});
