/*@preserve Copyright (C) 2015-2017 Crawford Currie http://c-dot.co.uk license MIT*/
/* eslint-env browser,node,jquery */

if (typeof module !== "undefined")
    utf8 = require('utf8');

/**
 * Utilities and plugins used by Squirrel
 */
class Utils {
    /**
     * Needed to be able to read binary files.
     * http://www.henryalgus.com/reading-binary-files-using-jquery-ajax/
     */
    static setUpAjax(options, originalOptions, jqXHR) {
        // check for conditions and support for blob / arraybuffer response type
        if (window.FormData &&
            ((options.dataType && (options.dataType === "binary")) ||
             (options.data &&
              ((window.ArrayBuffer && options.data instanceof ArrayBuffer) ||
               (window.Blob && options.data instanceof Blob))))) {
            return {
                // create new XMLHttpRequest
                send: function (headers, callback) {
                    // setup all letiables
                    let xhr = new XMLHttpRequest(),
                        url = options.url,
                        type = options.type,
                        async = options.async || true,
                        // blob or arraybuffer. Default is blob
                        dataType = options.responseType || "blob",
                        data = options.data || null,
                        username = options.username || null,
                        password = options.password || null;

                    xhr.addEventListener("load", function () {
                        let data2 = {};
                        data2[options.dataType] = xhr.response;
                        // make callback and send data
                        callback(xhr.status, xhr.statusText,
                                 data2, xhr.getAllResponseHeaders());
                    });

                    xhr.open(type, url, async, username, password);

                    // setup custom headers
                    for (let i in headers) {
                        xhr.setRequestHeader(i, headers[i]);
                    }

                    xhr.responseType = dataType;
                    xhr.send(data);
                },
                abort: function () {
                    jqXHR.abort();
                }
            };
        }
    }

    /**
     * Generate a new password subject to constraints:
     * length: length of password
     * charset: characters legal in the password. Ranges can be defined using
     * A-Z syntax.
     */
    static generate_password(constraints) {
        let sor, eor;

        if (typeof constraints.length === "undefined")
            constraints.length = 24;

        if (typeof constraints.charset === "undefined")
            constraints.charset = "A-Za-z0-9";

        let cs = constraints.charset;
        let legal = [];
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
        let array = new Uint8Array(constraints.length);
        window.crypto.getRandomValues(array);
        let s = "";
        for (let i = 0; i < constraints.length; i++) {
            s += legal[array[i] % legal.length];
        }
        return s;
    }

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
    static sometime(event) {
        if (Utils.waiting_for_sometime[event]) {
            return;
        }

        Utils.waiting_for_sometime[event] = true;
        if (Utils.sometime_timeout === null) {
            Utils.sometime_timeout = window.setTimeout(
                Utils.sometime_is_now, Utils.SOMETIME);
        }
    }

    /**
     * Execute the events that have been waiting for 'sometime'
     */
    static sometime_is_now() {
        Utils.sometime_timeout = null;
        Utils.last_yield = Date.now();
        for (let event in Utils.waiting_for_sometime) {
            // Triggering these handlers may take an appreciable amount of
            // time and result in new events joining the sometime schedule.
            $(document)
                .triggerHandler(event);
            // Only now delete the event to allow it to be requeued
            delete Utils.waiting_for_sometime[event];
        }
    }

    /**
     * Allow the UI to have a slice of time before we call the given function,
     * but only if it's been a perceptible amount of time (>100ms) since the
     * last UI update. This is used when chaining sequences of function calls.
     * Note that it is potentially recursive - if you have a rapid sequence
     * of actions to handle, don't use soon to sequence them or you might blow
     * the stack. Use execute_queue instead, which is non-recursive.
     * @param fn function to call
     */
    static soon(fn) {
        // If it's been a decent amount of time since the last time
        // we yielded to the UI, then set an asynchronous timeout before
        // we activate the next function in the chain. This will allow
        // the UI a timeslice.
        if (Date.now() - Utils.last_yield > Utils.SOON) {
            window.setTimeout(function () {
                Utils.last_yield = Date.now();
                fn();
            }, Utils.IMMEDIATE);
        } else {
            fn();
        }
    }

