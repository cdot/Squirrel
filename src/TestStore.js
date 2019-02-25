/*@preserve Copyright (C) 2015 Crawford Currie http://c-dot.co.uk license MIT*/

/* global global:true */
/* global LocalStorageStore:true */

/**
 * Test ''cloud' store using LocalStorage in the browser
 */
if (typeof module !== "undefined")
    LocalStorageStore = require("../src/LocalStorageStore");

/**
 * A test store engine
 * @extends LocalStorageStore
 */
class TestStore extends LocalStorageStore {
    constructor(params) {
        super(params);
        this.option("user", "TestStore");
        this.option("pass", "x");
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
