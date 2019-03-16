/*@preserve Copyright (C) 2018-2019 Crawford Currie http://c-dot.co.uk license MIT*/
/* eslint-env shared-node-browser */

define(["js/Serror", "js/AbstractStore"], function(Serror, AbstractStore) {
    if (typeof XMLHttpRequest === "undefined") {
        // node.js
        /* global XMLHttpRequest: true */
        XMLHttpRequest = require("xhr2");
        /* global btoa: true */
        btoa = require('btoa');
        /* global URL: true */
        URL = require('url-parse');
    }

    /**
     * 'cloud' store using ajax to communicate with a remote file server
     * e.g.  the node.js.server store included in the Squirrel
     * distribution. Or node simple-server python -m SimpleHTTPServer 3000
     * Or lighttpd nginx apache server etc. Or a simple server built using
     * express.
     */

    class HttpServerStore extends AbstractStore {

        constructor(p) {
            p = p || {};
            p.needs_url = true;
            p.type = "HttpServerStore";
            super(p);
        }

        /**
         * Overridable method to set auth headers for requests
         */
        addAuth(headers) {
            // Override auth if credentials are set
            let user = this.option("net_user");
            let pass = this.option("net_pass");
            if (typeof user !== "undefined") {
                if (this.debug) this.debug("addAuth: Using BasicAuth", user);
                headers.Authorization = 'Basic ' + btoa(user + ':' + pass);
            } else if (this.debug)
                this.debug("addAuth: No auth header");
        }
        
        /**
         * @protected
         * Performs a HTTP request, and returns a Promise. Note that the
         * response is handled as an Uint8Array, it is up to the caller
         * to transform that to any other type.
         * @param {string} method HTTP method e.g. GET
         * @param {string} url Relative or absolute url
         * @param {Object} headers HTTP headers
         * @param {string or Uint8Array} body request body
         * @return {Promise} a promise which will be resolved with
         * {status:, xhr:, body:}
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

                // Workaround for edge
                try {
                    if (body === undefined)
                        xhr.send();
                    else {
                        xhr.send(body);
                    }
                } catch (e) {
                    reject(new Serror(turl, 500, "xhr.send error: " + e));
                }

                xhr.onload = function() {
                    if (self.debug) self.debug("response",xhr.status);
                    if (xhr.status === 401) {
                        if (self.debug) self.debug("handling 401");
                        let handler = self.option("network_login");
                        if (typeof handler === "function") {
                            handler()
                            .then(() => {
                                resolve(self.request(method, url, headers, body));
                            });
                            return;
                        }
                    }

                    resolve({
                        body: new Uint8Array(xhr.response),
                        status: xhr.status,
                        xhr: xhr
                    });
                };

                xhr.ontimeout = function() {
                    reject(new Error('Timeout exceeded'));
                };
            });
        }

        /**
         * Return a promise to make a folder.
         * Subclasses can override to provide specific path creation steps.
         * @param path {String} Relative or absolute path to folder
         * @throws Serror if anything goes wrong
         */
        mkpath(/*path*/) {
            return Promise.resolve();
        }

        // @Override
        read(path) {
            return this.request("GET", path)
            .then((res) => {
                if (200 <= res.status && res.status < 300)
                    return res.body;
                throw this.error(path, res.status, "read failed");
            });
        }

        // @Override
        write(path, data) {
            if (this.debug) this.debug("Writing", path);
            let pathbits = path.split('/');
            let folder = pathbits.slice(0, pathbits.length - 1);
            return this.mkpath(folder.join('/'))
            .then(() => {
                return this.request('PUT', path, {}, data)
            })
            .then((res) => {
                if (res.status < 200 || res.status >= 300)
                    throw this.error(path, res.status, "write failed");
            });
        }
    }

    return HttpServerStore;
});
