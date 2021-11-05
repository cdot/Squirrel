/*@preserve Copyright (C) 2018-2019 Crawford Currie http://c-dot.co.uk license MIT*/
/* eslint-env shared-node-browser */

define("js/HttpServerStore", [
	"js/Serror", "js/Utils", "js/AbstractStore"
], (Serror,      Utils,      AbstractStore) => {
    if (typeof XMLHttpRequest === "undefined") {
        // node.js
        XMLHttpRequest = require("xhr2");
        ///* global URL: true */
        //URL = require('url-parse');
    }

    /**
     * 'cloud' store using ajax to communicate with a remote file server
     * e.g.  the node.js.server store included in the Squirrel
     * distribution. Or node simple-server python -m SimpleHTTPServer 3000
     * Or lighttpd nginx apache server etc. Or a simple server built using
     * express.
	 * @extends AbstractStore
     */

    class HttpServerStore extends AbstractStore {

		/**
		 * {@link AbstractStore} for an explanation of parameters.
		 * Sets `options.needs_url`
		 */
        constructor(p) {
            super(p);
            this.option("needs_url", true);
            this.type = "HttpServerStore";
        }

        /**
         * Set Basic auth headers for {@link HttpServerStore#request}
		 * @param {object} headers headers for BasicAuth
         */
        addAuth(headers) {
            // Override auth if credentials are set
            if (this.option('net_user')) { // populated by login
                if (this.debug)
                    this.debug("addAuth: Using BasicAuth", this.option('net_user'));
                // Not happy about caching this
                headers.Authorization = 'Basic '
                + btoa(this.option('net_user') + ':' + this.option('net_pass'));
            } else if (this.debug)
                this.debug("addAuth: No auth header");
        }

        /**
         * Performs a HTTP request, and returns a Promise. Note that the
         * response is handled as an Uint8Array, it is up to the caller
         * to transform that to any other type.
         * @param {string} method HTTP method e.g. GET
         * @param {string} url Relative or absolute url
         * @param {Object} headers HTTP headers
         * @param {string|Uint8Array} body request body
         * @return {Promise} a promise which will be resolved with
         * {status:, xhr:, body:}
		 * @protected
         */
        request(method, url, headers, body) {
            let self = this;

            // We would like to use the features of jQuery.ajax, but
            // by default it doesn't handle binary files. We could add
            // a jQuery transport, as described in
            // https://stackoverflow.com/questions/33902299/using-jquery-ajax-to-download-a-binary-file
            // but that's more work than simply using XMLHttpRequest

            headers = headers || {};
            this.addAuth(headers);

            let turl;
            let base = self.option("url");
            if (base && base.length > 0) {
                if (/\w$/.test(base))
                    base += "/";
                turl = new URL(url, base);
            } else
                turl = new URL(url);

            return new Promise(function(resolve, reject) {
                let xhr = new XMLHttpRequest();

                // for binary data (does nothing in node.js)
                xhr.responseType = "arraybuffer";
                xhr.open(method, turl.toString(), true);

                for (let ii in headers) {
                    xhr.setRequestHeader(ii, headers[ii]);
                }

                // Workaround for Edge
                try {
                    if (body === undefined)
                        xhr.send();
                    else {
                        xhr.send(body);
                    }
                } catch (e) {
                    reject(self.error(500, turl.split("/"),
                                      `xhr.send error: ${e}`));
                }

                xhr.onload = function() {
                    if (self.debug) self.debug("response",xhr.status);
                    if (xhr.status === 401) {
                        let handler = self.option("network_login");
                        if (typeof handler === "function") {
							if (self.debug) self.debug("handling 401");
                            handler()
                            .then((login) => {
                                resolve(self.request(method, url, headers, body));
                            });
                            return;
                        } else if (self.debug) self.debug("No 401 handler");
                    }

                    resolve({
                        body: new Uint8Array(xhr.response),
                        status: xhr.status,
                        xhr: xhr
                    });
                };

                xhr.ontimeout = function() {
                    reject(new Serror(408, 'Timeout exceeded'));
                };
            });
        }

        /**
         * Return a promise to make a folder.
         * Subclasses override to provide specific path creation steps.
         * @param path {String} Relative or absolute path to folder
         * @throws Serror if anything goes wrong
		 * @return {Promise} resolves if all went well
         */
        mkpath(/*path*/) {
            return Promise.resolve();
        }

        /**
		 * @Override
		 */
        read(path) {
            if (this.debug) this.debug("read", path);
            return this.request("GET", path)
            .then((res) => {
                if (200 <= res.status && res.status < 300)
                    return res.body;
                throw new Serror(res.status, path + " read failed");
            });
        }

        /**
		 * @Override
		 */
        reads(path) {
			return this.read(path)
			.then(buff => Utils.Uint8ArrayToString(buff));
		}

        /**
		 * @Override
		 */
        write(path, data) {
            if (this.debug) this.debug("write", path);
            let pathbits = path.split('/');
            let folder = pathbits.slice(0, pathbits.length - 1);
            return this.mkpath(folder.join('/'))
            .then(() => this.request('PUT', path, {}, data))
            .then((res) => {
                if (res.status < 200 || res.status >= 300)
                    throw new Serror(res.status, path + " write failed");
            });
        }

        /**
		 * @Override
		 */
        writes(path, data) {
			return this.write(path, Utils.StringToUint8Array(data));
		}
    }

    return HttpServerStore;
});
