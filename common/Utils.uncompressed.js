/*@preserve Copyright (C) 2015 Crawford Currie http://c-dot.co.uk license MIT*/

/**
 * Utilities and plugins used by Squirrel
 */

/**
 * Needed to be able to read binary files.
 * http://www.henryalgus.com/reading-binary-files-using-jquery-ajax/
*/
$.ajaxTransport("+binary", function(options, originalOptions, jqXHR){
    "use strict";

    // check for conditions and support for blob / arraybuffer response type
    if (window.FormData
        && ((options.dataType && (options.dataType === "binary"))
            || (options.data
                && ((window.ArrayBuffer && options.data instanceof ArrayBuffer)
                    || (window.Blob && options.data instanceof Blob)))))
    {
        return {
            // create new XMLHttpRequest
            send: function(headers, callback){
		// setup all variables
                var xhr = new XMLHttpRequest(),
		url = options.url,
		type = options.type,
		async = options.async || true,
		// blob or arraybuffer. Default is blob
		dataType = options.responseType || "blob",
		data = options.data || null,
		username = options.username || null,
		password = options.password || null;
					
                xhr.addEventListener("load", function(){
			var data2 = {};
			data2[options.dataType] = xhr.response;
			// make callback and send data
			callback(xhr.status, xhr.statusText,
                                 data2, xhr.getAllResponseHeaders());
                });
 
                xhr.open(type, url, async, username, password);
				
		// setup custom headers
		for (var i in headers ) {
			xhr.setRequestHeader(i, headers[i] );
		}
				
                xhr.responseType = dataType;
                xhr.send(data);
            },
            abort: function(){
                jqXHR.abort();
            }
        };
    }
});

var Utils = { // Namespace
    // Hash of events that are waiting to be triggered by the 'sometime'
    // scheduler.
    waiting_for_sometime: {},

    // By setting the sometime_timeout to a non-null value we block
    // the wait queue until Utils.sometime_is_now is called the first time.
    // This lets us complete the load without too much noise.
    sometime_timeout: true,

    // Set by the 'sometime' scheduler, the 'soon' scheduler, and
    // the 'execute_queue' sequencer to record when the last time we
    // had a timeout event, indicating that the UI has had a timeslice.
    // Used by 'soon' to control how often we yield to the UI before
    // calling the managed function (we don't want to yield unless we
    // really have to)
    last_yield: Date.now(),

    // Timeout intervals, milliseconds
    IMMEDIATE: 1,
    SOON: 100,
    SOMETIME: 250
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
 * Get the URL parameters
 * @return a hash mapping parameter name to decoded value
 */
Utils.getURLParameters = function() {
    "use strict";

    var params = {};
    var bits = location.search.split("?", 2);
    if (bits.length < 2)
        return params;
    var pairs = bits[1].split(/[&;]/);
    for (var i = 0; i < pairs.length; i++) {
        var pair = decodeURIComponent(pairs[i].replace(/\+/g, "%20"));
        var kv = pair.split("=", 2);
        params[kv[0]] = (kv[1] || null);
    }
};

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

    //console.debug("...queue sometime " + event);
    if (Utils.waiting_for_sometime[event]) {
        //console.debug("......already waiting");
        return;
    }

    Utils.waiting_for_sometime[event] = true;
    if (Utils.sometime_timeout === null) {
        //console.debug("......set timeout");
        Utils.sometime_timeout = window.setTimeout(
            Utils.sometime_is_now, Utils.SOMETIME);
    }
};

/**
 * Execute the events that have been waiting for 'sometime'
 */
Utils.sometime_is_now = function() {
    "use strict";

    Utils.sometime_timeout = null;
    Utils.last_yield = Date.now();
    for (var event in Utils.waiting_for_sometime) {
        // Triggering these handlers may take an appreciable amount of
        // time and result in new events joining the sometime schedule.
        //console.debug("...sometime for " + event + " is now");
        $(document).triggerHandler(event);
        // Only now delete the event to allow it to be requeued
        delete Utils.waiting_for_sometime[event];
    }
};

/**
 * Allow the UI to have a slice of time before we call the given function,
 * but only if it's been a perceptible amount of time (>100ms) since the
 * last UI update. This is used when chaining sequences of function calls.
 * Note that it is potentially recursive - if you have a rapid sequence
 * of actions to handle, don't use soon to sequence them or you might blow
 * the stack. Use execute_queue instead, which is non-recursive.
 * @param fn function to call
 */
Utils.soon = function(fn) {
    "use strict";

    // If it's been a decent amount of time since the last time
    // we yielded to the UI, then set an asynchronous timeout before
    // we activate the next function in the chain. This will allow
    // the UI a timeslice.
    if (Date.now() - Utils.last_yield > Utils.SOON) {
        window.setTimeout(function() {
            Utils.last_yield = Date.now();
            //console.debug("soon is now");
            fn();
        }, Utils.IMMEDIATE);
    } else {
        //console.debug("soon is immediate");
        fn();
    }
};

