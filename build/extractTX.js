/* node.js program to extract strings from HTML and JS */
const requirejs = require("requirejs");
const DESCRIPTION =
      "DESCRIPTION\nExtract TX_ strings from HTML and JS.\n\nOPTIONS\n";

requirejs.config({
    baseUrl: "."
});

requirejs(["node-getopt", "jsdom", "js/Translator", "fs-extra"], function(getopt, jsdom, Translator, Fs) {

    var TX = Translator.instance();

    function processHTML(fname) {
        let sname = fname + ".strings";
        return Fs.readFile(fname).then((data) => {
            let dom = new jsdom.JSDOM(data);
            let strings = TX.findAllStrings(dom.window.document.body);
            console.log("Writing " + sname);
            return Fs.writeFile(sname, JSON.stringify(strings), 'utf8');
        });
    }

    function processJS(fname) {
        console.log("Reading " + fname);
        let sname = fname + ".strings";

        return Fs.readFile(fname).then((data) => {
            let strings = [];
            ("" + data).replace(
                /\b(TX|Translator\.instance\(\))\.tx\((["'])(.+?[^\\])\1/g, function(m, q, s) {
                    strings.push(s);
                    return "";
                });
            console.log("Writing " + sname);
            return Fs.writeFile(sname, JSON.stringify(strings), 'utf8');
        });
    }

    let opt = getopt.create([
        [ "h", "help", "Show this help" ],
    ])
        .bindHelp()
        .setHelp(DESCRIPTION + "[[OPTIONS]]")
        .parseSystem();
    let clopt = opt.options;
    let strings = [];
    let promises = [];
    for (let i = 0; i < opt.argv.length; i++) {
        if (/\.html$/.test(opt.argv[i]))
            promises.push(processHTML(opt.argv[i]));
        else if (/\.js$/.test(opt.argv[i]))
            promises.push(processJS(opt.argv[i]));
        else
            console.error("Don't know how to process " + opt.argv[i]);
    }
    Promise.all(promises);
});
