if (typeof requirejs === 'undefined') {
  requirejs = require('requirejs');
	requirejs.config({
		baseUrl: `${__dirname}/..`
	});
}

const DESCRIPTION = "USAGE\n  node endecrypt.js [options] <file>\nEncode/decode a file encrypted using CryptoLayer. If the input file has a .json extension, will encrypt it to a file of the same name without the extension. If there is no .json extension, will decrypt to a file of the same name with a .json extension.";

const OPTIONS = [
  ["e", "encrypt", "encrypt file (default is decrypt)"],
  ["p", "pass=ARG", "encryption password"],
	["s", "stdio", "output to STDIO instead of file"],
  ["d", "debug", " to enable debug"],
  ["h", "help", "show this help"]
];

requirejs(["node-getopt", "js/FileStore", "js/CryptoLayer", "js/Utils"], function(Getopt, FileStore, CryptoLayer, Utils) {

  const parse = new Getopt(OPTIONS)
        .bindHelp()
        .setHelp(DESCRIPTION + "\nOPTIONS\n[[OPTIONS]]")
        .parseSystem();

  if (parse.argv.length !== 1) {
    parse.showHelp();
    throw "No filename";
  }
  let fname = parse.argv[0];

  const opt = parse.options;
  const debug = typeof opt.debug === 'undefined' ? () => {} : console.debug;

  const plainstore = new FileStore({ debug: debug });
  const cipherstore = new CryptoLayer({
    debug: debug,
    understore: new FileStore({ debug: debug })
  });
  cipherstore.option("pass", opt.pass || "");
  
  const path = /\//.test(fname) ? fname.replace(/\/[^/]*$/, "") : "";

  cipherstore.option("path", path);
  plainstore.option("path", path);
  fname = fname.replace(/.*\//, "");

  let instore, outstore, outf, encrypt = false;
  if (/\.json$/.test(fname)) {
    debug(`Encrypt ${fname}`);
    encrypt = true;
    instore = plainstore;
    outf = fname.replace(/\.json$/, "");
    outstore = cipherstore;
  } else {
    debug(`Decrypt ${fname}`);
    instore = cipherstore;
    outf = fname + ".json";
    outstore = plainstore;
  }
  
  debug("Input ", instore.type, instore.option("path"), fname);
  debug("Output ", outstore.type, outstore.option("path"), outf);

  instore.reads(fname)
  .then(json => {
    if (!encrypt) {
			console.log(json);
      json = JSON.stringify(JSON.parse(json), null, " ");
    }
    if (opt.stdio) {
			console.log(json);
			return Promise.resolve();
		} else {
			console.log(`Writing to ${outf}`);
			return outstore.writes(outf, json);
		}
  })
  .catch(e => console.log("Failed", e));
});

