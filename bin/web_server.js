/*@preserve Copyright (C) 2016-2019 Crawford Currie http://c-dot.co.uk license MIT*/
/*eslint-env node */

const DESCRIPTION = [
  "A super-lightweight HTTP(S) server supporting GET and POST.",
  "Designed for the sole purpose of simple read/write of binary files.\n",
  "Usage: node web_server.js --docroot /var/www/html --writable data --port 3000 --user User --pass Pass --cert cert.pem --key key.pem\n",
  "This will start a HTTPS server on port 3000 to serve files in /var/www/html, and allowing new files to be POSTed to the data subdirectory.\n",
  ""].join("\n");

const OPTIONS = [
  ["-r, --docroot=ARG - absolute path to the document root. Defaults to the current directory when the server was started"],
  ["-w, --writable=ARG - relative path to writable files. If this option is given, then only files below this subdirectory will be writable; all other files will not"],
  ["-p, --port=ARG - Port to run the server on (default 3000)"],
  ["-l, --log - Log requests to the console"],

  ["-C, --cert=ARG - SSL certificate (filename or text) required to run https. Certificates can be obtained for free from https://letsencrypt.org/"],
  ["-K, --key=ARG - SSL key (filename or text)"],

  ["-U, --user=ARG - BasicAuth username"],
  ["-P, --pass=ARG - BasicAuth password"],
  ["-R, --realm=ARG - BasicAuth realm"],

  ["-d, --debug - Extra debug info to console"],
  ["-h, --help - Show this help"]
];

import getopt from "posix-getopt";
import { Server } from "../src/Server.js";

const go_parser = new getopt.BasicParser(
  "h(help)r:(docroot)w:(writable)p:(port)l:(log)C:(cert)K:(key)U:(user)P:(pass)R:(realm)d(debug)",
  process.argv);

const params = {
  port: 3000
};
let option;
while ((option = go_parser.getopt())) {
  switch (option.option) {
  default: console.debug(DESCRIPTION); process.exit();
  case "p": params.port = option.optarg; break;
  case 'r': params.docroot = option.optarg; break;
  case 'w': params.writable = option.optarg ; break;
  case "l": params.log_requests = true; break;
  case "d": params.debug = console.debug; break;
  case "C": if (!params.ssl) params.ssl = {};
    params.ssl.cert = option.optarg; break;
  case "K": if (!params.ssl) params.ssl = {};
    params.ssl.key = option.optarg; break;
  case "U":  if (params.auth) params.auth = {};
    params.auth.user = option.optarg; break
  case "P":  if (params.auth) params.auth = {};
    params.auth.pass = option.optarg; break
  case "R":  if (params.auth) params.auth = {};
    params.auth.realm = option.optarg; break
  }
}
new Server(params).start();

