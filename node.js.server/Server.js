/*@preserve Copyright (C) 2015-2018 Crawford Currie http://c-dot.co.uk license MIT*/

/*eslint-env node */

// Yes, I could have used express, but I wrote this before I knew about
// it, and it "just works". Only handles binary files, but knows about CORS.

"use strict";

const Q = require("q");
const Url = require("url");
const extend = require('extend');
const Fs = require("fs");

//require("https") done dynamically
//require("http") done dynamically
//require("basicauth") done dynamically

// Promise interface to file read/write
var readFile = Q.denodeify(Fs.readFile);
var writeFile = Q.denodeify(Fs.writeFile);

/**
 * Lightweight HTTP(S) server object (singleton) with very few
 * dependencies. Only supports POST and GET and Basic auth
 * The server sits on the selected port and processes GET and POST
 * requests.
 * @param proto Parameter hash. Legal params are:
 *    port: Port to run the server on, defaults to 3000
 *    docroot: absolute path to the document root. Defaults to the
 *             current directory when the server is run.
 *    writable: path to subdirectory of the document root that is writable.
 *              If this is set, only the writable directory can be POSTed to.
 *              if it is not set, anywhere under the docroot can be written to.
 *    ssl: SSL configuration
 *        cert: SSL certificate (filename or text, required for SSL)
 *        key: SSL key (filename or text, required for SSL)
 *    auth: Basic auth to access the server
 *        user: Username (required for Basic Auth)
 *        pass: Password (required for Basic Auth)
 *        realm: Authentication realm (required for Basic Auth)
 *    debug: enable verbose debugging to the console
 *    log_requests: enable request reporting
 * @class
 */
function Server(proto) {

    extend(this, proto);

    var self = this;

    self.ready = false;
    if (typeof self.docroot === "string")
        self.docroot = Fs.realpathSync(self.docroot);
    else
        self.docroot = process.cwd();

    if (typeof self.writable === "string") {
        if (self.writable.indexOf("/") !== 0)
            self.writable = self.docroot + "/" + self.writable;
        self.writable = Fs.realpathSync(self.writable);
    }

    if (typeof this.auth !== "undefined") {
        self.authenticate = function (request, response) {
            var BasicAuth = require("basic-auth");
            var credentials = BasicAuth(request);
            if (typeof credentials === "undefined" ||
                credentials.name !== self.auth.user ||
                credentials.pass !== self.auth.pass) {
                if (self.debug) {
                    if (credentials)
                        console.log("User ", credentials.name,
                            " is trying to log in with password '" +
                            credentials.pass + "'");
                } else if (self.log_requests)
                    console.log("No credentials in request");
                if (self.log_requests)
                    console.log("Authentication failed ", request.url);
                response.statusCode = 401;
                response.setHeader('WWW-Authenticate', 'Basic realm="' +
                    self.auth.realm + '"');
                response.end('Access denied');
                return false;
            }
            if (self.debug)
                console.log("User '" + credentials.name +
                    "' is authenticated");
            return true;
        };
    } else
        self.authenticate = function () {
            return true;
        }
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

    if (this.debug) {
        console.log("Starting server on port", self.port);
        console.log(" docroot '" + self.docroot + "'");
        console.log(" writable '" + self.writable + "'");
        console.log(" auth", self.auth);
    }

    if (typeof self.port === "undefined")
        self.port = 3000;

    if (typeof self.auth !== "undefined" && self.debug)
        console.log("- requires authentication");

    var promise = Q();

    if (typeof this.ssl !== "undefined") {
        var options = {};

        promise = promise

            .then(function () {
                return self.ssl.key.read();
            })

            .then(function (k) {
                options.key = k;
                if (self.debug) console.log("SSL key loaded");
            })

            .then(function () {
                return self.ssl.cert.read();
            })

            .then(function (c) {
                options.cert = c;
                if (self.debug) console.log("SSL certificate loaded");
                console.log("HTTPS starting on port", self.port);
            })

            .then(function () {
                return require("https").createServer(options, handler);
            });
    } else {
        console.log("HTTP starting on port", self.port);
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
    if (this.debug) console.log("Stopping server on port", this.port);
    this.http.close();
};

/**
 * Common handling for POST or GET
 * @private
 */
Server.prototype.handle = function (request, response, promise, data) {
    var self = this;

    if (this.log_requests)
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

    // Get file path
    var spath = req.pathname;
    if (spath.indexOf("/") !== 0 || spath.length === 0) {
        console.log("ROOT or relative path GET");
        response.statusCode = 400;
        response.end();
        return;
    }
    spath = this.docroot + spath;

    var contentType = "text/plain";
    if (request.method === "GET") {
        var m = /\.([A-Z0-9]+)$/i.exec(spath);
        if (m) {
            var Mime = require("mime-types");
            contentType = Mime.lookup(m[1]) || "application/octet-stream";
        } else {
            contentType = "application/octet-stream";
        }
    } else if (request.method === "POST") {
        if (this.writable && spath.indexOf(this.writable) !== 0) {
            if (self.debug)
                console.log("Trying to write '" + spath +
                    "' in read-only area. Expected /^" +
                    this.writable + "/");
            response.statusCode = 403;
            response.end();
            return;
        }
    }

    try {
        promise(spath, data)
            .then(function (responseBody) {
                    // Allow cross-domain posting. Do we need this? It's already
                    // done in the OPTIONS pre-flight
                    response.setHeader("Access-Control-Allow-Origin", "*");
                    response.setHeader("Access-Control-Allow-Methods", "POST,GET");

                    if (self.debug) {
                        response.setHeader("Cache-Control", "no-cache");
                        response.setHeader("Cache-Control", "no-store");
                    }

                    if (responseBody) {
                        response.setHeader("Content-Type", contentType);
                        response.setHeader("Content-Length",
                            Buffer.byteLength(responseBody));
                        if (self.debug) console.log(
                            "Responding with",
                            Buffer.byteLength(responseBody), "bytes");
                        response.write(responseBody);
                    }
                    response.statusCode = 200;
                    if (self.debug) console.log("Response code 200");
                    response.end();
                },
                function (error) {
                    // Send the error message in the payload
                    if (error.code === "ENOENT") {
                        if (self.debug) console.log(error);
                        response.statusCode = 404;
                    } else {
                        if (self.log_requests)
                            console.log(error);
                        if (self.debug)
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
    if (this.log_requests) console.log("OPTIONS", request.headers);

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
    this.handle(request, response,
        function (path) {
            return readFile(path);
        });
};

/**
 * Handler for incoming POST request
 * @private
 */
Server.prototype.POST = function (request, response) {
    var self = this;

    var chunks = [];
    if (self.debug)
        console.log(request.headers);
    request.on("data", function (chunk) {
        chunks.push(chunk);
    }).on("end", function () {
        var body = Buffer.concat(chunks);
        self.handle(request, response,
            function (path, data) {
                return writeFile(path, data);
            }, body);
    });
};