/*@preserve Copyright (C) 2017 Crawford Currie http://c-dot.co.uk license MIT*/

/* eslint-env node */
/* global global:true */

"use strict";

var Fs = require("fs");
var AbstractStore = require("./AbstractStore");

/**
 * A store engine using file store, used with node.js
 * @implements AbstractStore
 */
function FileStore(params) {
    if (params.user) {
        this.user(params.user);
    }

    AbstractStore.call(this, params);
}

FileStore.prototype = Object.create(AbstractStore.prototype);

FileStore.prototype.options = function () {
    var opt = {};
    var abs = AbstractStore.prototype.options();
    for (var i in abs) {
        opt[i] = abs[i];
    }
    opt.needs_path = true;
    opt.identifier = "file"

    return opt;
};

FileStore.prototype.read = function (path, ok, fail) {
    var self = this;
    Fs.readFile(path, function (err, data) {
        if (err)
            fail.call(self, err);
        else if (data === null)
            fail.call(self, AbstractStore.NODATA);
        else
            ok.call(self, data);
    })
};

FileStore.prototype.write = function (path, data, ok, fail) {
    var self = this;
    // data is an ArrayBuffer so is already bytes
    Fs.writeFile(path, Buffer.from(data), function (err) {
        if (err)
            fail.call(self, err);
        else
            ok.call(self);
    });
};

module.exports = FileStore;