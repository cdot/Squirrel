/*@preserve Copyright (C) 2018-2019 Crawford Currie http://c-dot.co.uk license MIT*/

/**
 * Store on a remote webdav server
 * Requires libs/davclient.js
 */
if (typeof AbstractStore === "undefined")
    AbstractStore = require("./AbstractStore");
if (typeof dav === "undefined")
    libs = require("../libs/davclient");

class WebDAVStore extends AbstractStore {

    constructor(p) {
        super(p);
    }

    init() {
        let u = this.option("url");
        if (u.lastIndexOf('/') !== u.length - 1)
            u += '/';

        if (this.debug) this.debug("WebDAVStore: connecting to", u);
        this.DAV = new dav.Client({
            baseUrl: u,
            userName: this.option("user"),
            password: this.option("pass")
        });

        return super.init();
    }

    option(k, v) {
        if (k === "needs_user" || k === "needs_pass" || k === "needs_url")
            return true;
        return super.option(k, v);
    }
    
    read(path) {
        path = path.replace(/^\/+/, "");
        if (this.debug) this.debug("WebDAVStore: Reading", path);
        return this.DAV.request('GET', path, {})
            .then((res) => {
                if (200 <= res.status && res.status < 300) {
                    if (typeof res.body === "undefined")
                        return new ArrayBuffer();
                    return res.body;
                }
                throw new Error(res.status);
            });
    }

    /**
     * Return a Promise to make the folder given by a path array.
     */
    _mkpath(path) {
        if (path.length === 0)
            return Promise.resolve(); // at the root, always exists

        var self = this;

        return this.DAV.request('PROPFIND', path.join('/'), { Depth: 1 })
            .then(
                (res) => {
                    if (200 <= res.status && res.status < 300) {
                        return Promise.resolve();
                    }
                    else if (res.status === 404) {
                        var p = path.slice();
                        p.pop();
                        return self._mkpath(p).then(() => {
                            return self.DAV.request('MKCOL', path.join('/'));
                        });
                    }
                    else
                        return Promise.reject(
                            "_mkpath failed on " + path.join('.')
                                + ": " + res.status);
                });
    }

    write(path, data) {
        if (this.debug) this.debug("WebDAVStore: Writing", path);
        path = path.replace(/^\/+/, "").split('/');
        var folder = path.slice();
        folder.pop();
        this._mkpath(folder)
            .then(() => {
                // SMELL: this used to be data, not data.buffer, and it
                // worked in the browser. Need to re-verify it works this
                // way.
                return this.DAV.request('PUT', path.join('/'), {},
                                        Utils.ArrayBufferToString(data))
                    .then((res) => {
                        if (200 <= res.status && res.status < 300)
                            return res.body;
                        throw new Error(res.status);
                    });
            });
    }
}

if (typeof module !== "undefined")
    module.exports = WebDAVStore;
