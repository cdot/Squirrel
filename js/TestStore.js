/*@preserve Copyright (C) 2015 Crawford Currie http://c-dot.co.uk license MIT*/

/* global global:true */
/* global LocalStorageStore */

/**
 * Test ''cloud' store using LocalStorage in the browser
 */
if (typeof LocalStorageStore === "undefined")
    LocalStorageStore = require("./LocalStorageStore");

/**
 * A test store engine
 * @extends LocalStorageStore
 */
class TestStore extends LocalStorageStore {
    constructor(params) {
        params.user = "TestStore";
        super(params);
    }

    options(k, v) {
        if (typeof this.params[k] !== "undefined")
            return this.params[k];
        return super.options(k, v);
    }

    readfunction(path) {
        return super.read("TestStore" + path);
    }

    write(path, data) {
        return super.write("TestStore" + path, data);
    }
}

if (typeof module !== "undefined")
    module.exports = TestStore;
