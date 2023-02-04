import Getopt from "node-getopt";
import fs from "fs";
import Hoard from "hoard";

const DESCRIPTION = "USAGE\n  node build_tree.js [options] <file>\nRead a .json file of actions as output by endcrypt.js and try to build a hoard from it.";

const OPTIONS = [
  ["d", "debug", " to enable debug"],
  ["h", "help", "show this help"]
];

const parse = new Getopt(OPTIONS)
      .bindHelp()
      .setHelp(DESCRIPTION + "\nOPTIONS\n[[OPTIONS]]")
      .parseSystem();

if (parse.argv.length !== 1) {
  parse.showHelp();
  throw "No filename";
}
const fname = parse.argv[0];

const opt = parse.options;
const debug = typeof opt.debug === 'undefined' ? () => {} : console.debug;

fs.promises.readFile(fname)
.then(json => {
	const hoard = new Hoard({debug: debug});
	const actions = JSON.parse(json);
	const conflicts = hoard.play_actions(actions);
	console.log(conflicts);
})
.catch(e => console.log("Failed", e));


