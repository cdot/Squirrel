/*@preserve Copyright (C) 2015-2017 Crawford Currie http://c-dot.co.uk license MIT*/
/* eslint-env browser,node */

/* global utf8: false */

define("js/Utils", ["libs/utf8"], function() {

    /**
     * Utilities and plugins used by Squirrel
     */
    class Utils {

        /**
         * Convert an Uint8Array containing UTF-8 encoded string into a
         * String.
         * @param a Uint8Array containing the UTF8 encoded string
         * @return String the string
         * @throws UTF8 decode errors
         */
        static Uint8ArrayToString(a) {
            let str = '';
            for (let i = 0; i < a.length; i++)
                str += String.fromCodePoint(a[i]);
            return utf8.decode(str);
        }

        /**
         * Convert a String into a Uint8Array containing the UTF8 encoded
         * string.
         * @param str the String to convert
         * @return a Uint8Array
         */
        static StringToUint8Array(str) {
            let u8 = utf8.encode(str);
            let a = new Uint8Array(u8.length);
            for (let i = 0; i < u8.length; i++)
                a[i] = u8.codePointAt(i);
            return a;
        }

        /**
         * Pack arbitrary binary byte data into a String as efficiently
         * as possible. We limit ourselves to using only 16 bits per character
         * location, so that strings created this way can be further manipulated.
         * @param data arbitrary byte data to be packed
         * @return a String of 16-bit code points containing the packed data
         */
        static Uint8ArrayToPackedString(a8) {
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
         * Convert a packed string, created using Uint8ArrayToPackedString, back
         * into a Uint8Array containing the unpacked array.
         */
        static PackedStringToUint8Array(str) {
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
            return a8;
        }

        /**
         * Convert an Uint8Array containing arbitrary byte data into a Base64
         * encoded string, suitable for use in a Data-URI
         * @param a8 the Uint8Array to convert
         * @return a String of Base64 bytes (using MIME encoding)
         */
        static Uint8ArrayToBase64(a8) {
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
         * Convert a MIME-Base64 string into an array of arbitrary
         * 8-bit data
         * @param sB64Enc the String to convert
         * @return a Uint8Array
         */
        static Base64ToUint8Array(sB64) {
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
            return ta8;
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

    return Utils;
});

