/* Copyright (C) 2015 Crawford Currie http://c-dot.co.uk / MIT */

/**
 * Utilities and plugins used by Squirrel
 */

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
 * A wrapper for a file input that replaces it with a button that
 * uses the input's title attribute for its label
 */
$.fn.file_input = function() {
    "use strict";

    return this.each(function() {
        var $self = $(this)
            .wrap($("<div></div>")
                  /*.css("position", "relative")
                  .css("display", "inline-block")*/);
        $self.hide();
        $self.parent().append(
            $("<button></button>")
                .button({
                    label: $self.attr("title")
                })
                .click(function(evt) {
                    $self.trigger(evt);
                }));
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
            $("html,body").animate({scrollTop: offset - 16}, 500);
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
            function(/*text*/) {
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

var Utils = { // Namespace
    waiting: {},
    // By setting the wait_timeout to a non-null value we block
    // the wait queue until Utils.sometime is called the first time.
    // This lets us complete the load without too much noise.
    wait_timeout: true,

    last_yield: Date.now()
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
    "use strict";

    //var store = this;
    var reader = new FileReader();
    reader.onload = function(/*evt*/) {
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

/**
 * Convert base64/URLEncoded data component to a Blob
 * http://stackoverflow.com/questions/4998908/convert-data-uri-to-file-then-append-to-formdata
 */
Utils.dataURItoBlob = function(dataURI) {
    // doesn't handle URLEncoded DataURIs - see SO answer
    // #6850276 for code that does this
    var byteString = atob(dataURI.split(',')[1]);

    // separate out the mime component
    var mimeString = dataURI.split(',')[0].split(':')[1].split(';')[0]

    // write the bytes of the string to an ArrayBuffer
    var ab = new ArrayBuffer(byteString.length);
    var ia = new Uint8Array(ab);
    for (var i = 0; i < byteString.length; i++) {
        ia[i] = byteString.charCodeAt(i);
    }

    // write the ArrayBuffer to a blob
    return new Blob([ia], {type: mimeString});
}

 Utils.uint6ToB64 = function(nUint6) {
     return nUint6 < 26 ?
         nUint6 + 65
         : nUint6 < 52 ?
         nUint6 + 71
         : nUint6 < 62 ?
         nUint6 - 4
         : nUint6 === 62 ?
         43
         : nUint6 === 63 ?
         47
         :
         65;
 };

/*
 * Base64 encoding of the content of an array buffer containing bytes
 */
Utils.ArrayBufferTo64 = function(ab) {
    var aBytes = new Uint8Array(ab);
    var nMod3 = 2;
    var sB64Enc = "";
    var nLen = aBytes.length;

    for (var nUint24 = 0, nIdx = 0; nIdx < nLen; nIdx++) {
        nMod3 = nIdx % 3;
        if (nIdx > 0 && (nIdx * 4 / 3) % 76 === 0)
            sB64Enc += "\r\n";
        nUint24 |= aBytes[nIdx] << (16 >>> nMod3 & 24);
        if (nMod3 === 2 || nLen - nIdx === 1) {
            sB64Enc += String.fromCharCode(
                Utils.uint6ToB64(nUint24 >>> 18 & 63),
                Utils.uint6ToB64(nUint24 >>> 12 & 63),
                Utils.uint6ToB64(nUint24 >>> 6 & 63),
                Utils.uint6ToB64(nUint24 & 63));
            nUint24 = 0;
        }
    }

    return sB64Enc.substr(0, sB64Enc.length - 2 + nMod3)
        + (nMod3 === 2 ? '' : nMod3 === 1 ? '=' : '==');
}

/*
 * Base64 encoding of the content of a string containing bytes
 */
Utils.StringTo64 = function(str) {
    var nMod3 = 2;
    var sB64Enc = "";
    var nLen = str.length;

    for (var nUint24 = 0, nIdx = 0; nIdx < nLen; nIdx++) {
        nMod3 = nIdx % 3;
        if (nIdx > 0 && (nIdx * 4 / 3) % 76 === 0)
            sB64Enc += "\r\n";
        nUint24 |= str.charCodeAt(nIdx) << (16 >>> nMod3 & 24);
        if (nMod3 === 2 || nLen - nIdx === 1) {
            sB64Enc += String.fromCharCode(
                Utils.uint6ToB64(nUint24 >>> 18 & 63),
                Utils.uint6ToB64(nUint24 >>> 12 & 63),
                Utils.uint6ToB64(nUint24 >>> 6 & 63),
                Utils.uint6ToB64(nUint24 & 63));
            nUint24 = 0;
        }
    }

    return sB64Enc.substr(0, sB64Enc.length - 2 + nMod3)
        + (nMod3 === 2 ? '' : nMod3 === 1 ? '=' : '==');
}
