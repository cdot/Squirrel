/**
 * Process strings for translation. Reads the JSON from the input files
 * and builds a dictionary that is used to correct the language file
 */
"use strict";

const getopt = require("node-getopt");
const Fs = require("fs-extra");
const axios = require("axios");

const DESCRIPTION =
      "DESCRIPTION\nTranslate strings read from JSON files. If a language file is given, will read current translations and rewrite new translations.\n\nUSAGE\nnode translate [-langfile <lf.json>] <strings1.json> <strings2.json> ...\n\n\nOPTIONS\n";

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
var loads = [];

// Read the existing langfile, if it exists
if (lf) {
    lang = lf.replace(/.*\/([^/]+)\.json$/, "$1");
    console.log("Target language " + lang);
    loads.push(
        Fs.access(lf, Fs.constants.R_OK).then(() => {
            console.log("Reading " + lf);
            return Fs.readFile(lf, 'utf8')
                .then(function(data) {
                    known = JSON.parse(data);
                });
        }));
}

// Read the .strings files and record that the strings in it are wanted
for (var i in opt.argv) {
    let fname = opt.argv[i];
    loads.push(
        Fs.readFile(fname, 'utf8')
            .then(function(data) {
                var arr = JSON.parse(data);
                for (var i = 0; i < arr.length; i++) {
                    //console.log("Want " + arr[i]);
                    wanted[arr[i]] = true;
                }
            }));
}

// Delete strings that are known but not wanted
Promise
    .all(loads)
    .then(() => {       
        for (let k in known) {
            if (wanted[k]) continue;
            console.log("Delete " + k);
            delete known[k];
        }
    })
    .then(() => {
        // Get translations of strings that are wanted but are not currently
        // known
        let translations = [];
        for (var k in wanted) {
            if (!known[k] || improve) {
                // Get a translation for this string
                translations.push(
                    translate(k)
                        .then((tx) => {
                            var m = {};
                            m[k] = tx;
                            console.log("Translated '" + k +
                                        "' to '" + tx.s +
                                        "' with confidence " + tx.m);
                            if (!known[k] || tx.m > known[k].m)
                                known[k] = tx;
                        })
                        .catch((e) => {
                            console.error("Cannot translate '" + k + "': " + e);
                        }));
            }
        }
        return Promise.all(translations);
    })
    .then(() => {
        // Generate output
        if (lf) {
            console.log("Writing " + lf);
            return Fs.writeFile(
                lf, JSON.stringify(known, null, 1), 'utf8');
        }
        console.log(JSON.stringify(known, null, 1));
    });


