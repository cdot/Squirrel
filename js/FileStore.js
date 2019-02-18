/*@preserve Copyright (C) 2017-2019 Crawford Currie http://c-dot.co.uk license MIT*/

/* eslint-env node */
/* global global:true */

if (typeof fs === "undefined")
    fs = require("fs-extra");
if (typeof AbstractStore === "undefined")
    AbstractStore = require("./AbstractStore");

/**
 * A store engine using file store, used with node.js
 * @implements AbstractStore
 */
class FileStore extends AbstractStore {

    option(k, v) {
        if (k === "needs_path")
            return true;
        return super.option(k, v);
    }

    read(path) {
        return fs.readFile(path);
    }

    write(path, data) {
        // data is an ArrayBuffer so is already bytes
        return fs.writeFile(path, Buffer.from(data));
    }
}

if (typeof module !== "undefined")
    module.exports = FileStore;
