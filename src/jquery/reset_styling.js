/*@preserve Copyright (C) 2017 Crawford Currie http://c-dot.co.uk license MIT*/
/* eslint-env browser,jquery */

define(["jquery", "js/RGBA", "jquery-ui"], function($, RGBA) {

    /**
     * Plugin to reset custom styling for a new UI theme, by finding all
     * font, color and background-color settings currently set in the UI
     * theme for dialogs, then recolouring our custom styles to achieve
     * the same look.
     */

    $.reset_styling = function () {

        // Copy subset of ui-widget styling into base by instantiating
        // a widget element then creating a new <style> with the required
        // attributes applied to body{}
        let $body = $("body");
        // See if the body is currently light
        let bgcol = $body.css("background-color");
        let is_light; // are we using light colours

        if (!bgcol || bgcol === "transparent" ||
            bgcol === "inherit" || bgcol === "initial")
            // Really there's no way to determine, but make a guess
            is_light = false;
        else
            is_light = (new RGBA(bgcol)
                        .luma() < 0.65);

        // Make a div with UI widget styles
        let $el = $(document.createElement("div"))
            .addClass("ui-widget")
            .addClass("ui-widget-content")
            .hide();
        $body.append($el);

        // Extract the key elements of the theme in the widget
        bgcol = $el.css("background-color");
        let style = "body {";
        for (let attr in {
            "font": 0,
            "color": 0,
            "background-color": 0
        }) {
            let av = $el.css(attr);
            style += attr + ": " + av + ";\n";
        }
        style += "}";
        $el.remove();

        // Do we need light highlights in user classes?
        let need_light;
        if (!bgcol || bgcol === "transparent" || bgcol === "initial" ||
            bgcol === "inherit")
            need_light = is_light;
        else
            need_light = (new RGBA(bgcol)
                          .luma() < 0.65);

        if (is_light && !need_light || !is_light && need_light) {
            // Invert colours. In theory only local stylesheets can be
            // found this way. Stylesheets loading from other domains
            // (i.e. CDNs) are not local. However that's not always
            // the case....
            for (let i = 0; i < document.styleSheets.length; i++) {
                let sheet = document.styleSheets[i];
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
                for (let j = 0; j < rules.length; j++) {
                    let rule = rules[j];
                    if (/\.[-:a-z0-9]*$/i.test(rule.selectorText)) {
                        // Class definition
                        let s = "",
                            a;
                        if (rule.style.color) {
                            try {
                                a = new RGBA(rule.style.color);
                                s += "color: " +
                                    a.inverse()
                                    .toString() + ";\n"
                            } catch (e) {
                                if (this.debug) this.debug(e);
                            }
                        }
                        if (rule.style.backgroundColor) {
                            try {
                                a = new RGBA(
                                    rule.style.backgroundColor);
                                s += "background-color: " +
                                    a.inverse()
                                    .toString() + ";\n"
                            } catch (e) {
                                if (this.debug) this.debug(e + ":" + rule.style.backgroundColor);
                            }
                        }
                        if (s.length > 0)
                            style += rule.selectorText + "{" + s + "}\n";
                    }
                }
            }
        }

        $("#computed-styles")
            .remove();
        let $style = $(document.createElement("style"))
            .attr("id", "computed-styles")
            .text(style);
        $body.append($style);
    }
});
