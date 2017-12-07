/* node.js program to extract tagged DOM strings from HTML */
(function() {
    const getopt = require("node-getopt");
    const { JSDOM } = require("jsdom");
    const TX = require("../js/Translation");
    const Fs = require("fs");

    const DESCRIPTION =
          "DESCRIPTION\nExtract TX_ strings from HTML.\n\nOPTIONS\n";

    /**
     * Analyse HTML and generate a map of all expandable strings found.
     * This can be used to seed the translations table.
     * @param el root element of the DOM tree to analyse
     */
    function findAllStrings(el) {
        "use strict";
        var strings = [], seen = {}; // use a map to uniquify
        function collect(s) {
            s = TX.clean(s);
            if (!seen[s]) {
                strings.push(s);
                seen[s] = true;
            }
            return undefined;
        }
        TX.translateDOM(el, collect, false);
        return strings.sort();
    }

    function processHTML(fname) {
        console.log("Reading " + fname);
        var sname = fname + ".strings";
        
        Fs.readFile(fname, function(err, data) {
            if (err)
                throw err;
            var dom = new JSDOM(data);
            var strings = findAllStrings(dom.window.document.body);
            console.log("Writing " + sname);
            Fs.writeFile(sname, JSON.stringify(strings), 'utf8');
        });
    }
    
    function processJS(fname) {
        console.log("Reading " + fname);
        var sname = fname + ".strings";
        
        Fs.readFile(fname, function(err, data) {
            if (err)
                throw err;
            var strings = [];
            ("" + data).replace(
                    /\bTX\.tx\((["'])(.+?[^\\])\1/g, function(m, q, s) {
                strings.push(s);
                return "";
            });
            console.log("Writing " + sname);
            Fs.writeFile(sname, JSON.stringify(strings), 'utf8');
        });
    }
    
    var opt = getopt.create([
        [ "h", "help", "Show this help" ],
    ])
        .bindHelp()
        .setHelp(DESCRIPTION + "[[OPTIONS]]")
        .parseSystem();
    var clopt = opt.options;
    var strings = [];
    for (var i = 0; i < opt.argv.length; i++) {
        if (/\.html$/.test(opt.argv[i]))
            processHTML(opt.argv[i]);
        else if (/\.js$/.test(opt.argv[i]))
            processJS(opt.argv[i]);
        else
            console.error("Don't know how to process " + opt.argv[i]);
    }
})();