    /**
     * Execute each function in the queue, and continue until empty.
     * Functions must have the signature fn({function}ready)
     * Execution of the next function in the queue will not start until
     * the function being executed has called ready(). The last function
     * in the queue doesn't need to call ready(), as the queue will then
     * be empty. Functions should return as soon as possible to avoid blocking
     * the UI (ready() can be called on an event, for example)
     */
    static execute_queue(q) {
        let qready = true;

        function q_ready() {
            qready = true;
        }

        function q_next(q) {
            if (q.length > 0 && qready) {
                let fn = q.shift();
                qready = false;
                fn(q_ready);
            }

            // Maintain UI performance by timeout in browser
            if (window) {
                window.setTimeout(function () {
                    Utils.last_yield = Date.now();
                    q_next(q);
                }, Utils.IMMEDIATE);
            } else {
                q_next(q);
            }
        }

        q_next(q);
    }

    /**
     * Simple dynamic loader. Won't work with file:// URLs or cross-origin.
     * Load a list of resources - .js, .css or .html. JS gets loaded and
     * executes, CSS gets loaded using <link>, HTML gets loaded and appended
     * to the document body.
     * @param libs list of resources
     * @param onload is called for each file loaded
     * @param onfail is called for each load that failed
     */
    static load(file) {
        // fire off a resource load
        if (/\.css$/.test(file)) {
            $("link")
                .appendTo("head")
                .attr({
                    type: "text/css",
                    rel: "stylesheet"
                })
                .attr("href", file);
            return Promise.resolve();
        } else if (/\.html$/.test(file)) {
            return $.get(file)
                .then(function (data) {
                    $(data)
                        .appendTo("body");
                })
                .fail(function (jqXHR, textStatus, errorThrown) {
                    throw new Error(file + " " + errorThrown);
                });
        } else {
            if (!/\.js$/.test(file))
                file = file + ".js";
            return $.getScript(file)
                .fail(function (jqxhr, settings, exception) {
                    throw new Error(file + " " + exception);
                });
        }
    }

