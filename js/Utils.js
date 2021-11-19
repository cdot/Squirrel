/*@preserve Copyright (C) 2015-2017 Crawford Currie http://c-dot.co.uk license MIT*/
/* eslint-env browser,node */

define("js/Utils", [], () => {

    /**
     * Utilities and plugins used by Squirrel
     */
    class Utils {

        /**
         * Convert an Uint8Array containing UTF-8 encoded string into a
         * String.
         * @param {Uint8Array} a the UTF8 encoded string
         * @return {string} the string
         * @throws UTF8 decode errors
         */
        static Uint8ArrayToString(a) {
            return new TextDecoder().decode(a);
        }

        /**
         * Convert a String into a Uint8Array containing the UTF8 encoded
         * string.
         * @param {string} str the String to convert
         * @return {Uint8Array}
         */
        static StringToUint8Array(str) {
            return new TextEncoder().encode(str);
        }

        /**
         * Pack arbitrary 16-bit data into a String.
         * @param {Uint16Array} data arbitrary 16-bit data to be packed
         * @return {string} containing the data
         */
        static Uint16ArrayToPackedString(a16) {
            let ps = "";
            for (let cp of a16) {
                // Avoid getting into trouble on Firefox by avoiding
                // codepoints which are reserved as surrogates in UTF16
                //console.log("Pack",cp);
                if (cp >= 0xD7FF && cp <= 0xDFFF) {
                    ps += String.fromCodePoint(0xD7FF);
                    ps += String.fromCodePoint(cp - 0xD7FF);
                } else
                    ps += String.fromCodePoint(cp);
            }
            return ps;
        }
        
        /**
         * Unpack arbitrary 16-bit data into a String.
         * @param {string} data arbitrary 16-bit data to be unpacked
         * @return {Uint16Array} the data
         */
        static PackedStringToUint16Array(s) {
            const a16 = [];
            for (let i = 0; i < s.length; i++) {
                let cp = s.codePointAt(i);
                if (cp === 0xD7FF) {
                    cp = 0xD7FF + s.codePointAt(++i);
                }
                //console.log("UnPack",cp);
                a16.push(cp);
            }
            return Uint16Array.from(a16);
        }
        
        /**
         * Pack arbitrary binary byte data into a String.
         * @param {Uint8Array} data arbitrary byte data to be packed
         * @return {string} packed String containing the data
         */
        static Uint8ArrayToPackedString(a8) {
            // Pack bytes into a 16-bit array. The usb of the first
            // character is reserved for a flag that indicates if the
            // lsb of the last character is part of the array or not.
            let cc = ((a8.length & 1) !== 0) ? 0x100 : 0;
            let low = true; // have we just packed the high byte?
            const a16 = [];
            for (let c of a8) {
                if (low) {
                    a16.push(cc | c);
                    low = false;
                } else {
                    cc = c << 8;
                    low = true;
                }
            }
            if (low)
                a16.push(cc);
            return Utils.Uint16ArrayToPackedString(a16);
        }

        /**
         * Convert a packed string, created using Uint8ArrayToPackedString, back
         * into a Uint8Array containing the unpacked array.
		 * @param {string} str packed string
		 * @return {Uint8Array} unpacked data
         */
        static PackedStringToUint8Array(str) {
            const a16 = Utils.PackedStringToUint16Array(str);
            let datalen = 2 * a16.length - 1;
            if ((a16[0] & 0x100) === 0)
                datalen--;
            const a8 = [];
            let high = false;
            for (let i = 0, j = 0; i < datalen; i++) {
                if (high) {
                    a8.push((a16[j] >> 8) & 0xFF);
                    high = false;
                } else {
                    a8.push(a16[j++] & 0xFF);
                    high = true;
                }
            }
            return Uint8Array.from(a8);
        }

        /**
         * Convert an Uint8Array containing arbitrary byte data into a Base64
         * encoded string, suitable for use in a Data-URI
         * @param {Uint8Array} a8 the Uint8Array to convert
         * @return {string} Base64 bytes (using MIME encoding)
         */
        static Uint8ArrayToBase64(a8) {
            let nMod3 = 2;
            let sB64Enc = "";
            const nLen = a8.length;

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
         * @param {string} sB64Enc the String to convert
         * @return {Uint8Array}
         */
        static Base64ToUint8Array(sB64) {
            const sB64Enc = sB64.replace(/[^A-Za-z0-9+/]/g, ""); // == and =
            const nInLen = sB64Enc.length;
            const nOutLen = nInLen * 3 + 1 >> 2;
            const ta8 = new Uint8Array(nOutLen);
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

        /**
         * Parse a URL parameter string according to the given spec
         * @param {string} s the URLparameters string (undecoded)
         * @param {object.<string.object>} spec optional parameter spec object.
		 * Fields are parameter names, and map to an object that can have
		 * array:true for array values
         * and must have type: for the parameter type. type: is one of the
         * standard JS object types e.g. String, Number, Date and uses the
         * constructor of that object type to create the value.
		 * @return {object.<string,object>} map of parameter name to value
         * @throw Error if there is a problem
         */
        static parseURLParams(s, specs) {
            function parse(v, t) {
                switch (t) {
                case "number": case "float":
                    return parseFloat(v);
                case "int": case "integer":
                    return parseInt(v);
                case "bool": case "boolean":
                    if (!v) return false;
                    if (/^(false|no)$/i.test(v)) return false;
                    if (/^[0-9]+$/.test(v)) return parseInt(v) != 0;
                    return true;
                }
                return v;
            }
            
            if (!specs) specs = {};
            const lets = s.split(/[&;]+/);
            const query = {};
            for (let i = 0; i < lets.length; i++) {
                if (lets[i] === "")
                    continue;
                const ass = lets[i].split('=', 2);
                let key, value;
                if (ass.length > 1) // value option
                    key = ass[0], value = decodeURIComponent(ass[1]);
                else
                    key = ass, value = "1"; // boolean option
                
                const spec = specs[key];
                if (!spec)
                    query[key] = value;
                else {
                    if (spec.array) {
                        query[key] = value.split(",")
						.map(v => parse(v, spec.type));
                    }
                    else
                        query[key] = parse(value, spec.type);
                }
            }

            for (let key in specs) {
                if (!(key in query)) {
                    if ("default" in specs[key]) {
                        query[key] = specs[key].default;
                    }
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
		 * @param {string} str string to expand, other arguments are template
		 * parameters
         */
        static expandTemplate() {
            const args = arguments;

            const tmpl = arguments[0]
				  .replace(/\$(\d+)/g, function (m, p1) {
					  const i = parseInt(p1);
					  return args[i];
				  })
				  .replace(
                      /\$\?\((.*?),(.*?),(.*?)\)/g,
					  function (m, test, pass, fail) {
						  let result = false;
						  try {
							  /* eslint-disable no-eval */
							  eval(`result=(${test})`);
							  /* eslint-enable no-eval */
						  } catch (e) {
							  throw new Error(
								  `Problem evaluating '${test}' in template '${arguments[0]}: ${e}`);
						  }
						  return result ? pass : fail;
					  });
            return tmpl;
        }

		/**
		 * Like jQuery $.extend
		 */
        static extend() {
            for (let i = 1; i < arguments.length; i++)
                for (let key in arguments[i])
                    if(arguments[i].hasOwnProperty.call(key))
                        arguments[0][key] = arguments[i][key];
            return arguments[0];
        }

		/**
		 * Promise to requirejs a module
		 * @param {string} mod module to require
		 * @return {Promise} Promise that resolves to the loaded module
		 */
		static require(mod) {
			return new Promise(resolve => {
				requirejs([mod], fn => resolve(fn));
			});
		}
    }

    return Utils;
});

