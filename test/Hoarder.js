/*@preserve Copyright (C) 2019 Crawford Currie http://c-dot.co.uk license MIT*/
/*eslint-env shared-node-browser, mocha */

if (typeof requirejs == "undefined")
    requirejs = require('requirejs');

requirejs.config({
    baseUrl: ".."
});

requirejs(["js/Hoarder", "js/Action", "js/Hoard", "js/LocalStorageStore", "js/EncryptedStore", "js/Utils", "js/Serror", "test/MemoryStore", "test/TestRunner"], function(Hoarder, Action, Hoard, LocalStorageStore, EncryptedStore, Utils, Serror, MemoryStore, TestRunner) {
    let tr = new TestRunner("Hoarder");
    let assert = tr.assert;

    tr.addTest("constructor", function() {
        let h = new Hoarder();
        h.cloud_store(new LocalStorageStore({ debug: console.debug,
                                              user: "Cumulus",
                                              pass: "Nimbus" }));
        h.client_store(new LocalStorageStore({ debug: console.debug,
                                               user: "Stratus",
                                               pass: "Alto"}));
        h.cloud_path("CLOUD");
        assert.equal(h.changes, 1);
        assert.equal(h.user(), "Stratus");
        assert.equal(h.encryption_pass(), "Alto");
        assert.equal(h.changes, 1);
    });

    const full_tree_actions = [
        {
	    type: "N",
	    time: 100,
	    path: ["One"]
        },
        {
	    type: "A",
	    time: 200,
            data: 100000,
	    path: ["One"]
        },
        {
	    type: "N",
	    time: 300,
	    path: [ "One", "Two" ]
        },
        {
	    type: "N",
	    time: 400,
	    path: [ "One", "Two", "Three" ],
            data: "£6.70 per gram"
        },
        {
            type: "A",
	    path: [ "One", "Two", "Three" ],
	    time: 500,
            data: 100
        },
        {
            type: "A",
	    path: [ "One", "Two" ],
	    time: 600,
            data: 11111
        },
        {
	    type: "X",
	    time: 500,
	    path: [ "One", "Two", "Three" ],
            data: "32;A-Z;0-9"
        }
    ];

    tr.addTest("load_client", function() {
        let debug;// = console.debug;
        let store = new MemoryStore({ debug: debug });
        let clierd = new Hoard(debug);
        for (let act of full_tree_actions) {
            clierd.play_action(act);
        }
        let data = { cloud_path: "blah", hoard: clierd };
        return store.writes("client", JSON.stringify(data)).then(() => {
            let h = new Hoarder({ debug: debug,
                                  clientStore: store });
            let c = 0;
            return h.load_client((a) => {
                // TODO: Should really validate which actions this is
                // called for
                c++;
            }).then(() => {
                assert.equal(c, full_tree_actions.length);
                assert.deepEqual(h.hoard.tree, clierd.tree);
            });
        })
    });

    
    tr.addTest("load_cloud", function() {
        let debug;// = console.debug;
        let store = new MemoryStore({ debug: debug, user: "Zeno" });
        let h = new Hoarder({
            debug: debug, cloudPath: "blah", cloudStore: store });
        return store.writes("blah", JSON.stringify(full_tree_actions)).then(() => {
            return h.load_cloud()
            .then((actions) => {
                assert.deepEqual(actions, full_tree_actions);
            });
        });
    });

    tr.addTest("load_cloud fails 1", function() {
        let debug;// = console.debug;
        let store = new MemoryStore({ debug: debug, user: "Zeno" });
        let h = new Hoarder({
            debug: debug, cloudPath: "paradox", cloudStore: store });
        return h.load_cloud()
        .then(() => {
            assert(false);
        })
        .catch((e) => {
            assert(e instanceof Serror);
            assert.equal(e.status, 400);
            assert.equal(e.message, "paradox is not in store");
        });
    });

    tr.addTest("load_cloud fails 2", function() {
        let debug;// = console.debug;
        let store = new MemoryStore({ debug: debug, user: "Zeno" });
        let h = new Hoarder({
            debug: debug, cloudPath: "blah", cloudStore: store });
        return store.writes("blah", "rubbish")
        .then(() => {
            return h.load_cloud()
            .then(() => {
                assert(false);
            })
            .catch((e) => {
                assert(e instanceof Serror);
            });
        });
    });

    tr.addTest("add_action", function() {
        let debug;// = console.debug;
        let cliest = new MemoryStore({ debug: debug });
        let cloust = new MemoryStore({ debug: debug });
        let clierd = new Hoard(debug);
        for (let act of full_tree_actions) {
            clierd.play_action(act);
        }
        let h = new Hoarder({ debug: debug });
        h.client_store(cliest);
        h.cloud_store(cloust);
        h.cloud_path("blah");
        // Muddy boots, short-circuit the client save
        h.hoard = clierd;
        let act = new Action({type:"N", path:["One", "Four"], time:Date.now(), data:"4"});
        h.add_action(act)
        .then((res) => {
            assert(!res.conflict);
            assert.equal(res.action, act);
            assert.deepEqual(h.hoard.actions, [ act ]);
        })
        .then(() => {
            let nact = new Action({type:"N", path:["One", "Four"], time:Date.now(), data:"5"});
            return h.add_action(nact)
            .then((res) => {
                assert(!res.conflict);
                assert.deepEqual(res.action, nact);
            });
        });
    });

    function make_cloud(actions, store, debug) {
        let s = JSON.stringify(actions);
        store.option("pass", "pass");
        return store.writes("blah", s);
    }

    function make_client(actions, store, debug) {
        let clierd = new Hoard(debug);
        store.option("pass", "pass");
        for (let act of full_tree_actions) {
            clierd.play_action(act);
        }
        let s = JSON.stringify({
            cloud_path: "blah",
            hoard: clierd
        });
        return store.writes("client", s);
    }

    // Simple update involving a local change and a remote change
    // that overlap. The update from the cloud should play the
    // remote change into the local hoard
    tr.addTest("simple_update_from_cloud", function() {
        let debug;// = console.debug;
        let cliest = new MemoryStore();
        let cloust = new MemoryStore();

        // Add an action to the cloud
        let acts = full_tree_actions.slice();
        let clact = new Action({type:"N", path:["One", "Four"], time:960, data:"4"});
        acts.push(clact);

        make_cloud(acts, cloust)
        .then(() => {
            // Populate the client with the base tree
            return make_client(full_tree_actions, cliest);
        })
        .then(() => {
            let h = new Hoarder({
                debug: debug,
                cloudPath: "blah",
                clientStore: cliest,
                cloudStore: cloust,
                last_sync: 900
            });
            return h.load_client()
            .then(() => {
                // Add a local action in the client
                let act = new Action({type:"N", path:["One", "Five"], time:950, data:"5"});
                h.add_action(act);
                let acted = 0;
                h.each_pending_action((a) => {
                    assert.deepEqual(act, a);
                    acted++;
                });
                assert.equal(acted, 1);
                acted = 0;
                return h.update_from_cloud(
                    [],
                    (a) => {
                        acted++;
                        assert.deepEqual(a, clact);
                    })
                .then(() => {
                    assert.equal(acted, 1);
                    assert.deepEqual(h.hoard.tree.data, {
                        "One": {
                            "time": 960,
                            "data": {
                                "Two": {
                                    "time": 600,
                                    "data": {
                                        "Three": {
                                            "time": 500,
                                            "data": "£6.70 per gram",
                                            "alarm": 100,
                                            "constraints": "32;A-Z;0-9"
                                        }
                                    },
                                    "alarm": 11111
                                },
                                "Four": {
                                    "time": 960,
                                    data: "4"
                                },
                                "Five": {
                                    "time": 950,
                                    data: "5"
                                }
                            },
                            "alarm": 100000
                        }
                    })
                });
            });
        });
    });

    tr.addTest("synchronise with conflicts", function() {
        let debug;// = console.debug;
        let cliest = new MemoryStore();
        let cloust = new MemoryStore();

        // Add an action to the cloud
        let acts = full_tree_actions.slice();
        let clact = new Action({type:"R", path:["One", "TwoNine"], time:960, data:"Four"});
        acts.push(clact);

        make_cloud(acts, cloust)
        .then(() => {
            // Populate the client with the base tree
            return make_client(full_tree_actions, cliest);
        })
        .then(() => {
            let h = new Hoarder({
                debug: debug,
                cloudPath: "blah",
                clientStore: cliest,
                cloudStore: cloust,
                last_sync: 900
            });
            return h.load_client()
            .then(() => {
                // Add a local action in the client
                let act = new Action({type:"R", path:["One", "Two"], time:950, data:"Four"});
                h.add_action(act);
                let progress = [];
                return h.synchronise(
                    progress,
                    (a) => {
                        assert.deepEqual(a, clact, a);
                    })
                .then((actions) => {
                    assert.equal(actions.length, 8);
                    assert.equal(progress.length, 1);
                    assert.equal(progress[0].severity, "warning");
                    assert.equal(progress[0].message, "Cannot rename 'One↘TwoNine': it does not exist");
               });
            });
        });
    });
    
    tr.addTest("synchronise and save", function() {
        let debug;// = console.debug;
        let cliest = new MemoryStore();
        let cloust = new MemoryStore();

        // Add an action to the cloud
        let acts = full_tree_actions.slice();
        let clact = new Action({type:"N", path:["One", "Four"], time:960, data:"4"});
        acts.push(clact);

        make_cloud(acts, cloust)
        .then(() => {
            // Populate the client with the base tree
            return make_client(full_tree_actions, cliest);
        })
        .then(() => {
            let h = new Hoarder({
                debug: debug,
                cloudPath: "blah",
                clientStore: cliest,
                cloudStore: cloust,
                last_sync: 900
            });
            return h.load_client()
            .then(() => {
                // Add a local action in the client
                let act = new Action({type:"N", path:["One", "Five"], time:950, data:"5"});
                h.add_action(act);
                let progress = [];
                return h.synchronise(
                    progress,
                    (a) => {
                        assert.deepEqual(a, clact, a);
                    })
                .then((actions) => {
                    assert.equal(actions.length, 9);
                    return h.save_cloud(actions, progress)
                })
                .then(() => {
                    return h.save_client(progress);
                })
                .then(() => {
                    let clieh = new Hoard(JSON.parse(Utils.Uint8ArrayToString(cliest.data.client)).hoard);
                    let clouh = new Hoard();
                    //console.log(Utils.Uint8ArrayToString(cloust.data.blah));
                    let acts = JSON.parse(Utils.Uint8ArrayToString(cloust.data.blah));
                    for (let act of acts) {
                        clouh.play_action(act);
                    }
                    //console.log(clieh.treeJSON());
                    //console.log(clouh.treeJSON());
                    assert.deepEqual(clieh.tree, clouh.tree);
                });
            });
        });
    });

    tr.addTest("encrypted synchronise", function() {
        let debug;// = console.debug;
        let cliest = new EncryptedStore({ understore: new MemoryStore() });
        let cloust = new EncryptedStore({ understore: new MemoryStore() });

        // Add an action to the cloud
        let acts = full_tree_actions.slice();
        let clact = new Action({type:"N", path:["One", "Four"], time:960, data:"4"});
        acts.push(clact);

        make_cloud(acts, cloust)
        .then(() => {
            // Populate the client with the base tree
            return make_client(full_tree_actions, cliest);
        })
        .then(() => {
            let h = new Hoarder({
                debug: debug,
                cloudPath: "blah",
                clientStore: cliest,
                cloudStore: cloust,
                last_sync: 900
            });
            h.authenticate({ user: "test", pass: "pass" });
            return h.load_client()
            .then(() => {
                // Add a local action in the client
                let act = new Action({type:"N", path:["One", "Five"], time:950, data:"5"});
                h.add_action(act);
                let acted = 0, progress = [];
                return h.synchronise(
                    progress,
                    (a) => {
                        assert.deepEqual(a, clact, a);
                        acted++;
                    })
                .then((actions) => {
                    assert.equal(actions.length, 9);
                    assert.equal(acted, 1);
                    return h.save_cloud(actions, progress)
                })
                .then(() => {
                    return h.save_client(progress);
                });
            });
        });
    });

    tr.addTest("synchronise unreadable cloud", function() {
        let debug;// = console.debug;
        let cliest = new MemoryStore();
        let cloust = new MemoryStore();

        // Add an action to the cloud
        let acts = full_tree_actions.slice();
        let clact = new Action({type:"N", path:["One", "Four"], time:960, data:"4"});
        acts.push(clact);

        cloust.writes("blah", "rubbish")
        .then(() => {
            // Populate the client with the base tree
            return make_client(full_tree_actions, cliest);
        })
        .then(() => {
            let h = new Hoarder({
                debug: debug,
                cloudPath: "blah",
                clientStore: cliest,
                cloudStore: cloust,
                last_sync: 900
            });
            return h.load_client()
            .then(() => {
                // Add a local action in the client
                let act = new Action({type:"N", path:["One", "Five"], time:950, data:"5"});
                h.add_action(act);
                let progress = [];
                return h.synchronise(progress)
                .then(() => {
                    assert(false);
                })
                .catch((e) => {
                    assert.equal(progress.length, 1);
                    assert.equal(progress[0].severity, "error");
                    assert.equal(progress[0].message, "Failed to refresh from cloud store");
                    assert(e instanceof Serror);
                    assert.equal(e.message, "Cloud store could not be parsed");
                    assert.equal(e.status, 400);
               });
            });
        });
    });

    tr.addTest("check_alarms", function() {
        let debug;// = console.debug;
        let cliest = new MemoryStore();
        let cloust = new MemoryStore();

        // Add an action to the cloud
        let acts = full_tree_actions.slice();
        let clact = new Action({type:"N", path:["One", "Four"], time:960, data:"4"});
        acts.push(clact);

        make_cloud(acts, cloust)
        .then(() => {
            // Populate the client with the base tree
            return make_client(full_tree_actions, cliest);
        })
        .then(() => {
            let h = new Hoarder({
                debug: debug,
                cloudPath: "blah",
                clientStore: cliest,
                cloudStore: cloust,
                last_sync: 900
            });
            return h.load_client()
            .then(() => {
                return h.check_alarms(function(path, rang_at) {
                    for (let a of full_tree_actions) {
                        if (a.type === "A" && TestRunner.samePath(a.path, path)) {
                            assert(!a.rung);
                            //console.log(a,"at",rang_at);
                            a.rung = true;
                        }
                    }
                    return Promise.resolve();
                });
            });
        });
    });

    // Need to test for unable to update from cloud
    
    tr.addTest("undo", function() {
    });
    
    tr.run();
});