    /**
     * Promise to read a file object. The promise is resolved with
     * an ArrayBuffer containing the file contents.
     * @param file File object to read
     * @param mode optional read mode, one of "arraybuffer", "binarystring",
     * "datauri" or "text". The default is "text".
     */
    static read_file(file, mode) {
        //let store = this;
        return new Promise((resolve, reject) => {
            let reader = new FileReader();
            reader.onload = function ( /*evt*/ ) {
                resolve(reader.result);
            };
            reader.onerror = function () {
                reject(file.name + " read failed");
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
                reject("Unrecognised mode " + mode);
        });
    }

    /**
     * Convert an ArrayBuffer containing UTF-8 encoded string into a
     * String.
     * @param data ArrayBuffer which must be an even number of bytes long
     * @return String the string the ArrayBuffer contains
     */
    static ArrayBufferToString(ab) {
        let a = new Uint8Array(ab);
        let str = '';
        for (let i = 0; i < a.length; i++)
            str += String.fromCodePoint(a[i]);
        return utf8.decode(str);
    }

    /**
     * Convert a String into an ArrayBuffer containing the UTF8 encoded
     * string.
     * @param str the String to convert
     * @return an ArrayBuffer
     */
    static StringToArrayBuffer(str) {
        let u8 = utf8.encode(str);
        let a = new Uint8Array(u8.length);
        for (let i = 0; i < u8.length; i++)
            a[i] = u8.codePointAt(i);
        return a.buffer;
    }

    /**
     * Pack arbitrary binary byte data into a String as efficiently
     * as possible. We limit ourselves to using only 16 bits per character
     * location, so that strings created this way can be further manipulated.
     * @param data arbitrary byte data to be packed
     * @return a String of 16-bit code points containing the packed data
     */
    static ArrayBufferToPackedString(ab) {
        let a8 = new Uint8Array(ab);
        // Pack 8-bit data into strings using the high and low bytes for
        // successive data. The usb of the first character is reserved
        // for a flag that indicates if the least significant byte of
        // the last character is part of the string or not.
        let cc = ((a8.length & 1) !== 0) ? 0x100 : 0;
        // a8.length == 0, string length = 1, usb = 0
        // a8.length == 1, string length = 1, usb = 1
        // a8.length == 2, string length = 2, usb = 0
        // a8.length == 3, string length = 2, usb = 1
        // a8.length == 4, string length = 3, usb = 0 etc.
        let high = true; // have we just packed the high byte?
        let ps = "";
        let a8_len = a8.length;
        for (let i = 0; i < a8_len; i++) {
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
    }

    /**
     * Convert a packed string, created using ArrayBufferToPackedString, back
     * into an ArrayBuffer containing an arbitrary number of bytes.
     */
    static PackedStringToArrayBuffer(str) {
        let datalen = 2 * str.length - 1;
        if ((str.charCodeAt(0) & 0x100) === 0)
            datalen--;
        let high = true;
        let a8 = new Uint8Array(datalen);
        let i = 0;
        let j = 0;
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
    }

    /**
     * Convert an ArrayBuffer containing arbitrary byte data into a Base64
     * encoded string, suitable for use in a Data-URI
     * @param ab the ArrayBuffer to convert
     * @return a String of Base64 bytes (using MIME encoding)
     */
    static ArrayBufferToBase64(ab) {
        let a8 = new Uint8Array(ab);
        let nMod3 = 2;
        let sB64Enc = "";
        let nLen = a8.length;

        // Convert a base 64 number to the charcode of the character used to
        // represent it
        function uint6ToB64(nUInt6) {
            return nUInt6 < 26 ?
                nUInt6 + 65 :
                nUInt6 < 52 ?
                nUInt6 + 71 :
                nUInt6 < 62 ?
                nUInt6 - 4 :
                nUInt6 === 62 ?
                43 :
                nUInt6 === 63 ?
                47 :
                65;
        }

        // For each byte in the buffer
        for (let nUInt24 = 0, nIdx = 0; nIdx < nLen; nIdx++) {
            nMod3 = nIdx % 3;
            nUInt24 |= a8[nIdx] << (16 >>> nMod3 & 24);
            if (nMod3 === 2 || nLen - nIdx === 1) {
                sB64Enc += String.fromCharCode(
                    uint6ToB64(nUInt24 >>> 18 & 63),
                    uint6ToB64(nUInt24 >>> 12 & 63),
                    uint6ToB64(nUInt24 >>> 6 & 63),
                    uint6ToB64(nUInt24 & 63));
                nUInt24 = 0;
            }
        }

        return sB64Enc.substr(0, sB64Enc.length - 2 + nMod3) +
            (nMod3 === 2 ? "" : nMod3 === 1 ? "=" : "==");
    }

    /**
     * Convert a MIME-Base64 string into an array buffer of arbitrary
     * 8-bit data
     * @param sB64Enc the String to convert
     * @return an ArrayBuffer
     */
    static Base64ToArrayBuffer(sB64) {
        let sB64Enc = sB64.replace(/[^A-Za-z0-9+/]/g, ""); // == and =
        let nInLen = sB64Enc.length;
        let nOutLen = nInLen * 3 + 1 >> 2;
        let ta8 = new Uint8Array(nOutLen);
        // Convert Base64 char (as char code) to the number represented
        function b64ToUInt6(nChr) {
            return nChr > 64 && nChr < 91 ?
                nChr - 65 :
                nChr > 96 && nChr < 123 ?
                nChr - 71 :
                nChr > 47 && nChr < 58 ?
                nChr + 4 :
                nChr === 43 ?
                62 :
                nChr === 47 ?
                63 :
                0;
        }

        for (let nMod3, nMod4, nUInt24 = 0, nOutIdx = 0, nInIdx = 0; nInIdx < nInLen; nInIdx++) {
            nMod4 = nInIdx & 3;
            nUInt24 |= b64ToUInt6(sB64Enc.charCodeAt(nInIdx)) <<
                6 * (3 - nMod4);
            if (nMod4 === 3 || nInLen - nInIdx === 1) {
                for (nMod3 = 0; nMod3 < 3 &&
                     nOutIdx < nOutLen; nMod3++, nOutIdx++) {
                    ta8[nOutIdx] = nUInt24 >>> (16 >>> nMod3 & 24) & 255;
                }
                nUInt24 = 0;
            }
        }
        return ta8.buffer;
    }

    static parseURLParams(s) {
        let lets = s.split(/[&;]+/);
        let query = {};
        for (let i = 0; i < lets.length; i++) {
            if (lets[i] === "")
                continue;
            let ass = lets[i].split("=");
            if (typeof query[ass[0]] === "undefined") {
                // If first entry with this name, assign simple string
                query[ass[0]] = decodeURIComponent(ass[1]);
            } else if (typeof query[ass[0]] === "string") {
                // If second entry with this name, make an array
                let arr = [query[ass[0]], decodeURIComponent(ass[1])];
                query[ass[0]] = arr;
            } else {
                // If third or later entry with this name, push it
                query[ass[0]].push(decodeURIComponent(ass[1]));
            }
        }
        return query;
    }

    /**
     * Expand $1..$N in a string to the arguments passed.
     *
     * There is limited support for conditional expansion using the
     * `$?(bexpr,then,else)` macro. If `bexpr1` eval()s to true then the
     * expression will expand to `then`, otherwise it will expand to `else`.
     * Both `then` and `else` must be given, though can be empty.
     *
     * For example, consider `TX.tx("$1 day$?($1!=1,s,)", ndays)`.
     * If `$1!=1` succeeds then the macro expands to `s` otherwise
     * to the empty string. Thus if `ndays` is `1` it will expand to `1 day`
     * but if it is `11` it will expand to `11 days`
     *
     * NOTE: conditions are evaled and could thus be used for cross
     * scripting. User input must never be passed to the templater. There is
     * no error checking on the eval, and it will throw an exception if the
     * syntax is incorrect.
     */
    static expandTemplate() {
        let tmpl = arguments[0];
        let args = arguments;

        tmpl = tmpl.replace(/\$(\d+)/g, function (m, p1) {
            let i = parseInt(p1);
            return args[i];
        })
        tmpl = tmpl.replace(
                /\$\?\((.*?),(.*?),(.*?)\)/g,
            function (m, test, pass, fail) {
                let result = false;
                eval("result=(" + test + ")");
                return result ? pass : fail;
            });
        return tmpl;
    }

    static extend() {
        for (let i = 1; i < arguments.length; i++)
            for (let key in arguments[i])
                if(arguments[i].hasOwnProperty(key))
                    arguments[0][key] = arguments[i][key];
        return arguments[0];
    }
}

if (typeof jQuery !== "undefined")
    jQuery.ajaxTransport("+binary", Utils.setUpAjax);

// Hash of events that are waiting to be triggered by the 'sometime'
// scheduler.
Utils.waiting_for_sometime = {};

// By setting the sometime_timeout to a non-null value we block
// the wait queue until Utils.sometime_is_now is called the first time.
// This lets us complete the load without too much noise.
Utils.sometime_timeout = true;

// Set by the 'sometime' scheduler, the 'soon' scheduler, and
// the 'execute_queue' sequencer to record when the last time we
// had a timeout event, indicating that the UI has had a timeslice.
// Used by 'soon' to control how often we yield to the UI before
// calling the managed function (we don't want to yield unless we
// really have to)

Utils.last_yield = Date.now();

// Timeout intervals, milliseconds
Utils.IMMEDIATE = 1;
Utils.SOON = 50;
Utils.SOMETIME = 250;
Utils.MSPERDAY = 24 * 60 * 60 * 1000;

if (typeof module !== "undefined")
    module.exports = Utils;
