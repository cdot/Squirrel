/* node.js program to extract tagged DOM strings from HTML */
const getopt = require("node-getopt");
const { JSDOM } = require("jsdom");
const Translator = require("../js/Translator");
const Fs = require("fs-extra");

const DESCRIPTION =
      "DESCRIPTION\nExtract TX_ strings from HTML and JS.\n\nOPTIONS\n";

var TX = new Translator();

function processHTML(fname) {
    var sname = fname + ".strings";
    return Fs.readFile(fname).then((data) => {
        var dom = new JSDOM(data);
        var strings = TX.findAllStrings(dom.window.document.body);
        console.log("Writing " + sname);
        return Fs.writeFile(sname, JSON.stringify(strings), 'utf8');
    });
}

function processJS(fname) {
    console.log("Reading " + fname);
    var sname = fname + ".strings";
    
    return Fs.readFile(fname).then((data) => {
        var strings = [];
        ("" + data).replace(
                /\bTX\.tx\((["'])(.+?[^\\])\1/g, function(m, q, s) {
                    strings.push(s);
                    return "";
                });
        console.log("Writing " + sname);
        return Fs.writeFile(sname, JSON.stringify(strings), 'utf8');
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
var promises = [];
for (var i = 0; i < opt.argv.length; i++) {
    if (/\.html$/.test(opt.argv[i]))
        promises.push(processHTML(opt.argv[i]));
    else if (/\.js$/.test(opt.argv[i]))
        promises.push(processJS(opt.argv[i]));
    else
        console.error("Don't know how to process " + opt.argv[i]);
}
Promise.all(promises);

