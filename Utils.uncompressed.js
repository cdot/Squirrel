/* Copyright (C) 2015 Crawford Currie http://c-dot.co.uk / MIT */

/**
 * Utilities and plugins used by Squirrel
 */

/*
 * Symbol defined to be false when UglifyJS minimises code modules, causing
 * debug code to become unreachable. DEBUG cannot be used in this file, as
 * this declaration overrides the UglifyJS --define
 */
const DEBUG = true;

/**
 * Plugin to generate taphold events on platforms that don't
 * natively support them
 */
$.fn.linger = function() {
    "use strict";

    var eventType = {
        mousedown: "ontouchstart" in window ? "touchstart" : "mousedown",
        mouseup: "ontouchend" in window ? "touchend" : "mouseup"
    };

    return this.each(function() {
        var timeout;
        $(this)
            .on(eventType.mousedown + ".linger", function(e) {
                timeout = window.setTimeout(function() {
                    $(e.currentTarget).trigger("taphold");
                }, 1000);
                return false; // stop bubble
            })
            .on(eventType.mouseup + ".linger", function(/*evt*/) {
                window.clearTimeout(timeout);
            })
            .on(eventType.click + ".linger", function(/*evt*/) {
                window.clearTimeout(timeout);
            })
            .on("contextmenu.linger", function(/*evt*/) {
                window.clearTimeout(timeout);
            });
    });
};

/**
 * Scroll the view to this element
 */
$.fn.scroll_into_view = function () {
    "use strict";

    return this.each(function () {
        var offset = $(this).offset().top - $(window).scrollTop();

        if (offset > window.innerHeight){
            // Not in view so scroll to it
            $('html,body').animate({scrollTop: offset - 16}, 500);
            return false;
        }
        return true;
    });
};

/**
 * Simple in-place editing
 */
$.fn.edit_in_place = function(opts) {
    "use strict";

    return this.each(function() {

        var $self = $(this);
        var h = opts.height || $self.height();
        var w = opts.width || $self.width();
        var changed = opts.changed ||
            function(text) {
                $self.text();
            };
        var $input = $("<input/>"),
        blurb = function() {
            $input.remove();
            $self.show();
        };

        $self.hide();

        $input
            .insertBefore($self)
            .addClass("in_place_editor")
            .val($self.text())
            .css("height", h)
            .css("width", w)

            .change(function() {
                var val = $(this).val();
                blurb();
                if (val !== $self.text())
                    changed.call($self, val);
            })

            .mouseup(function(e) {
                // Override the parent click handler
                e.stopPropagation();
            })

            .mousedown(function(e) {
                // Override the parent click handler
                e.stopPropagation();
            })

            .keydown(function(e) { // Escape means cancel
                if (e.keyCode === 27)
                    blurb();
            })

            .blur(blurb)
            .select();
    });
};

/**
 * Shorthand for $el.off(event).one(event, handler)
 * Useful when the handler uses closure variables
 */
$.fn.reon = function(event, handler) {
    "use strict";

    return this.each(function() {
        $(this).off(event).on(event, handler);
    });
};

var Utils = {}; // Namespace

/**
 * Generate a new password subject to constraints:
 * length: length of password
 * charset: characters legal in the password. Ranges can be defined using
 * A-Z syntax.
 */
Utils.generate_password = function(constraints) {
    "use strict";

    var sor, eor;

    if (typeof constraints.length === "undefined")
        constraints.length = 24;

    if (typeof constraints.charset === "undefined")
        constraints.charset = "A-Za-z0-9";

    var cs = constraints.charset;
    var legal = [];
    while (cs.length > 0) {
        if (cs.length >= 3 && cs.charAt(1) === "-") {
            sor = cs.charCodeAt(0);
            eor = cs.charCodeAt(2);
            cs = cs.substring(3);
            while (sor <= eor) {
                legal.push(String.fromCharCode(sor++));
            }
        } else {
            legal.push(cs.charAt(0));
            cs = cs.substring(1);
        }
    }
    var array = new Uint8Array(constraints.length);
    window.crypto.getRandomValues(array);
    var s = "";
    for (var i = 0; i < constraints.length; i++) {
        s += legal[array[i] % legal.length];
    }
    return s;
};

/**
 * Escape meta-characters for use in CSS selectors
Utils.escape_selector = function(s) {
    "use strict";

    return s.replace(/([\][!"#$%&'()*+,.\/:;<=>?@\\^`{|}~])/g, "\\$1");
};
*/

/**
 * Get the value of a URL parameter
Utils.getURLParameter = function(name) {
    var re = new RegExp('[?|&]' + name + '=' + '([^&;]+?)(&|#|;|$)');
    var hits = re.exec(location.search) || [,""];
    return decodeURIComponent(hits[1].replace(/\+/g, '%20'))
        || null;
}
*/

/**
 * Convert an arbitrary string to a legal HTTP fragment name
 */
Utils.fragmentify = function(fid) {
    "use strict";

    return fid.replace(/[^A-Za-z0-9:]/g, function(m) {
        return "_" + m.charCodeAt(0);
    });
};
