/*@preserve Copyright (C) 2018 Crawford Currie http://c-dot.co.uk license MIT*/

/* global AbstractStore */

/**
 * Store on a remote webdav server
 * Requires libs/davclient.js
 */
if (typeof module !== "undefined") {
    var AbstractStore = require("./AbstractStore");
}

function WebDAVStore(params) {
    "use strict";
    params.url ||= global.URLPARAMS.url;

    if (!params.url)
        throw "No webdav_url defined, cannot start WebDAVStore";

    if (params.url.lastIndexOf('/') !== params.url.length - 1)
        params.url += '/';

    self.params = $.extend({}, params);

    AbstractStore.call(self, params);
}

global.CLOUD_STORE = WebDAVStore;

WebDAVStore.prototype = Object.create(AbstractStore.prototype);

/** url, username and password */
WebDAVStore.prototype._connect = function() {
    "use strict";

    if (self.DAV)
        return;
    
    var self = this;
    console.debug("WebDAVStore: connecting to", self.params.url);
    self.DAV = new dav.Client({
        baseUrl: self.params.url,
        userName: self.params.username,
        password: self.params.password
    });
};

WebDAVStore.prototype.read = function (path, ok, fail) {
    "use strict";

    this._connect();
    path = path.replace(/^\/+/, "");
    console.debug("WebDAVStore: Reading", path);
    return this.DAV.request('GET', path, {})
        .then((res) => {
            if (200 <= res.status && res.status < 300)
                ok.call(self, res.body);
            else
                fail.call(self, res.status);
        });
};

/**
 * Return a Promise to make the folder given by a path array.
 */
WebDAVStore.prototype._mkpath = function (path) {
    "use strict";

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
};

WebDAVStore.prototype.write = function (path, data, ok, fail) {
    "use strict";
    var self = this;
    
    console.debug("WebDAVStore: Writing", path);

    path = path.replace(/^\/+/, "").split('/');
    var folder = path.slice();
    folder.pop();
    
    self._mkpath(folder)
        .then(() => {
            self.DAV.request('PUT', path.join('/'), {}, data)
                .then((res) => {
                    if (200 <= res.status && res.status < 300)
                        ok.call(self, res.body);
                    else
                        ok.fail(self, res.status);
                });
        });
};

if (typeof module !== "undefined")
    module.exports = WebDAVStore;
