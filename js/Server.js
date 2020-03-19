/*@preserve Copyright (C) 2015-2019 Crawford Currie http://c-dot.co.uk license MIT*/
/* eslint-env node */

// Yes, I could have used express, but I wrote this before I knew about
// it, and it "just works". Only handles binary files, but knows about CORS.

define("js/Server", ["url", "extend", "fs-extra"], function(Url, extend, Fs) {

    //require("https") done dynamically
    //require("http") done dynamically
    //require("basicauth") done dynamically

    /**
     * Lightweight HTTP(S) server object (singleton) with very few
     * dependencies. Only supports PUT and GET and Basic auth
     * The server sits on the selected port and processes GET and PUT
     * requests.
     * @param proto Parameter hash. Legal params are:
     *    port: Port to run the server on, defaults to 3000
     *    docroot: absolute path to the document root. Defaults to the
     *             current directory when the server is run.
     *    writable: path to subdirectory of the document root that is writable.
     *              If this is set, only the writable directory can be PUT to.
     *              if it is not set, anywhere under the docroot can be written to.
     *    ssl: SSL configuration
     *        cert: SSL certificate (filename or text, required for SSL)
     *        key: SSL key (filename or text, required for SSL)
     *    auth: Basic auth to access the server
     *        user: Username (required for Basic Auth)
     *        pass: Password (required for Basic Auth)
     *        realm: Authentication realm (required for Basic Auth)
     *    debug: function for verbose debugging
     *    log: function for request reporting
     * @class
     */
    class Server {

        constructor(p) {
            let self = this;

            extend(this, p);

            self.ready = false;
            if (typeof self.docroot === "string")
                self.docroot = Fs.realpathSync(self.docroot);
            else
                self.docroot = process.cwd();

            if (typeof self.writable === "string") {
                if (self.writable.indexOf("/") !== 0)
                    self.writable = `${self.docroot}/${self.writable}`;
                self.writable = Fs.realpathSync(self.writable);
            }

            if (typeof this.auth !== "undefined") {
                self.authenticate = function (request, response) {
                    let BasicAuth = require("basic-auth");
                    let credentials = BasicAuth(request);
                    if (typeof credentials === "undefined" ||
                        credentials.name !== self.auth.user ||
                        credentials.pass !== self.auth.pass) {
                        if (self.debug) {
                            if (credentials) {
                                self.debug(
									`User ${credentials.name}`,
                                    "is trying to log in with password",
									`'${credentials.pass}'`);
							}
                        } else if (self.log)
                            self.log("No credentials in request");
                        if (self.log)
                            self.log("Authentication failed ", request.url);
                        response.statusCode = 401;
                        response.setHeader('WWW-Authenticate', 'Basic realm="' +
                                           self.auth.realm + '"');
                        response.end('Access denied');
                        return false;
                    }
                    if (self.debug)
                        self.debug(`User '${credentials.name}' is authenticated`);
                    return true;
                };
            } else
                self.authenticate = function () {
                    return true;
                };
        }

        /**
         * Get a promise to start the server.
         * @return {Promise} a promise to start the server
         */
        start() {
            let self = this;

            let handler = function (request, response) {
                if (self.log)
                    self.log(request.method, " ", request.url,
                                "from", request.headers);

                if (self[request.method]) {
                    self[request.method].call(self, request, response);
                } else {
                    response.statusCode = 405;
                    response.write(`No support for ${request.method}`);
                    response.end();
                }
            };

            console.log("Starting server on port", self.port);
            console.log(` Document root '${self.docroot}'`);
            if (self.writable)
                console.log(` Writable directory '${self.writable}'`);
            if (self.auth)
                console.log(" Auth", self.auth);
            else
                console.log(" No auth");

            if (typeof self.port === "undefined")
                self.port = 3000;

            if (typeof self.auth !== "undefined" && self.debug)
                self.debug("- requires authentication");

			let promise;
            if (typeof this.ssl !== "undefined") {
                let options = {};
				let promises = [
					Fs.pathExists(self.ssl.key)
					.then((exists) => {
						if (exists)
							return Fs.readFile(self.ssl.key);
						else
							return self.ssl.key;
					})
					.then(function (k) {
						options.key = k.toString();
						if (self.debug) self.debug("SSL key loaded");
					}),
					Fs.pathExists(self.ssl.cert)
					.then((exists) => {
						if (exists)
							return Fs.readFile(self.ssl.cert);
						else
							return self.ssl.cert;
					})
					.then(function (c) {
						options.cert = c.toString();
						if (self.debug) self.debug("SSL certificate loaded");
					})
				];

				promise = Promise.all(promises)
                .then(function () {
					if (self.log) self.log("HTTPS starting on port", self.port);
                    return require("https").createServer(options, handler);
                });
            } else {
                if (self.log) self.log("HTTP starting on port", self.port);
                promise = require("http").createServer(handler);
            }

            return promise
            .then((httpot) => {
                self.ready = true;
                self.http = httpot;
                httpot.listen(self.port);
            });
        }

        stop() {
            if (this.debug) this.debug("Stopping server on port", this.port);
            this.http.close();
        }

        _addCORSHeaders(request, response) {
            response.setHeader("Allow", "OPTIONS,PUT,GET");
            if (request.headers.origin)
                response.setHeader("Access-Control-Allow-Origin",
                                   request.headers.origin);
            else
                response.setHeader("Access-Control-Allow-Origin", "*");
            response.setHeader("Access-Control-Allow-Methods", "PUT,GET");
            response.setHeader("Access-Control-Allow-Credentials", "true");
            response.setHeader("Access-Control-Allow-Headers", "Authorization");
        }

        /**
         * Common handling for PUT or GET
         * @private
         */
        handle(request, response, promise, data) {
            let self = this;
            let contentType = "text/plain";

            function handleResponse(responseBody) {
                if (self.debug) {
                    // Don't cache when debugging.
                    response.setHeader("Cache-Control", "no-cache");
                    response.setHeader("Cache-Control", "no-store");
                }

                if (responseBody) {
                    response.setHeader("Content-Type", contentType);
                    response.setHeader("Content-Length",
                                       Buffer.byteLength(responseBody));
                    if (self.debug) self.debug(
                        "Responding with",
                        Buffer.byteLength(responseBody), "bytes");
                    response.write(responseBody);
                }
                response.statusCode = 200;
                if (self.debug) self.debug("Response code 200 ", response.getHeaders());
                response.end();
            }

            function handleError(error) {
                // Send the error message in the payload
                if (error.code === "ENOENT") {
                    if (self.debug) self.debug(error);
                    response.statusCode = 404;
                } else {
                    if (self.log) self.log(error);
                    if (self.debug) self.debug(error.stack);
                    response.statusCode = 500;
                }
                let e = error.toString();
                response.write(e);
                response.end(e);
            }

            if (!this.authenticate(request, response))
                return;

            if (!this.ready) {
                // Not ready
                response.statusCode = 503;
                response.write("Not ready");
                response.end();
                return;
            }

            let req = Url.parse(`${request.url}`, true);

            // Get file path
            let spath = req.pathname;
            if (spath.indexOf("/") !== 0 || spath.length === 0) {
                self.debug("ROOT or relative path GET");
                response.statusCode = 400;
                response.end();
                return;
            }
            spath = this.docroot + spath;

            if (request.method === "GET") {
                let m = /\.([A-Z0-9]+)$/i.exec(spath);
                if (m) {
                    let Mime = require("mime-types");
                    contentType = Mime.lookup(m[1]) || "application/octet-stream";
                } else {
                    contentType = "application/octet-stream";
                }
            } else if (request.method === "PUT") {
                if (this.writable && spath.indexOf(this.writable) !== 0) {
                    if (self.debug)
                        self.debug(
							`Trying to write '${spath}' in read-only area. Expected /^${this.writable}/`);
                    response.statusCode = 403;
                    response.end();
                    return;
                }
            }

            self._addCORSHeaders(request, response);

            try {
                promise(spath, data)
                .then(handleResponse, handleError);
            } catch (e) {
                if (self.debug) self.debug(e, " in ", request.url, "\n",
                              typeof e.stack !== "undefined" ? e.stack : e);
                response.write(`${e} in ${request.url}\n`);
                response.statusCode = 400;
                response.end();
            }
        }

        /**
         * handler for incoming OPTIONS request (tuned for CORS pre-flight request)
         * @private
         */
        OPTIONS(request, response) {
            this._addCORSHeaders(request, response);
            response.end();
        }

        /**
         * handler for incoming GET request
         * @private
         */
        GET(request, response) {
            this.handle(request, response,
                        function (path) {
                            return Fs.readFile(path);
                        });
        }

        /**
         * Handler for incoming PUT request
         * @private
         */
        PUT(request, response) {
            let self = this;

            let chunks = [];
            if (self.debug)
                self.debug(request.headers);
            request.on("data", function (chunk) {
                chunks.push(chunk);
            }).on("end", function () {
                let body = Buffer.concat(chunks);
                self.handle(request, response,
                            function (path, data) {
                                return Fs.writeFile(path, data);
                            }, body);
            });
        }
    }
    return Server;
});
