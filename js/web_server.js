/*@preserve Copyright (C) 2016-2019 Crawford Currie http://c-dot.co.uk license MIT*/
/*eslint-env node */

const DESCRIPTION = [
    "A super-lightweight HTTP(S) server supporting GET and POST.",
    "Designed for the sole purpose of simple read/write of binary files.\n",
    "Usage: node web_server.js --docroot /var/www/html --writable data --port 3000 --user User --pass Pass --cert cert.pem --key key.pem\n",
    "This will start a HTTPS server on port 3000 to serve files in /var/www/html, and allowing new files to be POSTed to the data subdirectory.\n",
    ""].join("\n");

const OPTIONS = [
    ["", "docroot=ARG", "absolute path the to document root. Defaults to the current directory when the server was started"],
    ["", "writable=ARG", "relative path to writable files. If this option is given, then only files below this subdirectory will be writable; all other files will not"],
    ["", "port=ARG", "Port to run the server on"],
    ["", "log", "Log requests to the console"],

    ["", "cert=ARG", "SSL certificate (filename or text) required to run https. Certificates can be obtained for free from https://letsencrypt.org/"],
    ["", "key=ARG", "SSL key (filename or text)"],

    ["", "user=ARG", "BasicAuth username"],
    ["", "pass=ARG", "BasicAuth password"],
    ["", "realm=ARG", "BasicAuth realm"],

    ["d", "debug", "Extra debug info to console"],
    ["h", "help", "Show this help"]
];

let requirejs = require("requirejs");

requirejs.config({
    baseUrl: ".."
});

requirejs(["node-getopt", "js/Server"], (getopt, Server) => {

    let cliopt = getopt.create(OPTIONS)
        .bindHelp()
        .setHelp(DESCRIPTION + "[[OPTIONS]]")
        .parseSystem()
        .options;

    let params = {
        port: cliopt.port || 3000,
        docroot: cliopt.docroot,
        writable: cliopt.writable
    };

    if (cliopt.log)
        params.log_requests = true;

    if (cliopt.debug)
        params.debug = console.debug;

    if (cliopt.cert) {
        if (!cliopt.key)
            throw "No SSL key";
        params.ssl = {
            cert: cliopt.cert,
            key: cliopt.key
        };
    } else if (cliopt.key)
        throw "No SSL cert";

    if (cliopt.user) {
        params.auth = {
            user: cliopt.user || "",
            pass: cliopt.pass || "",
            realm: cliopt.realm || ""
        }
    }

    new Server(params).start();
});
