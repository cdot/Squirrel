/*@preserve Copyright (C) 2015-2019 Crawford Currie http://c-dot.co.uk license MIT*/

if (typeof module !== "undefined") {
    Utils = require("../src/Utils");
    chai = require("chai");
}

assert = chai.assert;
const TESTR = "1234567普通话/普通話العَرَبِيَّة";

// Deliberately make it an odd length to throw off 16-bit-assuming
// conversions
const DATASIZE = 255;//89345;

var store;
var test_path = "test.dat";

/*function block(a,s,e) {
    let r = [];
    for (let i = s; i < e; i++)
        r.push(a[i]);
    return r;
}*/

var URL;
var DEBUG = function() {console.log.apply(this, arguments);};

function test_store(storeClasses, url) {
    let store;
    let p = Promise.resolve();

    // Starting from the end of the class list, construct store objects
    for (let i = storeClasses.length - 1; i >= 0; i--) {
        let storeClass = storeClasses[i];
        let sc;
        try {
            sc = eval(storeClass);
            p = Promise.resolve(sc);
        } catch (e) {
            DEBUG("Require", storeClass);
            p = p.then(() => {
                return require("../src/" + storeClass + ".js");
            });
        }
        p = p.then((module) => {
            store = new module({
                debug: DEBUG,
                understore: store
            });
        });
    }
    return p.then(() => {
        if (store.option("needs_user")
            || store.constructor.name == "LocalStorageStore")
            store.option("user", "SillyBilly");
        if (store.option("needs_path"))
            store.option("path", "/numb/nuts");
        if (store.option("needs_pass"))
            store.option("pass", "Th15 15 a 51LLy P*$$w1Rd");
        if (store.option("needs_url"))
            store.option("url", url);
        return store
            .init()
            .then(() => {
                DEBUG("Write 0");
                let a = new Uint8Array(0);
                return store.write(test_path, a.buffer);
            })
            .then(() => {
                DEBUG("Read 0");
                return store.read(test_path).then((ab) => {
                    assert.equal(ab.byteLength, 0);
                });
            })
            .then(() => {
                DEBUG("Read non-existant");
                return store.read("not/a/known/resource.dat").then((ab) => {
                    assert(false, "Non existant should not resolve");
                })
                .catch((se) => {
                    assert(se instanceof Serror);
                    assert(se.status === 404);
                });
            })
            .then(() => {
                DEBUG("Write string");
                return store.writes(test_path, TESTR);
            })
            .then(() => {
                DEBUG("Read string");
                return store.reads(test_path)
                    .then((str) => {
                        assert.equal(str, TESTR);
                    });
            })
            .then(() => {
                DEBUG("Write binary");
                // Write/read ArrayBuffer
                let a = new Uint8Array(DATASIZE);
                
                for (let i = 0; i < DATASIZE; i++)
                    a[i] = ((i + 1) & 0xFF);
                //DEBUG("W:",block(a,214,220));
                return store.write(test_path, a.buffer);
            })
            .then(() => {
                DEBUG("Read binary");
                return store.read(test_path)
                    .then((ab) => {
                        let a = new Uint8Array(ab);
                        assert.equal(a.length, DATASIZE);
                        //DEBUG("R:",block(a,214,220));
                        for (let i = 0; i < DATASIZE; i++)
                            assert.equal(a[i], ((i + 1) & 255), "Position " + i);
                    });
            });
    });
}

let qs;
if (typeof module !== "undefined") {
    console.log("P:",process.env.URLPARAMS);
    qs = Utils.parseURLParams(process.env.URLPARAMS);
} else {
    qs = Utils.parseURLParams(window.location.search.substring(1));
}

console.log(qs);

describe("Simple Stores", () => {   
    it("LocalStorageStore", function() {
        return test_store(["LocalStorageStore"]);
    });

    it("EncryptedStore", function() {
        return test_store(["EncryptedStore", "LocalStorageStore"]);
    });
});

describe("WebDAV Store", function() {
    if (!qs.webdav_url) {
        if (typeof module === "undefined") {
            // in browser
            let countdown = 60;
            this.timeout(countdown * 1000);
            let sid;
            function ping() {
                $("#countdown").text(countdown--);
                if (countdown >= 0)
                    sid = setTimeout(ping, 1000); 
            }
            ping();
            before(function(done) {
                    $("#webdav_run").on("click", function() {
                        clearTimeout(sid);
                        qs.webdav_url = $("#webdav_url").val();
                        done();
                    });
            });
        } else {
            console.log("No WebDAV url defined, skipping test");
            return;
        }
    }
    
    it("WebDAVStore", function() {
        console.debug("Testing WebDAVStore with " + qs.webdav_url);
        return test_store(["WebDAVStore"], qs.webdav_url);
    });
});

/*
    if (qs.http_url) {
        it("HttpServerStore", function() {
            return test_store(["HttpServerStore"], qs.http_url);
        });
    }
});
*/
