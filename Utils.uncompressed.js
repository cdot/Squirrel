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
 * @param file File object to read
 * @param ok callback when file is read, passed an ArrayBuffer
 * containing the file contents
 * @param fail callback on failure
 * @param mode optional read mode, one of "arraybuffer", "binarystring",
 * "datauri" or "text". The default is "text".
 */
Utils.read_file = function(file, ok, fail, mode) {
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
    if (typeof mode === "undefined" || mode === "text")
        reader.readAsText(file);
    else if (mode === "arraybuffer")
        reader.readAsArrayBuffer(file);
    else if (mode === "binarystring")
        reader.readAsBinaryString(file);
    else if (mode === "datauri")
        reader.readAsDataURL(file);
    else
        throw "Unrecognised mode " + mode;
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
 * Execute each function in the queue, and continue until empty.
 * Execution will not continue until the function being executed has
 * called "ready".
 */
Utils.execute_queue = function(q) {
    "use strict";

    var qready = true;
    var qr = function() {
        qready = true;
    };

    while (q.length > 0) {
        if (qready) {
            var fn = q.shift();
            qready = false;
            fn(qr);
        }
    }
};

/**
 * Convert an ArrayBuffer containing 16-bit character codes into a
 * String.
 * @param data ArrayBuffer which must be an even number of bytes long
 * @return String the string the ArrayBuffer contains
 */
Utils.ArrayBufferToString = function(ab) {
    "use strict";

    var a16 = new Uint16Array(ab);
    var str = "";
    for (var i = 0; i < a16.length; i++)
        str += String.fromCharCode(a16[i]);
    return str;
};

/**
 * Convert a String into an ArrayBuffer containing 16 bit character
 * codes.
 * @param str the String to convert
 * @return an ArrayBuffer (which will be an even number of bytes long)
 */
Utils.StringToArrayBuffer = function(str) {
    "use strict";

    var a16 = new Uint16Array(str.length);
    for (var i = 0, strLen = str.length; i < strLen; i++)
        a16[i] = str.charCodeAt(i);
    return a16.buffer;
};

/**
 * Pack arbitrary binary byte data into a String as efficiently
 * as possible.
 * @param data arbitrary byte data to be packed
 * @return a String containing the packed data
 */
Utils.ArrayBufferToPackedString = function(ab) {
    "use strict";

    var a8 = new Uint8Array(ab);
    // Pack 8-bit data into strings using the high and low bytes for
    // successive data. The usb of the first character is reserved
    // for a flag that indicates if the least significant byte of
    // the last character is part of the string or not.
    var cc = ((a8.length & 1) !== 0) ? 0x100 : 0;
    // a8.length == 0, string length = 1, usb = 0
    // a8.length == 1, string length = 1, usb = 1
    // a8.length == 2, string length = 2, usb = 0
    // a8.length == 3, string length = 2, usb = 1
    // a8.length == 4, string length = 3, usb = 0 etc.
    var high = true; // have we just packed the high byte?
    var ps = "";
    for (var i = 0; i < a8.length; i++) {
        if (high) {
            ps += String.fromCharCode(cc | a8[i]);
            high = false;
        } else {
            cc = a8[i] << 8;
            high = true;
        }
    }
    if (high)
        ps += String.fromCharCode(cc);
    return ps;
};

/**
 * Convert a packed string, created using ArrayBufferToPackedString, back
 * into an ArrayBuffer containing an arbitrary number of bytes.
 */
Utils.PackedStringToArrayBuffer = function(str) {
    "use strict";

    var datalen = 2 * str.length - 1;
    if ((str.charCodeAt(0) & 0x100) === 0)
        datalen--;
    var high = true;
    var a8 = new Uint8Array(datalen);
    var i = 0;
    var j = 0;
    while (j < datalen) {
        if (high) {
            a8[j++] |= str.charCodeAt(i++) & 0xFF;
            high = false;
        } else {
            a8[j++] = (str.charCodeAt(i) >> 8) & 0xFF;
            high = true;
        }
    }
    return a8.buffer;
};

/**
 * Convert an ArrayBuffer containing arbitrary byte data into a Base64
 * encoded string, suitable for use in a Data-URI
 * @param ab the ArrayBuffer to convert
 * @return a String of Base64 bytes (using MIME encoding)
 */
Utils.ArrayBufferToBase64 = function(ab) {
    "use strict";

    var a8 = new Uint8Array(ab);
    var nMod3 = 2;
    var sB64Enc = "";
    var nLen = a8.length;

    // Convert a base 64 number to the charcode of the character used to
    // represent it
    var uint6ToB64 = function(nUint6) {
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

    // For each byte in the buffer
    for (var nUint24 = 0, nIdx = 0; nIdx < nLen; nIdx++) {
        nMod3 = nIdx % 3;
        nUint24 |= a8[nIdx] << (16 >>> nMod3 & 24);
        if (nMod3 === 2 || nLen - nIdx === 1) {
            sB64Enc += String.fromCharCode(
                uint6ToB64(nUint24 >>> 18 & 63),
                uint6ToB64(nUint24 >>> 12 & 63),
                uint6ToB64(nUint24 >>> 6 & 63),
                uint6ToB64(nUint24 & 63));
            nUint24 = 0;
        }
    }

    return sB64Enc.substr(0, sB64Enc.length - 2 + nMod3)
        + (nMod3 === 2 ? "" : nMod3 === 1 ? "=" : "==");
};

/**
 * Convert a MIME-Base64 string into an array buffer of arbitrary
 * 8-bit data
 * @param sB64Enc the String to convert
 * @return an ArrayBuffer
 */
Utils.Base64ToArrayBuffer = function(sB64) {
    "use strict";

    var sB64Enc = sB64.replace(/[^A-Za-z0-9\+\/]/g, ""); // == and =
    var nInLen = sB64Enc.length;
    var nOutLen = nInLen * 3 + 1 >> 2;
    var ta8 = new Uint8Array(nOutLen);
    // Convert Base64 char (as char code) to the number represented
    var b64ToUint6 = function(nChr) {
        return nChr > 64 && nChr < 91 ?
            nChr - 65
            : nChr > 96 && nChr < 123 ?
            nChr - 71
            : nChr > 47 && nChr < 58 ?
            nChr + 4
            : nChr === 43 ?
            62
            : nChr === 47 ?
            63
            :
            0;
    };

    for (var nMod3, nMod4, nUint24 = 0, nOutIdx = 0, nInIdx = 0;
         nInIdx < nInLen; nInIdx++) {
        nMod4 = nInIdx & 3;
        nUint24 |= b64ToUint6(sB64Enc.charCodeAt(nInIdx))
            << 6 * (3 - nMod4);
        if (nMod4 === 3 || nInLen - nInIdx === 1) {
            for (nMod3 = 0; nMod3 < 3
                 && nOutIdx < nOutLen; nMod3++, nOutIdx++) {
                ta8[nOutIdx] = nUint24 >>> (16 >>> nMod3 & 24) & 255;
            }
            nUint24 = 0;
        }
    }
    return ta8.buffer;
};
