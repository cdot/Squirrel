/*@preserve Copyright (C) 2017 Crawford Currie http://c-dot.co.uk license MIT*/

/* eslint-env jquery */

/* global RGBA */
/* global global:true */

/**
 * Plugin to reset custom styling for a new UI theme, by finding all
 * font, color and background-color settings currently set in the UI
 * theme for dialogs, then recolouring our custom styles to achieve
 * the same look.
 */
(function ($) {

    "use strict";

    $.reset_styling = function () {

        // Copy subset of ui-widget styling into base by instantiating
        // a widget element then creating a new <style> with the required
        // attributes applied to body{}
        var $body = $("body");
        // See if the body is currently light
        var bgcol = $body.css("background-color");
        var is_light; // are we using light colours

        if (!bgcol || bgcol === "transparent" ||
            bgcol === "inherit" || bgcol === "initial")
            // Really there's no way to determine, but make a guess
            is_light = false;
        else
            is_light = (new RGBA(bgcol)
                .luma() < 0.65);

        // Make a div with UI widget styles
        var $el = $(document.createElement("div"))
            .addClass("ui-widget")
            .addClass("ui-widget-content")
            .hide();
        $body.append($el);

        // Extract the key elements of the theme in the widget
        bgcol = $el.css("background-color");
        var style = "body {";
        for (var attr in {
                "font": 0,
                "color": 0,
                "background-color": 0
            }) {
            var av = $el.css(attr);
            style += attr + ": " + av + ";\n";
        }
        style += "}";
        $el.remove();

        // Do we need light highlights in user classes?
        var need_light;
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
            for (var i = 0; i < document.styleSheets.length; i++) {
                var sheet = document.styleSheets[i];
                if (!sheet)
                    continue;
                var rules;
                try {
                    rules = sheet.rules || sheet.cssRules;
                } catch (e) {
                    // Probably a SecurityException on a CDN stylesheet.
                    // Ignore it and continue
                }
                if (!rules)
                    continue;
                for (var j = 0; j < rules.length; j++) {
                    var rule = rules[j];
                    if (/\.[-:a-z0-9]*$/i.test(rule.selectorText)) {
                        // Class definition
                        var s = "",
                            a;
                        if (rule.style.color) {
                            try {
                                a = new RGBA(rule.style.color);
                                s += "color: " +
                                    a.inverse()
                                    .toString() + ";\n"
                            } catch (e) {
                                if (global.DEBUG) console.log(e);
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
                                if (global.DEBUG) console.log(e + ":" + rule.style.backgroundColor);
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
        var $style = $(document.createElement("style"))
            .attr("id", "computed-styles")
            .text(style);
        $body.append($style);
    }
})(jQuery);