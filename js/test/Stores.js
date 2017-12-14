/*eslint-env node, mocha */

const TESTR = "1234567";
const DATASIZE = 89344;

var store;
var test_path = "test.dat";

if (typeof module !== "undefined") {
    var assert = require("chai").assert;
    var Utils = require("../Utils");
} else
    assert = chai.assert;

function test_writeArrayBuffer(store) {
    return new Promise(function(resolve, reject) {
        // Deliberately make it an odd length to throw off 16-bit-assuming
        // conversions
        //console.log("writeArrayBuffer " + store.options().identifier);
        var a = new Uint8Array(DATASIZE);
        for (var i = 0; i < DATASIZE; i++)
            a[i] = (i+1) & 255;
        store.write(
            test_path,
            a.buffer,
            function() {
                assert(this === store, "Wrong this");
                resolve(store);
            },
            reject);
    });
}

function test_readArrayBuffer(store) {
    return new Promise(function(resolve, reject) {
        //console.log("readArrayBuffer " + store.options().identifier);
        store.read(
            test_path,
            function(ab) {
                assert(this === store, "Wrong this");
                var a = new Uint8Array(ab);
                assert.equal(a.length, DATASIZE);
                for (var i = 0; i < DATASIZE; i++)
                    assert.equal(a[i], ((i + 1) & 255));
                resolve(store);
            },
            reject
        );
    });
}

// Write/read empty buffer
function test_write0(store) {
    return new Promise(function(resolve, reject) {
        //console.log("write0 " + store.options().identifier);
        var a = new Uint8Array(0);
        store.write(
            test_path,
            a.buffer,
            function() {
                resolve(store);
            },
            reject
        );
    });
}

function test_read0(store) {
    return new Promise(function(resolve, reject) {
        //console.log("read0 " + store.options().identifier);
        store.read(
            test_path,
            function(ab) {
                assert.equal(this, store);
                assert.equal(ab.byteLength, 0);
                resolve(store);
            },
            reject);
    });
}

function test_writes(store) {
    return new Promise(function(resolve, reject) {
        //console.log("writestring " + store.options().identifier);
        var a = TESTR;
        store.writes(
            test_path,
            a,
            function() {
                assert(this === store);
                resolve(store);
            },
            reject);
    });
}

function test_reads(store) {
    return new Promise(function(resolve, reject) {
        //console.log("readstring " + store.options().identifier);
        store.reads(
            test_path,
            function(str) {
                assert(this === store);
                assert.equal(str, TESTR);
                resolve(store);
            },
            reject);
    });
}

function test_store(/*store classes...*/) {
    "use strict";

    var store;
    var promise = Promise.resolve();
    
    var p = {
        ok: function() {
            var store = this;
            store.pass("x");
            promise = promise
            .then(function() {
                assert(store, "No store!");
                return test_writeArrayBuffer(store)
                    .then(function() {
                        return test_readArrayBuffer(store);
                    });
            })
            .then(function() {
                return test_write0(store).then(function(store) {
                    return test_read0(store);
                });
            })
            .then(function() {
                return test_writes(store).then(function(store) {
                    return test_reads(store);
                });
            });
        },
        fail: function(e) {
            assert(false, "store creation failed " + e);
        },
        identify: function(passed) {
            passed("testuser", "123pass456");
        },
    };
    
    var storeclasses = arguments;
    for (var i = arguments.length - 1; i >= 0; i--) {
        var storeClass = arguments[i];

        if (store) {
            p.understore = function(p) {
                return store;
            };
        }

        store = new storeClass(p);
    }
    promise = promise.catch(function(e) {
        assert(false, e + e.message + "\n" + e.stack);
    });
    return promise;
}

if (typeof module !== "undefined") {
    // Test FileStore and EncryptedStore, and by implication AbstractStore
    // and LayeredSTore as well.
    describe("node.js Stores", function() {
        it("FileStore", function() {
            return test_store(require("../FileStore"));
        });
        it("EncyryptedStore:FileStore", function() {
            return test_store(
                require("../EncryptedStore"),
                require("../FileStore"));
        });
    });
} else {
    // Test LocalStorageStore, and whatever has declared itself as
    // "CLOUD_STORE" by being included in the HTML

    describe("browser Stores", function() {
        it("LocalStorageStore", function() {
            return test_store(LocalStorageStore);
        });
        it("CloudStore", function() {
            return test_store(global.CLOUD_STORE);
        });
        it("CloudStore with Steganography", function() {
            return test_store(StegaStore, global.CLOUD_STORE);
        });
    });
}

