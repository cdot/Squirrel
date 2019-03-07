/*@preserve Copyright (C) 2015-2019 Crawford Currie http://c-dot.co.uk license MIT*/

if (typeof requirejs === "undefined") {
    console.log(__filename + " is not runnable stand-alone");
    return;
}

/**
 * Shared code used in testing stores.
 */
define(["js/Utils", "js/Serror", "test/TestRunner"], function(Utils, Serror, TestRunner) {

    const TESTR = "1234567普通话/普通話العَرَبِيَّة";

    // Deliberately make it an odd length to throw off 16-bit-assuming
    // conversions
    const DATASIZE = 255;//89345;

    const test_path = "test.dat";

    const RIGHT = {
        user: "GoodUser",
        pass: "Th15 15 a g00d P*$$w1Rd"
    };
        
    const WRONG = {
        user: "BadUser",
        pass: "Th15 15 a b44d P*$$w1rd"
    };

    class StoreTester extends TestRunner{

        /**
         * Construct using the class of a store or an array of store
         * layers
         */
        constructor(storeClasses, debug) {
            super(storeClasses[0], debug);

            this.storeClasses = storeClasses;
            this.store = undefined;
        }

        // Get constant for tests
        static right() {
            return RIGHT;
        }
        
        // Return a promise to construct self.store
        buildStore() {
            let self = this;
            let p = Promise.resolve();
            
            // Starting from the end of the class list, construct store objects
            for (let i = this.storeClasses.length - 1; i >= 0; i--) {
                let storeClass = this.storeClasses[i];
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
                p = p.then((module) => {
                    self.store = new module({
                        debug: self.debug,
                        understore: self.store
                    });
                });
            }
            return p;
        }
        
        analyseParams(config) {
            let self = this;
            let store = self.store; 
            if (!config)
                config = {};

            if (store.option("needs_path"))
                store.option("path", "/numb/nuts");
            
            const PROMPTABLE = {
                user: true, pass: true,
                net_url: true, net_user: true, net_pass: true };
            
            if (typeof global !== "undefined") {
                if (self.debug) self.debug("StoreTester: node.js startup");
                // node.js allows environment variables to override the
                // store configuration
                let remember = {};
                for (let option in PROMPTABLE) {
                    let v = config[option];
                    if (typeof v === "undefined")
                        v = process.env["T_" + option];
                    if (typeof v === "undefined")
                        v = RIGHT[option];
                    if (self.debug) self.debug("OPTION", option, v);
                    store.option(option, v);
                }
                // 401 handler, build credentials and pass back
                store.option("network_login", function() {
                    if (self.debug) self.debug("Called network_login");
                    if (store.option("net_user") === RIGHT.user
                        && store.option("net_pass") === RIGHT.pass) {
                        if (self.debug) self.debug("auth failed with "
                                                   + store.option("net_user"));
                        return Promise.reject();
                    }
                    store.option("net_user", RIGHT.user);
                    store.option("net_pass", RIGHT.pass);
                    return Promise.resolve();
                });
                store.option("store_login", function() {
                    store.option("user", RIGHT.user);
                    store.option("pass", RIGHT.pass);
                });
                return Promise.resolve();
            }
            
            if (self.debug) self.debug("Browser startup");
            
            // browser
            // Query params override config, and parts missing from
            // config are prompted for
            return new Promise(function(resolve, reject) {
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
                    
                    // If we have a #run button, wait for it to be clicked
                    let $run = $("#run");
                    if ($run.length > 0)
                        $run.on("click", function() {
                            resolve();
                        });
                    else
                        resolve();
                });
            });
        }

        static user() {
            return RIGHT;
        }
        
        makeTests() {
            let self = this;
            let assert = this.assert;
 
            this.addTest("Write/Read 1 byte", function() {
                let store = self.store;
                let a = new Uint8Array(1);
                a[0] = 69;
                return store.write(test_path, a)
                    .then(function() {
                        return store.read(test_path);
                    })
                    .then(function(ab) {
                        assert.equal(ab.length, 1);
                        assert.equal(Utils.Uint8ArrayToString(ab), String.fromCodePoint(69));
                    });
            });
            
            this.addTest("Write/Read 0 bytes", function() {
                let store = self.store;
                let a = new Uint8Array(0);
                return store.write(test_path, a)
                    .then(function () {
                        return store.read(test_path);
                    })
                    .then(function(ab) {
                        assert.equal(ab.byteLength, 0);
                    });
            });
            
            this.addTest("Read non-existant", function() {
                let store = self.store;
                return store.read("not/a/known/resource.dat")
                    .then(function(ab) {
                        assert(false, "Non existant should not resolve");
                    })
                    .catch(function(se) {
                        assert(se instanceof Serror, "" + se);
                        assert(se.status === 404, "" + se);
                    });
            });
            
            this.addTest("Write/Read string", function() {
                let store = self.store;
                return store.writes(test_path, TESTR)
                    .then(function () {
                        return store.reads(test_path);
                    })
                    .then(function(str) {
                        assert.equal(str, TESTR);
                    });
            });
            
            this.addTest("Write/read binary", function() {
                let store = self.store;
                let a = new Uint8Array(DATASIZE);
                
                for (let i = 0; i < DATASIZE; i++)
                    a[i] = ((i + 1) & 0xFF);
                //if (debug) debug("W:",block(a,214,220));
                return store.write(test_path, a)
                    .then(function () {
                        return store.read(test_path);
                    })
                    .then(function(a) {
                        assert.equal(a.length, DATASIZE);
                        //if (debug) debug("R:",block(a,214,220));
                        for (let i = 0; i < DATASIZE; i++)
                            assert.equal(a[i], ((i + 1) & 255), "Position " + i);
                    });
            });
            
            if (self.store.option("needs_auth")) {
                this.addTest("Handles incorrect net user", function() {
                    let store = self.store;
                    return store.writes(test_path, TESTR)
                    .then(function () {
                        // Switch off 401 handler
                        let h401 = store.option("network_login");
                        store.option("network_login", null);
                        let nu = store.option("net_user");
                        store.option("net_user", WRONG.user);
                        return store.reads(test_path)
                        .then(function(data) {
                            assert(false, "Expected an error");
                        })
                        .catch(function(e) {                               
                            assert(e instanceof Serror, "Not an Serror "+e);
                            assert.equal(e.status, 401);
                            store.option("network_login", h401);
                            store.option("net_user", nu);
                        });
                    })
                    .catch((e) => {
                        assert(false, "Write error" + e);
                    });
                });
                
                this.addTest("Handles incorrect net pass", function() {
                    let store = self.store;
                    return store.writes(test_path, TESTR)
                    .then(function () {
                        // Switch off 401 handler
                        let h401 = store.option("network_login");
                        store.option("network_login", null);
                        let np = store.option("net_pass");
                        store.option("net_pass", WRONG.pass);
                        return store.reads(test_path, TESTR)
                        .then(function(data) {
                            assert(false, "Unexpected");
                        })
                        .catch(function(e) {
                            assert(e instanceof Serror, "Not an serror "+e);
                            assert.equal(e.status, 401);
                            store.option("network_login", h401);
                            store.option("net_pass", np);
                        });
                    })
                    .catch((e) => {
                        assert(false, "Write error" + e);
                    });
                });
            }
            
            if (self.store.option("needs_user")) {
                this.addTest("Handles incorrect user", function() {
                    let store = self.store;
                    store.option("pass", RIGHT.pass);
                    return store.writes(test_path, TESTR)
                        .then(function () {
                            store.option("user", WRONG.user);
                            return store.reads(test_path)
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
                            store.option("user", RIGHT.user);
                            return store.reads(test_path);
                        })
                        .then(function(data) {
                            assert.equal(data, TESTR);
                        });
                });
            }
            
            if (self.store.option("needs_pass")) {
                // Note this is testing encryption (needs_pass)
                // not web authentication (needs_auth)
                this.addTest("Handles incorrect password", function() {
                    let store = self.store;
                    store.option("pass", RIGHT.pass);
                    return store.writes(test_path, TESTR)
                        .then(function () {
                            store.option("pass", WRONG.pass);
                            return store.reads(test_path)
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
                            store.option("pass", RIGHT.pass);
                            return store.reads(test_path);
                        })
                        .then(function(data) {
                            assert.equal(data, TESTR);
                        });
                });
            }
        }
        
        run(params) {
            return this.buildStore()
                .then(() => {
                    return this.analyseParams(params);
                })
                .then(() => {
                    return this.store.init();
                })
                .then(() => {
                    return this.makeTests();
                })
                .then(() => {
                    return super.run();
                });
        }
    }        
    return StoreTester;
});
