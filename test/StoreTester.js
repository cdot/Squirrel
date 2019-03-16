/*@preserve Copyright (C) 2015-2019 Crawford Currie http://c-dot.co.uk license MIT*/

if (typeof requirejs === "undefined") {
    throw new Error(__filename + " is not runnable on its own");
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

        /**
         * config provides a baseline source of parameter values.
         * node.js also allows environment variables to override this baseline.
         * only parameters marked as "needs_" in the store options are passed
         * to the store. "net_user" and "net_pass" are used in the 401 handler
         * for node.js.
         */
        analyseParams(config) {
            let self = this;
            let store = self.store;
            let four01 = {};
            if (!config)
                config = {};

            if (typeof global !== "undefined") {

                if (self.debug) self.debug("node.js startup");

                let remember = {};

                let cli = {};
                for (var i in process.argv) {
                    let p = process.argv[i].split("=");
                    cli[p[0]] = p[1];
                }

                for (let option in store.option()) {
                    if (/^needs_/.test(option)) {
                        let key = option.replace(/^needs_/, "");
                        // CLI overrides env vars
                        let v = cli[key];
                        // Env vars override config
                        if (typeof v === "undefined")
                            v = process.env["T_" + key];
                        // Config is last dicth
                        if (typeof v === "undefined")
                            v = config[key];
                        if (typeof v === "undefined")
                            throw "Require a value for "+key;
                        if (self.debug) self.debug(option,key, "=", v);
                        store.option(key, v);
                    }
                }
                if (store.option("needs_url")) {
                    for (let key in { net_user: 1, net_pass: 1 }) {
                        let v = config[key];
                        if (typeof v === "undefined")
                            v = process.env["T_" + key];
                        if (self.debug) self.debug(key, "=", v);
                        four01[key] = v;
                    }
                }
                
                // 401 handler, build credentials and pass back
                store.option("network_login", function() {
                    if (self.debug) self.debug("Called network_login",store.option());
                    if (store.option("net_user") === four01.net_user
                        && store.option("net_pass") === four01.net_pass) {
                        // If we get here, this is a second pass through
                        // this code. We can't improve on credentials, so
                        // it's a fail.
                        if (self.debug) self.debug("auth failed with "
                                                   + store.option("net_user"));
                        return Promise.reject();
                    }
                    store.option("net_user", four01.net_user);
                    store.option("net_pass", four01.net_pass);
                    return Promise.resolve();
                });

                return Promise.resolve();
            } else {

                if (self.debug) self.debug("Browser startup");

                // Query params override config, and parts missing from
                // config are prompted for
                return new Promise(function(resolve, reject) {
                    requirejs(["jquery"], resolve);
                })
                .then(() => {
                    config = Utils.parseURLParams(window.location.search.substring(1));
                    let needs = 0;
                    for (let option in store.option()) {
                        let v = config[option];
                        if (/^needs_/.test(option)) {
                            store.option(option, config[option]);
                            let $div = $("<div>" + option + "</div>");
                            let $input = $('<input/>');
                            $input
                            .val(config[option])
                            .on("change", function() {
                                store.option(option, $(this).val());
                            });
                            $("body").append($div);
                            needs++;
                        }
                    }

                    // Shouldn't need a 401 handler, the browser should take
                    // care of it

                    if (needs > 0) {
                        let $run = $("<button>Run</button>");
                        $button.on("click", function() {
                            resolve();
                        });
                        $("body").append($run);
                    } else
                        resolve();
                });
            }
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

            if (self.store.option("needs_url")) {
                // Won't do anything in the browser, as 401 isn't handled
                // by us
                this.addTest("Handles incorrect net user", function() {
                    let store = self.store;
                    return store.writes(test_path, TESTR)
                    .then(function () {
                        // Switch off 401 handler
                        let h401 = store.option("network_login");
                        store.option("network_login", null);
                        let nu = store.option("net_user");
                        store.option("net_user", Date.now());
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

                // Won't do anything in the browser, as 401 isn't handled
                // by us
                this.addTest("Handles incorrect net pass", function() {
                    let store = self.store;
                    return store.writes(test_path, TESTR)
                    .then(function () {
                        // Switch off 401 handler
                        let h401 = store.option("network_login");
                        store.option("network_login", null);
                        let np = store.option("net_pass");
                        store.option("net_pass", Date.now());
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
                    let u = store.option("pass");
                    return store.writes(test_path, TESTR)
                    .then(function () {
                        store.option("user", Date.now());
                        return store.reads(test_path)
                        .then(function(data) {
                            assert(false, "Unexpected");
                        })
                        .catch(function(e) {
                            assert(e instanceof Serror);
                            assert.equal(e.status, 401);
                            store.option("user", u);
                        });
                    })
                    .then(function(data) {
                        assert.notEqual(data, TESTR);
                        return store.reads(test_path);
                    })
                    .then(function(data) {
                        assert.equal(data, TESTR);
                    });
                });
            }

            if (self.store.option("needs_pass")) {
                // Note this is testing encryption (needs_pass)
                // not web authentication (needs_url)
                this.addTest("Handles incorrect password", function() {
                    let store = self.store;
                    let p = store.option("pass");
                    return store.writes(test_path, TESTR)
                    .then(function () {
                        store.option("pass", Date.now());
                        return store.reads(test_path)
                        .then(function(data) {
                            assert(false, "Unexpected success "+data);
                        })
                        .catch(function(e) {
                            assert(e instanceof Serror);
                            assert.equal(e.status, 400);
                            store.option("pass", p);
                        });
                    })
                    .then(function(data) {
                        assert.notEqual(data, TESTR);
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
