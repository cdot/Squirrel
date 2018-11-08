/*@preserve Copyright (C) 2015-2018 Crawford Currie http://c-dot.co.uk license MIT*/

/*eslint-env node */

// Yes, I could have used express, but I wrote this before I knew about
// it, and it "just works". Only handles binary files, but knows about CORS.

const getopt = require("node-getopt");
const Q = require("q");
const Url = require("url");
const extend = require('extend');
const Fs = require("fs");
const { parse } = require('querystring');
//require("https") done dynamically
//require("http") done dynamically
//require("basicauth") done dynamically

const DESCRIPTION = [
    "A super-lightweight HTTP(S) server supporting GET and POST.",
    "Designed for the sole purpose of simple read/write of binary files.\n",
    "Usage: node node.js.server.js --writable remote_data --port 3000 --user User --pass Pass --cert cert.pem --key key.pem\n",
    "This will start a HTTPS server on port 3000 using the remote_data directory to store files.\n",
    ""].join("\n",);

var debug = false;
var log_requests = false;
var readFile = Q.denodeify(Fs.readFile);
var writeFile = Q.denodeify(Fs.writeFile);

/**
 * Lightweight HTTP(S) server object (singleton) with very few
 * dependencies. Only supports POST and GET and Basic auth
 * The server sits on the selected port and processes GET and POST
 * requests.
 * @param proto Parameter hash. Legal params are:
 *    port: Port to run the server on, defaults to 3000
 *    writable: path to writable documents, defaults to current directory
 *    ssl: SSL configuration
 *        cert: SSL certificate (filename or text, required for SSL)
 *        key: SSL key (filename or text, required for SSL)
 *    auth: Basic auth to access the server
 *        user: Username (required for Basic Auth)
 *        pass: Password (required for Basic Auth)
 *        realm: Authentication realm (required for Basic Auth)
 * @class
 */
function Server(proto) {
    "use strict";

    extend(this, proto);

    var self = this;

    self.ready = false;
    if (typeof this.auth !== "undefined") {
        self.authenticate = function (request, response) {
            var BasicAuth = require("basic-auth");
            var credentials = BasicAuth(request);
            if (typeof credentials === "undefined"
                || credentials.name !== self.auth.user
                || credentials.pass !== self.auth.pass) {
                if (debug) {
                    if (credentials)
                        console.log("User ", credentials.name,
                                    " is trying to log in with password '"
                                    + credentials.pass + "'");
                } else
                    console.log("No credentials in request");
                console.error("Authentication failed ", request.url);
                response.statusCode = 401;
                response.setHeader('WWW-Authenticate', 'Basic realm="' +
                    self.auth.realm + '"');
                response.end('Access denied');
                return false;
            }
            if (debug)
                console.log("User '" + credentials.name
                              + "' is authenticated");
            return true;
        };
    } else
        self.authenticate = function() { return true; }
}
module.exports = Server;

/**
 * Get a promise to start the server.
 * @return {Promise} a promise to start the server
 */
Server.prototype.start = function () {
    var self = this;

    var handler = function (request, response) {
        if (self[request.method]) {
            self[request.method].call(self, request, response);
        } else {
            response.statusCode = 405;
            response.write("No support for " + request.method);
            response.end();
        }
    };

    if (typeof self.port === "undefined")
        self.port = 3000;

    if (typeof self.auth !== "undefined" && debug)
        console.log("Server requires authentication");

    var promise = Q();

    if (typeof this.ssl !== "undefined") {
        var options = {};

        promise = promise

            .then(function () {
                return self.ssl.key.read();
            })

            .then(function (k) {
                options.key = k;
                if (debug) console.log("SSL key loaded");
            })

            .then(function () {
                return self.ssl.cert.read();
            })

            .then(function (c) {
                options.cert = c;
                if (debug) console.log("SSL certificate loaded");
                console.log("HTTPS starting on port ", self.port);
            })

            .then(function () {
                return require("https").createServer(options, handler);
            });
    } else {
        console.log("HTTP starting on port ", self.port);
        promise = promise
            .then(function () {
                return require("http").createServer(handler);
            });
    }

    return promise

        .then(function (httpot) {
            self.ready = true;
            self.http = httpot;
            httpot.listen(self.port);
        });
};

Server.prototype.stop = function () {
    this.http.close();
};

/**
 * Common handling for POST or GET
 * @private
 */