/**
 * Execute each function in the queue, and continue until empty.
 * Execution will not continue until the function being executed has
 * called ready()". The last function in the queue doesn't need to call
 * ready(), as the queue will then be empty.
 */
Utils.execute_queue = function(q) {
    "use strict";

    Utils.q_ready();
    Utils.q_next(q);
};

Utils.q_ready = function() {
    "use strict";

    Utils.qready = true;
};

Utils.q_next = function(q) {
    "use strict";

    if (q.length > 0 && Utils.qready) {
        var fn = q.shift();
        Utils.qready = false;
        fn(Utils.q_ready);
    }

    // Maintain UI performance
    window.setTimeout(function() {
        Utils.last_yield = Date.now();
        Utils.q_next(q);
    }, Utils.IMMEDIATE);
};

/**
 * Convert an ArrayBuffer containing 16-bit character codes into a
 * String.
 * @param data ArrayBuffer which must be an even number of bytes long
 * @return String the string the ArrayBuffer contains
 */
Utils.ArrayBufferToString = function(ab) {
    "use strict";

    if (DEBUG && ab.byteLength % 2 !== 0)
        debugger;
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
    var a8_len = a8.length;
    for (var i = 0; i < a8_len; i++) {
        if (high) {
            ps += String.fromCharCode(cc | a8[i]);
            high = false;
        } else {
            cc = a8[i] << 8;
            high = true;
        }
    }
    // Strings are 16-bit data, so the LSB of the last character may have to
    // be left as 0
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

/**
 * Simple dynamic loader. Won't work with file:// URLs or cross-origin.
 * Load a list of resources - .js, .css or .html. JS gets loaded and
 * executes, CSS gets loaded using <link>, HTML gets loaded and appended
 * to the document body.
 * @param libs list of resources
 * @param on_loaded is called when all libs have been loaded
 */
Utils.load = function(libs, on_loaded) {
    "use strict";
    // action when a resource is loaded
    var _loaded = function(file) {
        //console.debug("Loaded " + file);
        delete expect[file];
        if (Object.keys(expect).length === 0) {
            if (typeof on_loaded === "function") {
                //console.debug("Calling on_loaded");
                on_loaded();
            }
        }
        //else console.debug("Still waiting for " + Object.keys(expect));
    };

    // fire off a resource load
    var _add_load = function(file) {
        if (DEBUG)
            file = file.replace(".min.", ".uncompressed.");

        //console.debug("Loading " + file);
        expect[file] = true;
        if (/\.js$/.test(file)) {
            $.getScript(file)
                .done(function() {
                    //console.debug("Loaded script " + file);
                    _loaded(file);
                })
                .fail(function(jqXHR, settings, exception) {
                    debugger;
                });
        } else if (/\.css$/.test(file)) {
            $("link")
                .appendTo("head")
                .attr({ type: "text/css", rel: "stylesheet" })
                .attr("href", file);
            _loaded(file);
        } else if (/\.html$/.test(file)) {
            $.get(file)
                .done(function(data) {
                    //console.debug("Loaded HTML " + file);
                    $(data)
                        .appendTo("body");
                    _loaded(file);
                })
                .fail(function(jqXHR, settings, exception) {
                    debugger;
                });
        }
    };

    var expect = {};
    for (var i = 0; i < libs.length; i++) {
        _add_load(libs[i]);
    }
};

/**
 * Parse the query string, and return a map of key=>value
 */
Utils.query_string = function () {
    "use strict";
    var query = {};
    var vars = window.location.search.substring(1).split(/[&;]+/);
    for (var i = 0; i < vars.length; i++) {
        if (vars[i] === "")
            continue;
        var ass = vars[i].split("=");
        if (typeof query[ass[0]] === "undefined") {
            // If first entry with this name, assign simple string
            query[ass[0]] = decodeURIComponent(ass[1]);
        } else if (typeof query[ass[0]] === "string") {
            // If second entry with this name, make an array
            var arr = [ query[ass[0]], decodeURIComponent(ass[1]) ];
            query[ass[0]] = arr;
        } else {
            // If third or later entry with this name, push it
            query[ass[0]].push(decodeURIComponent(ass[1]));
        }
    } 
    return query;
};

Utils.make_query_string = function(qs) {
    "use strict";
    var params = "";
    var sep = "?";
    for (var k in qs) {
        params += sep + encodeURIComponent(k)
            + "=" + encodeURIComponent(qs[k]);
        sep = "&";
    }
    return params;
};
