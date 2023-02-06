/*@preserve Copyright (C) 2015-2023 Crawford Currie http://c-dot.co.uk license MIT*/
/* eslint-env node */

import Url from "url";
import extend from "extend";
import { promises as Fs } from "fs";
import Path from "path";
import body_parser from "body-parser";
import Cors from "cors";
import Express from "express";
import BasicAuth from "express-basic-auth";

import BCrypt from "bcrypt";

function pw_hash(pw) {
  if (typeof pw === "undefined")
    return Promise.resolve(pw);
  else
    return BCrypt.hash(pw, 10);
}

function pw_compare(pw, hash) {
  if (typeof pw === "undefined")
    return Promise.resolve(typeof hash === "undefined");
  else
    return BCrypt.compare(pw, hash);
}

import Session from "express-session";
import SessionFileStore from "session-file-store";
import Passport from "passport";
import LocalStrategy from "passport-local";

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
    if (!this.docroot) {
      this.docroot = Path.normalize(
        `${import.meta.url}/../..`.replace(/^file:/, ""));
    }

    if (typeof this.writable === 'string') {
      if (this.writable.indexOf("/") !== 0)
        this.writable = `${this.docroot}/${this.writable}`;
    }
    this.express = new Express();
    this.express.use(Cors());

    // Debug report incoming requests
    this.express.use((req, res, next) => {
      if (this.debug) this.debug("Server:", req.method, req.url);
      next();
    });

    if (this.auth) {
      const passwords = {};
      passwords[this.auth.user] = this.auth.pass;
      this.express.use(BasicAuth({
        users: passwords,
        challenge: true,
        realm: this.auth.realm
      }));
    }

    this.express.use(Express.static(this.docroot));

    this.express.use(body_parser.raw({
      type: 'application/octet-stream', limit : '10mb'
    }));
    
    this.express.put("*", (req, res) => {
      const buf = new Buffer(req.body.toString('binary'),'binary');
      Fs.writeFile(`${this.docroot}${req.url}`, buf)
      .then(() => {
        res.status(200).end();
      });
    });
  }

  /**
   * Get a promise to start the server.
   * @return {Promise} a promise to start the server
   */
  start() {
    if (this.debug) {
      this.debug("Starting server on port", this.port);
      this.debug(` Document root '${this.docroot}'`);
      if (this.writable)
        this.debug(` Writable directory '${this.writable}'`);
      if (this.auth)
        this.debug(" Auth", this.auth);
      else
        this.debug(" No auth");
    }

    if (typeof this.port === 'undefined')
      this.port = 3000;

		let promise;
    if (this.ssl) {
      const options = {};
			const promises = [
				Fs.stat(this.ssl.key)
				.then(() => Fs.readFile(this.ssl.key))
				.catch(() => this.ssl.key)
				.then(k => {
					options.key = k.toString();
					if (this.debug) this.debug("SSL key loaded");
				}),
				Fs.stat(this.ssl.cert)
				.then(() => Fs.readFile(this.ssl.cert))
				.catch(() => this.ssl.cert)
				.then(c => {
					options.cert = c.toString();
					if (this.debug) this.debug("SSL certificate loaded");
				})
			];

			promise = Promise.all(promises)
      .then(() => {
				if (this.debug) this.debug("HTTPS starting on port", this.port);
        return import("https")
        .then(mod => mod.Server(options, this.express));
      });
    } else {
      if (this.debug) this.debug("HTTP starting on port", this.port);
      promise = import("http")
      .then(mod => mod.Server(this.express));
    }

    return promise
    .then(httpot => {
      this.ready = true;
      this.http = httpot;
      httpot.listen(this.port);
      if (this.debug) this.debug("Server started");
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

    if (!this.ready) {
      // Not ready
      response.statusCode = 503;
      response.write("Not ready");
      response.end();
      return;
    }

    this.authenticate(request, response)
    .then(() => {
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
        if (this.debug)
          this.debug(e, " in ", request.url, "\n",
                     typeof e.stack !== 'undefined' ? e.stack : e);
        response.write(`${e} in ${request.url}\n`);
        response.statusCode = 400;
        response.end();
      }
    });
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
    this.handle(request, response,
                (path, data) => {
                  if (this.debug) this.debug("Write", path, data);
                  return Fs.writeFile(path, data);
                },
							  request.body);
/**    request
		.on("data", chunk => chunks.push(chunk))
		.on("end", () => {
      const body = Buffer.concat(chunks);
      this.handle(request, response,
                  (path, data) => {
                    if (this.debug) this.debug("Write", path, data);
                    return Fs.writeFile(path, data);
                  },
							    body);
    });*/
  }
}

export { Server }
