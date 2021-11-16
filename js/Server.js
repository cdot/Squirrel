/*@preserve Copyright (C) 2015-2019 Crawford Currie http://c-dot.co.uk license MIT*/
/* eslint-env node */

// Yes, I could have used express, but I wrote this before I knew about
// it, and it "just works". Only handles binary files, but knows about CORS.

define("js/Server", ["url", "extend", "fs"], (Url, extend, fs) => {

	const Fs = fs.promises;

    //require("https") done dynamically
    //require("http") done dynamically
    //require("basicauth") done dynamically

    /**
     * Lightweight HTTP(S) server object (singleton) with very few
     * dependencies. Only supports PUT and GET and Basic auth The
     * server sits on the selected port and processes GET and PUT
     * requests.
     */
    class Server {

		/**
		 * @param {object} proto Parameter hash.
		 * @param {number} proto.port Port to run the server on,
		 * defaults to 3000
		 * @param {string} proto.docroot absolute path to the document
		 * root. Defaults to the current directory when the server is run.
		 * @param {string} proto.writable path to subdirectory of the
		 * document root that is writable.  If this is set, only the
		 * writable directory can be PUT to.  if it is not set, anywhere
		 * under the docroot can be written to.
		 * @param {object} proto.ssl SSL configuration
		 * @param {string} proto.ssl.cert SSL certificate (filename or
		 * text, required for SSL)
		 * @param {string} proto.ssl.key SSL key (filename or text,
		 * required for SSL)
		 * @param {object} proto.auth Basic auth to access the server
		 * @param {string} proto.auth.user Username (required for Basic Auth)
		 * @param {string} proto.auth.pass Password (required for Basic Auth)
		 * @param {string} proto.auth.realm Authentication realm (required
		 * for Basic Auth)
		 * @param {function} proto.debug function for verbose debugging
		 * @param {function} proto.log function for request reporting
		 */
        constructor(p) {

            extend(this, p);

            this.ready = false;
            if (typeof this.docroot === "string")
                this.docroot = fs.realpathSync(this.docroot);
            else
                this.docroot = process.cwd();

            if (typeof this.writable === "string") {
                if (this.writable.indexOf("/") !== 0)
                    this.writable = `${this.docroot}/${this.writable}`;
                this.writable = fs.realpathSync(this.writable);
            }

            if (typeof this.auth !== "undefined") {
                this.authenticate = (request, response) => {
                    const BasicAuth = require("basic-auth");
                    const credentials = BasicAuth(request);
                    if (typeof credentials === "undefined" ||
                        credentials.name !== this.auth.user ||
                        credentials.pass !== this.auth.pass) {
                        if (this.debug) {
                            if (credentials) {
                                this.debug(
									`User ${credentials.name}`,
                                    "is trying to log in with password",
									`'${credentials.pass}'`);
							}
                        } else if (this.log)
                            this.log("No credentials in request");
                        if (this.log)
                            this.log("Authentication failed ", request.url);
                        response.statusCode = 401;
                        response.setHeader('WWW-Authenticate', 'Basic realm="' +
                                           this.auth.realm + '"');
                        response.end('Access denied');
                        return false;
                    }
                    if (this.debug)
                        this.debug(`User '${credentials.name}' is authenticated`);
                    return true;
                };
            } else
                this.authenticate = () => true;
        }

        /**
         * Get a promise to start the server.
         * @return {Promise} a promise to start the server
         */
        start() {
            const handler = (request, response) => {
                if (this.log)
                    this.log(request.method, " ", request.url,
                                "from", request.headers);

                if (this[request.method]) {
                    this[request.method].call(this, request, response);
                } else {
                    response.statusCode = 405;
                    response.write(`No support for ${request.method}`);
                    response.end();
                }
            };

            console.log("Starting server on port", this.port);
            console.log(` Document root '${this.docroot}'`);
            if (this.writable)
                console.log(` Writable directory '${this.writable}'`);
            if (this.auth)
                console.log(" Auth", this.auth);
            else
                console.log(" No auth");

            if (typeof this.port === "undefined")
                this.port = 3000;

            if (typeof this.auth !== "undefined" && this.debug)
                this.debug("- requires authentication");

			let promise;
            if (typeof this.ssl !== "undefined") {
                const options = {};
				const promises = [
					Fs.pathExists(this.ssl.key)
					.then(exists =>
						  ((exists)
						   ? Fs.readFile(this.ssl.key)
						   : this.ssl.key))
					.then(k => {
						options.key = k.toString();
						if (this.debug) this.debug("SSL key loaded");
					}),
					Fs.pathExists(this.ssl.cert)
					.then(exists => (exists)
						  ? Fs.readFile(this.ssl.cert)
						  : this.ssl.cert)
					.then(c => {
						options.cert = c.toString();
						if (this.debug) this.debug("SSL certificate loaded");
					})
				];

				promise = Promise.all(promises)
                .then(() => {
					if (this.log) this.log("HTTPS starting on port", this.port);
                    return require("https").createServer(options, handler);
                });
            } else {
                if (this.log) this.log("HTTP starting on port", this.port);
                promise = Promise.resolve(require("http").createServer(handler));
            }

            return promise
            .then(httpot => {
                this.ready = true;
                this.http = httpot;
                httpot.listen(this.port);
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
            let contentType = "text/plain";

            const handleResponse = responseBody => {
                if (this.debug) {
                    // Don't cache when debugging.
                    response.setHeader("Cache-Control", "no-cache");
                    response.setHeader("Cache-Control", "no-store");
                }

                if (responseBody) {
                    response.setHeader("Content-Type", contentType);
                    response.setHeader("Content-Length",
                                       Buffer.byteLength(responseBody));
                    if (this.debug) this.debug(
                        Buffer.byteLength(responseBody), "bytes");
                    response.write(responseBody);
                }
                response.statusCode = 200;
                if (this.debug) this.debug("Response code 200 ", response.getHeaders());
                response.end();
            };

            const handleError = error => {
                // Send the error message in the payload
                if (error.code === "ENOENT") {
                    if (this.debug) this.debug(error);
                    response.statusCode = 404;
                } else {
                    if (this.log) this.log(error);
                    if (this.debug) this.debug(error.stack);
                    response.statusCode = 500;
                }
                const e = error.toString();
                response.write(e);
                response.end(e);
            };

            if (!this.authenticate(request, response))
                return;

            if (!this.ready) {
                // Not ready
                response.statusCode = 503;
                response.write("Not ready");
                response.end();
                return;
            }

            const req = Url.parse(`${request.url}`, true);

            // Get file path
            let spath = req.pathname;
            if (spath.indexOf("/") !== 0 || spath.length === 0) {
                this.debug("ROOT or relative path GET");
                response.statusCode = 400;
                response.end();
                return;
            }
            spath = this.docroot + spath;

            if (request.method === "GET") {
                const m = /\.([A-Z0-9]+)$/i.exec(spath);
                if (m) {
                    const Mime = require("mime-types");
                    contentType = Mime.lookup(m[1]) || "application/octet-stream";
                } else {
                    contentType = "application/octet-stream";
                }
            } else if (request.method === "PUT") {
                if (this.writable && spath.indexOf(this.writable) !== 0) {
                    if (this.debug)
                        this.debug(
							`Trying to write '${spath}' in read-only area. Expected /^${this.writable}/`);
                    response.statusCode = 403;
                    response.end();
                    return;
                }
            }

            this._addCORSHeaders(request, response);

            try {
                promise(spath, data)
                .then(handleResponse, handleError);
            } catch (e) {
                if (this.debug) this.debug(e, " in ", request.url, "\n",
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
                        path => Fs.readFile(path));
        }

        /**
         * Handler for incoming PUT request
         * @private
         */
        PUT(request, response) {
            const chunks = [];
            if (this.debug)
                this.debug(request.headers);
            request
			.on("data", chunk => chunks.push(chunk))
			.on("end", () => {
                const body = Buffer.concat(chunks);
                this.handle(request, response,
                            (path, data) => Fs.writeFile(path, data),
							body);
            });
        }
    }
    return Server;
});
