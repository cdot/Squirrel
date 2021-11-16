/*@preserve Copyright (C) 2015-2021 Crawford Currie http://c-dot.co.uk license MIT*/
/*eslint-env node,mocha,browser*/
/*eslint-disable no-eval*/

if (typeof requirejs === "undefined") {
    throw new Error(__filename + " is not runnable on its own");
}

/**
 * Shared code used in testing stores.
 */
define([
	"js/Utils", "js/Serror", "test/TestRunner"
], (Utils, Serror, TestRunner) => {

    const TESTR = "1234567普通话/普通話العَرَبِيَّة";

    // Deliberately make it an odd length to throw off 16-bit-assuming
    // conversions
    const DATASIZE = 89345;

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
			//this.debug = console.log;
        }

        // Return a promise to construct this.store
        buildStore() {
            let p = Promise.resolve();

            // Starting from the end of the class list, construct store objects
            for (let i = this.storeClasses.length - 1; i >= 0; i--) {
                const storeClass = this.storeClasses[i];
                let sc;
                try {
                    sc = eval(storeClass);
                    p = Promise.resolve(sc);
                } catch (e) {
                    if (this.debug) this.debug("Require", storeClass);
                    p = p.then(() => new Promise((res,rej) => {
                            requirejs(["js/" + storeClass],
                                      module => res(module),
                                      e => rej(e));
                    }));
                }
                p = p.then(module => {
                    this.store = new module({
                        debug: this.debug,
                        understore: this.store
                    });
                });
            }
            return p;
        }

        getParams(config) {
            let key;
            
            if (typeof global === "undefined") {
                // Browser
                config.inBrowser = true;
                const up = Utils.parseURLParams(
                    window.location.search.substring(1));
                for (key in up)
                    config[key] = up[key];
            } else if (typeof process !== "undefined") {
                // Node.js
                config.inBrowser = false;
                for (key in process.argv)
                    config[key] = process.env[key];
                for (key in process.argv) {
                    const p = process.argv[key].split("=");
                    config[p[0]] = p[1];
                }
            }
            if (config.debug)
                this.debug = console.debug;
            return Promise.resolve(config);
        }

        /**
         * Transfer parameters into the store, as required.
         * config provides a baseline source of parameter values.
         * parameters marked as "needs_" in the store options are passed
         * to the store. "net_user" and "net_pass" are used in the 401 handler
         * for node.js.
         */
        configureStore(config) {
            const store = this.store;
            const four01 = {};

            for (let option in store.option()) {
                if (/^needs_/.test(option)) {
                    const key = option.replace(/^needs_/, "");
                    const v = config[key];
                    if (!config.inBrowser && typeof v === "undefined")
                        throw new Error(`Require parameter '${key}'`);
                    if (this.debug) this.debug(option,key, "=", v);
                    store.option(key, v);
                }
            }

            if (store.option("needs_url")) {
                for (let key in { net_user: 1, net_pass: 1 }) {
                    const v = config[key];
                    if (this.debug) this.debug(key, "=", v);
                    four01[key] = v;
                }
            }

            // 401 handler, build credentials and pass back
            store.option("network_login", function() {
                if (this.debug) this.debug("Called network_login",store.option());
                if (store.option("net_user") === four01.net_user
                    && store.option("net_pass") === four01.net_pass) {
                    // If we get here, this is a second pass through
                    // this code. We can't improve on credentials, so
                    // it's a fail.
                    if (this.debug) this.debug("auth failed with "
                                               + store.option("net_user"));
                    return Promise.reject();
                }
                store.option("net_user", four01.net_user);
                store.option("net_pass", four01.net_pass);
				store.auth = { user: store.option("net_user"), pass: store.option("net_pass") };
                return Promise.resolve();
            });

            if (!config.inBrowser)
                return Promise.resolve();

            // Build a UI to capture required parameters in the browser
            return new Promise(resolve => {
                requirejs(["jquery"], () => {
                    let needs = 0;
                    for (let option in store.option()) {
                        const m = /^needs_(.*)$/.exec(option);
                        if (m) {
                            const opt = m[1];
                            this.store.option(opt, config[opt]);
                            const $div = $("<div>" + opt + "</div>");
                            const $input = $('<input/>');
                            $div.append($input);
                            $input
                            .val(config[opt])
                            .on("change", function() {
                                console.log(opt, $(this).val());
                                this.store.option(opt, $(this).val());
                           });
                            $("body").append($div);
                            needs++;
                        }
                    }
                    
                    if (needs > 0) {
                        const $run = $("<button>Run</button>");
                        $run.on("click", function() {
                            resolve();
                        });
                        $("body").append($run);
                    } else
                        resolve();
                });
            });
        }

        makeTests() {
            const assert = this.assert;

			this.addTest("Write/Read 1 byte", () => {
                const store = this.store;
                const a = new Uint8Array(1);
                a[0] = 69;
				return store.write(test_path, a)
                .then(() => {
					return store.read(test_path);
                })
                .then(ab => {
                    assert.equal(ab.length, 1);
                    assert.equal(Utils.Uint8ArrayToString(ab),
                                 String.fromCodePoint(69));
                });
            });

            this.addTest("Write/Read 0 bytes", () => {
                const store = this.store;
                return store.write(test_path, new Uint8Array(0))
                .then(function () {
                    return store.read(test_path);
                })
                .then(function(ab) {
                    assert.equal(ab.byteLength, 0);
                });
            });

            this.addTest("Write/Read empty string", () => {
                const store = this.store;
                return store.writes(test_path, "")
                .then(function () {
                    return store.reads(test_path);
                })
                .then(function(ab) {
                    assert.equal(ab.length, 0);
                });
            });

            this.addTest("Read non-existant byte data", () => {
                const store = this.store;
                return store.read("not/a/known/resource.dat")
                .then(() => {
                    assert(false, "Non existant should not resolve");
                })
                .catch(function(se) {
                    assert(se instanceof Serror, "" + se);
                    assert(se.status === 404, "" + se);
                });
            });

            this.addTest("Read non-existant string", () => {
                const store = this.store;
                return store.reads("not/a/known/resource.dat")
                .then(() => {
                    assert(false, "Non existant should not resolve");
                })
                .catch(function(se) {
                    assert(se instanceof Serror, "" + se);
                    assert(se.status === 404, "" + se);
                });
            });

            this.addTest("Write/read binary data", () => {
                const store = this.store;
                const a = new Uint8Array(DATASIZE);

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

            this.addTest("Write/Read string", () => {
                const store = this.store;
                return store.writes(test_path, TESTR)
                .then(function () {
                    return store.reads(test_path);
                })
                .then(function(str) {
                    assert.equal(str, TESTR);
                });
            });

            if (this.store.option("needs_url")) {
                // Won't do anything in the browser, as 401 isn't handled
                // by us
                this.addTest("Handles incorrect net user", () => {
                    const store = this.store;
                    return store.writes(test_path, TESTR)
                    .then(function () {
                        // Switch off 401 handler
                        const h401 = store.option("network_login");
                        store.option("network_login", null);
                        const nu = store.option("net_user");
                        store.option("net_user", Date.now());
                        return store.reads(test_path)
                        .then(() => {
                            assert(false, "Expected an error");
                        })
                        .catch(function(e) {
                            assert(e instanceof Serror, "Not an Serror "+e);
                            assert.equal(e.status, 401);
                            store.option("network_login", h401);
                            store.option("net_user", nu);
                        });
                    })
                    .catch(e => {
                        assert(false, "Write error" + e);
                    });
                });

                // Won't do anything in the browser, as 401 isn't handled
                // by us
                this.addTest("Handles incorrect net pass", () => {
                    const store = this.store;
                    return store.writes(test_path, TESTR)
                    .then(function () {
                        // Switch off 401 handler
                        const h401 = store.option("network_login");
                        store.option("network_login", null);
                        const np = store.option("net_pass");
                        store.option("net_pass", Date.now());
                        return store.reads(test_path, TESTR)
                        .then(() => {
                            assert(false, "Unexpected");
                        })
                        .catch(function(e) {
                            assert(e instanceof Serror, "Not an serror "+e);
                            assert.equal(e.status, 401);
                            store.option("network_login", h401);
                            store.option("net_pass", np);
                        });
                    })
                    .catch(e => {
                        assert(false, "Write error" + e);
                    });
                });
            }

            if (this.store.option("needs_user")) {
                this.addTest("Handles incorrect user", () => {
                    const store = this.store;
                    const u = store.option("pass");
                    return store.writes(test_path, TESTR)
                    .then(function () {
                        store.option("user", Date.now());
                        return store.reads(test_path)
                        .then(() => {
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

            if (this.store.option("needs_pass")) {
                // Note this is testing encryption (needs_pass)
                // not web authentication (needs_url)
                this.addTest("Handles incorrect password", () => {
                    const store = this.store;
                    const p = store.option("pass");
                    return store.writes(test_path, TESTR)
                    .then(function () {
                        store.option("pass", Date.now());
						debugger;
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
            params = params || {};
            return this.getParams(params)
            .then(config => {
                return this.buildStore()
                .then(() => {
                    return this.configureStore(config);
                });
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
