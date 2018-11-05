/*@preserve Copyright (C) 2018 Crawford Currie http://c-dot.co.uk license MIT*/

/*eslint-env node */

// Yes, I could have used express, but I wrote this before I knew about
// it, and it "just works".

const getopt = require("node-getopt");
const Q = require("q");
const Url = require("url");
const extend = require('extend');
const Fs = require("fs");
const { parse } = require('querystring');
//require("https") done dynamically
//require("http") done dynamically
//require("basicauth") done dynamically
//require("mime-types") done dynamically

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
 *    docroot: Absolute file path to server documents, defaults to /
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
            if (typeof credentials === "undefined") {
                if (debug)
                    console.debug("No credentials in request");
                console.error("Authentication failed ", request.url);
                response.statusCode = 401;
                response.setHeader('WWW-Authenticate', 'Basic realm="' +
                    self.auth.realm + '"');
                response.end('Access denied');
                return false;
            }
            if (debug)
                console.debug("User '" + credentials.name
                              + "' is authenticating");
            return (credentials.name === self.auth.user &&
                credentials.pass === self.auth.pass);
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
        console.debug("Server requires authentication");

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
                if (debug) console.debug("SSL certificate loaded");
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

    if (!this.ready) {
        // Not ready
        response.statusCode = 503;
        response.write("Not ready");
        response.end();
        return;
    }

    var req = Url.parse("" + request.url, true);
    var spath = req.pathname;

    if (spath.indexOf("/") !== 0 || spath.length === 0)
        throw "Bad request " + spath;

    spath = spath.substring(1);
    var path = spath.split(/\/+/);
    if (path.length < 1)
        throw "Bad command " +spath;

    var contentType = "text/plain";

    // Allow cross-domain posting
    response.setHeader("Access-Control-Allow-Origin", "*");
    response.setHeader("Access-Control-Allow-Methods", "POST,GET");

    // Handle file lookup
    var filepath = this.docroot + "/" + path.join("/");

    try {
        promise(filepath, data)
            .then(function (responseBody) {
                if (responseBody) {
                    response.setHeader("Content-Type",
                                       "application/octet-stream");
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
                response.setHeader("Content-Type", "text/plain");
                response.setHeader("Content-Length", Buffer.byteLength(e));
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
 * handler for incoming OPTIONS request (CORS pre-flight request)
 * @private
 */
Server.prototype.OPTIONS = function (request, response) {
    "use strict";

    console.log("OPTIONS",request.headers);
    response.setHeader("Allow", "OPTIONS,POST,GET");
    // Allow cross-domain posting
    response.setHeader("Access-Control-Allow-Origin", request.headers.origin);
    response.setHeader("Access-Control-Allow-Methods", "POST,GET");
    response.setHeader("Access-Control-Allow-Credentials", true);
    response.setHeader("Access-Control-Allow-Headers", "Authorization");
    response.end();
};

/**
 * handler for incoming GET request
 * @private
 */
Server.prototype.GET = function (request, response) {
    "use strict";

    if (!this.authenticate(request, response))
        return;
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
    if (!self.authenticate(request, response))
        return;
    var chunks = [];
    if (debug)
        console.debug(request.headers);
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
    [ "", "docroot=ARG", "Absolute path to server documents" ],
    [ "", "port=ARG", "Port to run the server on" ],
    [ "", "log", "Log requests to the console" ],
    
    [ "", "cert=ARG", "SSL certificate (filename or text)" ],
    [ "", "key=ARG", "SSL key (filename or text)" ],

    [ "", "user=ARG", "BasicAuth username" ],
    [ "", "pass=ARG", "BasicAuth password" ],
    [ "", "realm=ARG", "BasicAuth realm" ],
    
    [ "d", "debug", "Extra debug info to console" ],
    [ "h", "help", "Show this help" ]
])
    .bindHelp()
    .setHelp("Simple HTTP server with\n[[OPTIONS]]")
    .parseSystem()
    .options;
var params = {
    docroot: cliopt.docroot || ".",
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
