/**
 * Process strings for translation. Reads the JSON from the input files
 * and builds a dictionary that is used to correct the language file
 */
(function() {
    "use strict";

    const getopt = require("node-getopt");
    const Fs = require("fs");
    const Q = require("q");
    const axios = require("axios");

    const DESCRIPTION =
          "DESCRIPTION\nTranslate strings read from JSON files. If a language file is given, will read current translations and rewrite new translations.\n\nUSAGE\nnode translate [-langfile <lf.json>] <strings1.json> <strings2.json> ...\n\n\nOPTIONS\n";
    const readFilePromise = Q.denodeify(Fs.readFile);
    const writeFilePromise = Q.denodeify(Fs.readFile);

    if (typeof Array.prototype.forEach === "undefined") {
        /**
         * Simulate ES6 forEach
         */
        Array.prototype.forEach = function(callback) {
            for (var i in this) {
                callback(this[i], i, that);
            }
        };
    }

    if (typeof Object.prototype.keys === "undefined") {
        Object.prototype.keys = function() {
            var ks = [];
            for (var i in this)
                ks.push(i);
            return ks;
        }
    }

    var lang = "en";

    function translate(s) {
        var protection = [];

        function protect(os) {
            return os.replace(/(\{|\}|\$\d*|<[^>]*>)/g, function(m, p) {
                protection.push(p);
                return "{" + protection.length + "}";
            });
        }

        function unprotect(ns) {
            return ns.replace(/{(\d+)}/g, function(m, i) {
                return protection[parseInt(i)];
            });
        }
        
        function lengthInUtf8Bytes(str) {
            // Matches only the 10.. bytes that are non-initial
            // characters in a multi-byte sequence.
            var m = encodeURIComponent(str).match(/%[89ABab]/g);
            return str.length + (m ? m.length : 0);
        }
        
        s = protect(s);

        if (lengthInUtf8Bytes(s) > 500)
            throw "Cannot auto-translate " + s + " it's > 500 bytes";
        
        if (lang === "en")
            return { s: s, m: 0 }; // handy debug

        return axios.get(
            "http://api.mymemory.translated.net/get", {
                params: {
                    q: s,
                    langpair: "en|" + lang
                }
            })
            .then(function(response) {
                var result = response.data.responseData;
                return { m: result.match,
                         s: unprotect(result.translatedText) };
            });
    }
    
    var opt = getopt.create([
        [ "l", "langfile=s", "Language file (default none)" ],
        [ "i", "improve", "Try to improve on existing translations" ],
        [ "h", "help", "Show this help" ]
    ])
        .bindHelp()
        .setHelp(DESCRIPTION + "[[OPTIONS]]")
        .parseSystem();

    var lf = opt.options.langfile;
    var improve = opt.options.improve;
    
    var known = {};
    var wanted = {};
    var promise = Q();
    
    // Read the existing langfile, if it exists
    if (lf) {
        lang = lf.replace(/.*\/([^/]+)\.json$/, "$1");
        console.log("Target language " + lang);
        if (Fs.existsSync(lf)) {
            promise = promise.then(function() {
                console.log("Reading " + lf);
                return readFilePromise(lf, 'utf8')
                    .then(function(data) {
                        known = JSON.parse(data);
                    });
            });
        }
    }

    // Read the .strings files and record that the strings within are wanted
    opt.argv.forEach(function(fname) {
        promise = promise.then(function() {
            console.log("Reading " + fname);
            return readFilePromise(fname, 'utf8')
                .then(function(data) {
                    var arr = JSON.parse(data);
                    for (var i = 0; i < arr.length; i++) {
                        //console.log("Want " + arr[i]);
                        wanted[arr[i]] = true;
                    }
                });
        });
    });

    // Delete strings that are not wanted
    promise = promise.then(function() {       
        known.keys().forEach(function(k) {
            if (!wanted[k]) {
                console.log("Delete " + k);
                delete known[k];
            }
        });
    });

    // Get translations of strings that are wanted but are not currently
    // known
    promise = promise.then(function() {
        var prom = Q();
        wanted.keys().forEach(function(k) {
            if (!known[k] || improve) {
                // Get a translation for this string
                prom = prom
                .then(function() {
                    return translate(k);
                })
                .then(function(tx) {
                    var m = {};
                    m[k] = tx;
                    console.log("Translated '" + k +
                                "' to '" + tx.s +
                                "' with confidence " + tx.m);
                    if (!known[k] || tx.m > known[k].m)
                        known[k] = tx;
                })
                .catch(function(e) {
                    console.error("Cannot translate '" + k + "': " + e);
                });
            }
        });
        
        return prom;
    });
    
    // Generate output
    if (lf) {
        promise = promise.then(function(strings) {
            console.log("Writing " + lf);
            Fs.writeFile(
                lf, JSON.stringify(known, null, 1), 'utf8');
        });
    } else {
        promise = promise.then(function(strings) {
            console.log(JSON.stringify(known, null, 1));
        });
    }

    promise.done();
})();