Server.prototype.handle = function (request, response, promise, data) {
    "use strict";

    if (log_requests)
        console.log(request.method, " ", request.url);

    if (!this.authenticate(request, response))
        return;

    if (!this.ready) {
        // Not ready
        response.statusCode = 503;
        response.write("Not ready");
        response.end();
        return;
    }

    var req = Url.parse("" + request.url, true);

    // Get path relative to server root
    var spath = req.pathname;
    if (spath.indexOf("/") !== 0 || spath.length === 0) {
        response.write("Bad path");
        response.statusCode = 400;
        response.end(e);
        return;
    }
    spath = spath.substring(1);

    var path = spath.split(/\/+/);
    if (path.length < 1) {
        response.write("Bad path");
        response.statusCode = 400;
        response.end(e);
        return;
    }
    
    // Handle file lookup
    var filepath = path.join("/");

    var contentType = "text/plain";
    if (request.method === "GET") {
        var m = /\.([A-Z0-9]+)$/i.exec(spath);
        if (m) {
            var Mime = require("mime-types");
            contentType = Mime.lookup(m[1]);
        } else {
            contentType = "application/octet-stream";
        }
    } else if (request.method === "POST") {
        if (this.writable && filepath.indexOf(writable) !== 0) {
            if (debug)
                console.log("Trying to write '" + filepath
                            + "' in read-only area. Expected /^"
                            + this.writable + "/");
            response.write("Forbidden");
            response.statusCode = 403;
            response.end(e);
            return;
        }
    }

    try {
        promise(filepath, data)
            .then(function (responseBody) {
                // Allow cross-domain posting. Do we need this? It's already
                // done in the OPTIONS pre-flight
                response.setHeader("Access-Control-Allow-Origin", "*");
                response.setHeader("Access-Control-Allow-Methods", "POST,GET");

                if (debug) {
                    response.setHeader("Cache-Control", "no-cache");
                    response.setHeader("Cache-Control", "no-store");
                }
                
                if (responseBody) {
                    response.setHeader("Content-Type", contentType);
                    response.setHeader("Content-Length",
                                       Buffer.byteLength(responseBody));
                    response.write(responseBody);
                }
                response.statusCode = 200;
                response.end();
            },
            function (error) {
                // Send the error message in the payload
                if (error.code === "ENOENT") {
                    if (debug) console.log(error);
                    response.statusCode = 404;
                } else {
                    console.error("ERROR " + error);
                    console.error(error.stack);
                    response.statusCode = 500;
                }
                var e = error.toString();
                response.write(e);
                response.end(e);
            });
    } catch (e) {
        console.error(e, " in ", request.url, "\n",
            typeof e.stack !== "undefined" ? e.stack : e);
        response.write(e + " in " + request.url + "\n");
        response.statusCode = 400;
        response.end();
    }
};

/**
 * handler for incoming OPTIONS request (tuned for CORS pre-flight request)
 * @private
 */
Server.prototype.OPTIONS = function (request, response) {
    "use strict";

    console.log("OPTIONS",request.headers);
    
    // We only support these methods
    response.setHeader("Allow", "OPTIONS,POST,GET");

    // Allow cross-domain posting
    response.setHeader("Access-Control-Allow-Origin", request.headers.origin);

    // Access control on these methods
    response.setHeader("Access-Control-Allow-Methods", "POST,GET");

    // Accept BasicAuth
    response.setHeader("Access-Control-Allow-Headers", "Authorization");

    // OK to include cookies on the request
    //response.setHeader("Access-Control-Allow-Credentials", true);

    response.end();
};

/**
 * handler for incoming GET request
 * @private
 */
Server.prototype.GET = function (request, response) {
    "use strict";

    this.handle(request, response,
                function(path) {
                    return readFile(path);
                });
};

/**
 * Handler for incoming POST request
 * @private
 */
Server.prototype.POST = function (request, response) {
    "use strict";

    var self = this;

    var chunks = [];
    if (debug)
        console.log(request.headers);
    request.on("data", function (chunk) {
        chunks.push(chunk);
    }).on("end", function () {
        var body = Buffer.concat(chunks);
        self.handle(request, response,
                    function(path, data) {
                        return writeFile(path, data);
                    }, body);
    });
};

var cliopt = getopt.create([
    [ "", "writable=ARG", "relative path to writable files. If this option is given, then only files below this subdirectory will be writable; all other files will not" ],
    [ "", "port=ARG", "Port to run the server on" ],
    [ "", "log", "Log requests to the console" ],
    
    [ "", "cert=ARG", "SSL certificate (filename or text) required to run https. Certificates can be obtained for free from https://letsencrypt.org/" ],
    [ "", "key=ARG", "SSL key (filename or text)" ],

    [ "", "user=ARG", "BasicAuth username" ],
    [ "", "pass=ARG", "BasicAuth password" ],
    [ "", "realm=ARG", "BasicAuth realm" ],
    
    [ "d", "debug", "Extra debug info to console" ],
    [ "h", "help", "Show this help" ]
])
    .bindHelp()
    .setHelp(DESCRIPTION + "[[OPTIONS]]")
    .parseSystem()
    .options;
var params = {
    port: cliopt.port || 3000
};

if (cliopt.log)
    log_requests = true;

if (cliopt.debug)
    debug = true;

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
};

var server = new Server(params);
server.start();
