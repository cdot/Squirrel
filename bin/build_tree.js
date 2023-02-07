import Getopt from "node-getopt";
import fs from "fs";
import { Hoard } from "../src/common/Hoard.js";
import { Action } from "../src/common/Action.js";

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

global.$ = {};
$.i18n = (...args) => console.log(args.join(" "));

fs.promises.readFile(fname)
.then(async json => {
	const hoard = new Hoard({debug: debug});
	const actions = JSON.parse(json);
  const conflicts = [];
	for (let act of actions) {
		await hoard.play_action(new Action(act))
		.catch(e => console.log(e));
	}
});


