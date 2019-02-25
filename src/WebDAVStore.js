/*@preserve Copyright (C) 2018-2019 Crawford Currie http://c-dot.co.uk license MIT*/

/* global Utils:true */
/* global Serror:true */
/* global AbstractStore:true */
/* global WebDAVClient:true */
if (typeof module !== "undefined") {
    Utils = require("../src/Utils");
    AbstractStore = require("../src/AbstractStore");
    WebDAVClient = require("../src/WebDAVClient");
    Serror = require("../src/Serror");
}

/**
 * Store on a remote webdav server
 * Requires libs/davclient.js
 */
class WebDAVStore extends AbstractStore {

    constructor(p) {
        super(p);
        this.option("type", "WebDAVStore");
        this.option("needs_user", true);
        this.option("needs_pass", true);
        this.option("needs_url", true);
    }

    init() {
        let u = this.option("url");
        if (u.lastIndexOf('/') !== u.length - 1)
            u += '/';

        if (this.debug) this.debug("WebDAVStore: connecting to", u);
        this.DAV = new WebDAVClient({
            baseUrl: u,
            userName: this.option("user"),
            password: this.option("pass")
        });

        return super.init();
    }

    /**
     * Return a Promise to make the folder given by a path array.
     */
    _mkpath(path) {
        if (path.length === 0)
            return Promise.resolve(); // at the root, always exists

        let self = this;

        return this.DAV.request('PROPFIND', path.join('/'), { Depth: 1 })
            .then(
                (res) => {
                    if (200 <= res.status && res.status < 300) {
                        return Promise.resolve();
                    }
                    else if (res.status === 404) {
                        let p = path.slice();
                        p.pop();
                        return self._mkpath(p).then(() => {
                            return self.DAV.request('MKCOL', path.join('/'));
                        });
                    }
                    else
                        throw new Serror(path, res.status, "_mkpath failed");
                });
    }

    read(path) {
        if (this.debug) this.debug("WebDAVStore: Reading", path);
        path = path.replace(/^\/+/, "");
        return this.DAV.request('GET', path, {})
            .then((res) => {
                if (200 <= res.status && res.status < 300) {
                    if (typeof res.body === "undefined") {
                        res.body = Utils.StringToArrayBuffer(res.xhr.responseText);
                        // convert UTF8 byte string to ArrayBuffer
                    }
                    return res.body;
                }
                throw new Serror(path, res.status, "Read failed");
            });
    }

    write(path, data) {
        if (this.debug) this.debug("WebDAVStore: Writing", path);
        path = path.replace(/^\/+/, "").split('/');
        let folder = path.slice();
        folder.pop();
        this._mkpath(folder)
            .then(() => {
                return this.DAV.request(
                    'PUT', path.join('/'), {},
                    // Note special buffer handling for node.js
                    typeof module !== "undefined" ? Buffer.from(data) : data)

                    .then((res) => {
                        if (200 > res.status || res.status >= 300)
                            throw new Serror(path, res.status);
                        return res.body;
                    });
            });
    }
}

if (typeof module !== "undefined")
    module.exports = WebDAVStore;
