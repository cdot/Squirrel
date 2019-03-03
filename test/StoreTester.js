/*@preserve Copyright (C) 2015-2019 Crawford Currie http://c-dot.co.uk license MIT*/

/**
 * Shared code used in testing stores. Not a stand-alone test.
 */
const TESTR = "1234567普通话/普通話العَرَبِيَّة";

// Deliberately make it an odd length to throw off 16-bit-assuming
// conversions
const DATASIZE = 255;//89345;

var test_path = "test.dat";

const RIGHT = {
    user: "GoodUser",
    pass: "Th15 15 a g00d P*$$w1Rd"
};

const WRONG = {
    user: "BadUser",
    pass: "Th15 15 a b44d P*$$w1rd"
};

let deps = ["js/Utils", "js/Serror"];
// chai is included via a script tag in the browser, only need this
// for node.js
if (typeof chai === "undefined")
    deps.push("chai");

define(deps, function(Utils, Serror, chai_import) {
    if (typeof chai === "undefined")
        chai = chai_import;
    let assert = chai.assert;

    class StoreTester {

        constructor(storeClasses, debug) {
            let self = this;
            self.debug = debug;
            self.store = undefined;
            let p = Promise.resolve();
            
            // Starting from the end of the class list, construct store objects
            for (let i = storeClasses.length - 1; i >= 0; i--) {
                let storeClass = storeClasses[i];
                let sc;
                try {
                    sc = eval(storeClass);
                    p = Promise.resolve(sc);
                } catch (e) {
                    if (self.debug) self.debug("Require", storeClass);
                    p = p.then(function () {
                        return new Promise(function(res,rej) {
                            requirejs(["js/" + storeClass],
                                      function(module) {
                                          res(module);
                                      },
                                      function(e) {
                                          rej(e);
                                      });
                        });
                    });
                }
                p = p.then(function(module) {
                    self.store = new module({
                        debug: self.debug,
                        understore: self.store
                    });
                });
            }
            this.buildStore = p;
        }

        static user() {
            return RIGHT;
        }
        
        makeTests(describe, it) {
            let self = this;
            
            describe("Simple tests", function() {
                this.timeout(600000);
                
                it("Write/Read 1 byte", function(done) {
                    let a = new Uint8Array(1);
                    a[0] = 69;
                    self.store.write(test_path, a)
                    .then(function() {
                        self.store.read(test_path).then(function(ab) {
                            assert.equal(ab.length, 1);
                            assert.equal(Utils.Uint8ArrayToString(ab), String.fromCodePoint(69));
                            done();
                        });
                    });
                });
                
                it("Write/Read 0 bytes", function(done) {
                    let a = new Uint8Array(0);
                    self.store.write(test_path, a)
                    .then(function () {
                        return self.store.read(test_path).then(function(ab) {
                            assert.equal(ab.byteLength, 0);
                            done();
                        });
                    });
                });
                
                it("Read non-existant", function(done) {
                    self.store.read("not/a/known/resource.dat")
                    .then(function(ab) {
                        assert(false, "Non existant should not resolve");
                    })
                    .catch(function(se) {
                        assert(se instanceof Serror, se);
                        assert(se.status === 404);
                        done();
                    });
                });
                
                it("Write/Read string", function(done) {
                    self.store.writes(test_path, TESTR)
                    .then(function () {
                        self.store.reads(test_path)
                        .then(function(str) {
                            assert.equal(str, TESTR);
                            done();
                        });
                    });
                });

                it("Write/read binary", function(done) {
                    let a = new Uint8Array(DATASIZE);
                    
                    for (let i = 0; i < DATASIZE; i++)
                        a[i] = ((i + 1) & 0xFF);
                    //if (debug) debug("W:",block(a,214,220));
                    self.store.write(test_path, a)
                    .then(function () {
                        self.store.read(test_path)
                        .then(function(a) {
                            assert.equal(a.length, DATASIZE);
                            //if (debug) debug("R:",block(a,214,220));
                            for (let i = 0; i < DATASIZE; i++)
                                assert.equal(a[i], ((i + 1) & 255), "Position " + i);
                            done();
                        });
                    });
                });
            });
            
            if (self.store.option("needs_auth")) {
                describe("Network tests", function() {
                    it("Handles incorrect net user", function(done) {
                        self.store.writes(test_path, TESTR)
                            .then(function () {
                                // Switch off 401 handler
                                let h401 = self.store.option("get_auth");
                                self.store.option("get_auth", null);
                                let nu = self.store.option("net_user");
                                self.store.option("net_user", WRONG.user);
                                self.store.reads(test_path)
                                    .then(function(data) {
                                        assert(false, "Expected an error");
                                    })
                                    .catch(function(e) {
                                        assert(e instanceof Serror, "Not an serror "+e);
                                        assert.equal(e.status, 401);
                                        self.store.option("get_auth", h401);
                                        self.store.option("net_user", nu);
                                        done();
                                    });
                            });
                    });

                    it("Handles incorrect net pass", function(done) {
                        self.store.writes(test_path, TESTR)
                            .then(function () {
                                // Switch off 401 handler
                                let h401 = self.store.option("get_auth");
                                self.store.option("get_auth", null);
                                self.store.option("net_pass", WRONG.pass);
                                self.store.reads(test_path, TESTR)
                                .then(function(data) {
                                    assert(false, "Unexpected");
                                })
                                .catch(function(e) {
                                    assert(e instanceof Serror, "Not an serror "+e);
                                    assert.equal(e.status, 401);
                                    self.store.option("get_auth", h401);
                                    done();
                                });
                            });
                    });
                });
            }
                        
            if (self.store.option("needs_user")) {
                describe("Encryption user tests", function() {
                    it("Handles incorrect user", function(done) {

                        self.store.option("pass", RIGHT.pass);
                        self.store.writes(test_path, TESTR)
                            .then(function () {
                                self.store.option("user", WRONG.user);
                                return self.store.reads(test_path)
                                    .then(function(data) {
                                        assert(false, "Unexpected");
                                    })
                                    .catch(function(e) {
                                        assert(e instanceof Serror);
                                        assert.equal(e.status, 401);
                                    });
                            })
                            .then(function(data) {
                                assert.notEqual(data, TESTR);
                            })
                            .then(function () {
                                self.store.option("user", RIGHT.user);
                                return self.store.reads(test_path)
                                    .then(function(data) {
                                        assert.equal(data, TESTR);
                                        done();
                                    });
                            });
                    });
                });
            }
            
            if (self.store.option("needs_pass")) {
                describe("Encryption password tests", function() {
                    // Note this is testing encryption (needs_pass)
                    // not web authentication (needs_auth)
                    it("Handles incorrect password", function(done) {
                        if (!self.store.option("needs_pass")) {
                            console.debug("Nothing to do for:");
                            done();
                            return;
                        }

                        self.store.option("pass", RIGHT.pass);
                        self.store.writes(test_path, TESTR)
                        .then(function () {
                            self.store.option("pass", WRONG.pass);
                            return self.store.reads(test_path)
                            .then(function(data) {
                                assert(false, "Unexpected success "+data);
                            })
                            .catch(function(e) {
                                assert(e instanceof Serror);
                                assert.equal(e.status, 400);
                            });
                        })
                        .then(function(data) {
                            assert.notEqual(data, TESTR);
                        })
                        .then(function () {
                            self.store.option("pass", RIGHT.pass);
                            return self.store.reads(test_path)
                            .then(function(data) {
                                assert.equal(data, TESTR);
                                done();
                            });
                        });
                    });
                });
            }
        }
                        

        init(config) {
            let self = this;

            return this.buildStore.then(function () {
                let store = self.store; 

                if (store.option("needs_path"))
                    store.option("path", "/numb/nuts");
               
                const PROMPTABLE = { url: true, user: true, pass: true,
                                     net_user: true, net_pass: true };

                if (typeof global !== "undefined") {
                    if (self.debug) self.debug("node.js startup");
                    // node.js allows environment variables to override the
                    // store configuration
                    let remember = {};
                    for (let option in PROMPTABLE) {
                        let v = config[option];
                        if (typeof v === "undefined")
                            v = process.env["T_" + option];
                        if (typeof v === "undefined")
                            v = RIGHT[option];
                        if (self.debug) self.debug(option, v);
                        store.option(option, v);
                    }
                    // 401 handler, build credentials and pass back
                    store.option("get_auth", function() {
                        if (self.debug) self.debug("Called get_auth");
                        if (store.option("net_user") === RIGHT.user
                            && store.option("net_pass") === RIGHT.pass) {
                            console.log("Problem in test");
                            return Promise.reject();
                        }
                        store.option("net_user", RIGHT.user);
                        store.option("net_pass", RIGHT.pass);
                        return Promise.resolve();
                    });
                    store.option("get_pass", function() {
                        store.option("pass", RIGHT.pass);
                    });
                    return Promise.resolve();
                }

                if (self.debug) self.debug("browser startup");

                // browser
                // Query params override config, and parts missing from
                // config are prompted for
                return new Promise(function(resolve,reject) {
                    requirejs(["jquery"], function() {
                        let qs = Utils.parseURLParams(window.location.search.substring(1));
                        for (let option in PROMPTABLE) {
                            if (typeof qs[option] !== "undefined")
                                config[option] = qs[option];
                            else if (typeof config[option] === "undefined")
                                config[option] = RIGHT[option];
                            store.option(option, config[option]);
                            $("#" + option)
                                .val(config[option])
                                .on("change", function() {
                                    store.option(option, $("#" + option).val());
                                    $("#needs_" + option).show();
                                });
                        }
                        
                        console.log(self);
                        $("#run").on("click", function() {
                            resolve();
                        });
                    });
                });
                
            }).then(function () {
                return self.store.init();
            });
        }
    }

    return StoreTester;
});
