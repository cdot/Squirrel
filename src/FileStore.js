/*@preserve Copyright (C) 2017-2019 Crawford Currie http://c-dot.co.uk license MIT*/
/* eslint-env node */

const fs = require("fs-extra");
const AbstractStore = require("../src/AbstractStore");

/**
 * A store engine using file store, used with node.js
 * @implements AbstractStore
 */
class FileStore extends AbstractStore {

    constructor(p) {
        super(p);
        this.option("type", "FileStore");
        this.option("needs_path", true);
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
