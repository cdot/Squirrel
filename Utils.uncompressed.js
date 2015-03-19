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
                if (e.keyCode === 27
                    || (e.keyCode === 13
                        && $(this).val() === $self.text())) {
                    blurb();
                    return false;
                } else
                    return true;
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

$.fn.paste = function(event, handler) {
    "use string";

    return this.each(function() {
        $(this).on("paste", function(e) {
            console.debug("Saw paste event on $(document)");
            Utils.handle_paste(this, e);
        });
    });
};

var Utils = { // Namespace
    waiting: {},
    // By setting the wait_timeout to a non-null value we block
    // the wait queue until Utils.sometime is called the first time.
    // This lets us complete the load without too much noise.
    wait_timeout: true,

    last_yield: Date.now()
};

// The onpaste event has the handle_paste function attached to it, and is
// passed two arguments: this (i.e. a reference to the element that the
// event is attached to) and the event object.
Utils.handle_paste = function(elem, e) {

    if (e && e.clipboardData && e.clipboardData.getData) {
        // Webkit - get data from clipboard, put into elem,
        // cleanup, then cancel event. This prevents webkit
        // pasting anything twice. Webkit is awkward, and won't
        // paste anything if you simply clear elem.
        if (/text\/plain/.test(e.clipboardData.types))
            // Data is already available
            $div.text(e.clipboardData.getData('text/plain'));

        Utils.wait_for_paste_data(elem);

        if (e.preventDefault) {
            e.stopPropagation();
            e.preventDefault();
        }
        return false;
    }
    else {
        // Everything else
        Utils.wait_for_paste_data(elem);
        return true;
    }
};

// This is necessary because the pasted data doesn't appear straight
// away, so if you just called processpaste straight away then it
// wouldn't have any data to process.
//
// What it does is check if the editable div has any content, if it
// does then calls processpaste, otherwise it sets a timer to call
// itself and check again in 20 milliseconds.
Utils.wait_for_pastedata = function(elem, saved_content) {
    if (elem.children().length > 0)
        Utils.process_paste(elem, saved_content);
    else {
        var e = elem;
        var s = saved_content;
        var callself = function () {
            Utils.wait_for_paste_data(that.e, that.s)
        };
        setTimeout(callself, 20);
    }
};

Utils.process_paste = function(elem, saved_content) {
    pasteddata = elem.innerHTML;
    //^^ Alternatively loop through dom (elem.childNodes
    // or elem.getElementsByTagName) here

    elem.innerHTML = saved_content;

    // Do whatever with gathered data;
    alert(pasteddata);
};

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

/**
 * Read a file from disc
 */
Utils.read_file = function(file, ok, fail) {
    var store = this;
    var reader = new FileReader();
    reader.onload = function(evt) {
        ok(reader.result);
    };
    reader.onerror = function() {
	fail(file.name + " read failed");
    };
    reader.onabort = reader.onerror;
    reader.readAsBinaryString(file);
};

/**
 * Simple asynchronous event mechanism to prevent duplicate events.
 * This intended for events that will update the UI, but don't want
 * to be called every time due to the load they impose. Events are always
 * sent using the $(document).triggerHandler()
 * Events queued using sometime will not be fired until the first
 * call to sometime_is_now, and after that at most every 250ms.
 * @param {string} event name
 * @param {Object} target optional target for the event. If not set, the
 * event will be sent to $(document)
 */
Utils.sometime = function(event) {
    "use strict";

    if (Utils.waiting[event])
        return;

    Utils.waiting[event] = true;
    if (Utils.wait_timeout === null)
        Utils.wait_timeout = window.setTimeout(
            Utils.sometime_is_now, 250 /*ms*/);
};

/**
 * Start the sometime sequence
 */
Utils.sometime_is_now = function() {
    "use strict";

    Utils.wait_timeout = null;
    for (var event in Utils.waiting) {
        $(document).triggerHandler(event);
        // Only now delete the event to allow it to be requeued
        delete Utils.waiting[event];
    }
};

/**
 * Allow the UI to have a slice of time before we call the given function,
 * but only if it's been a perceptible amount of time since the last UI
 * update.
 * @param fn function to call
 */
Utils.soon = function(fn) {
    "use strict";

    // If it's been a decent amount of time since the last time
    // we yielded to the UI, then set an asynchronous timeout before
    // we activate the next function in the chain. This will allow
    // the UI a timeslice.
    if (Date.now() - Utils.last_yield > 100 /*ms*/) {
        window.setTimeout(function() {
            Utils.last_yield = Date.now();
            fn();
        }, 1);
    } else
        fn();
};
