/*@preserve Copyright (C) 2019 Crawford Currie http://c-dot.co.uk license MIT*/
/*eslint-env shared-node-browser, mocha */

if (typeof module !== "undefined") {
    requirejs = require('requirejs');
    requirejs.config({
        baseUrl: ".."
    });
}

requirejs(["js/Hoarder", "js/Action", "js/Hoard", "js/LocalStorageStore", "js/EncryptedStore", "js/Utils", "test/MemoryStore", "test/TestRunner"], function(Hoarder, Action, Hoard, LocalStorageStore, EncryptedStore, Utils, MemoryStore, TestRunner) {
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
        let data = { cloud_path: "blah", hoard: clierd };
        return clierd.play_actions(full_tree_actions).then(() => {
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

    tr.addTest("add_action", function() {
        let debug;// = console.debug;
        let cliest = new MemoryStore({ debug: debug });
        let cloust = new MemoryStore({ debug: debug });
        let clierd = new Hoard(debug);
        return clierd.play_actions(full_tree_actions).then(() => {
            let h = new Hoarder({ debug: debug });
            h.client_store(cliest);
            h.cloud_store(cloust);
            h.cloud_path("blah");
            // Muddy boots, short-circuit the client save
            h.hoard = clierd;
            return h;
        })
        .then((h) => {
            let act = new Action({type:"N", path:["One", "Four"], time:Date.now(), data:"4"});
            return h.add_action(act)
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
    });

    function make_cloud(actions, store, debug) {
        let s = JSON.stringify(actions);
        store.option("pass", "pass");
        return store.writes("blah", s);
    }

    function make_client(actions, store, debug) {
        let clierd = new Hoard(debug);
        store.option("pass", "pass");
        return clierd.play_actions(full_tree_actions)
        .then(() => {
            let s = JSON.stringify({
                cloud_path: "blah",
                hoard: clierd
            });
            return store.writes("client", s);
        });
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
                return h.update_from_cloud(
                    [],
                    (a) => {
                        acted++;
                        assert.deepEqual(a.action, clact);
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

    tr.addTest("synchronise_and_save", function() {
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
                return h.synchronise_and_save(
                    [],
                    (a) => {
                        assert.deepEqual(a, clact, a);
                    })
                .then(() => {
                    let clieh = new Hoard(JSON.parse(Utils.Uint8ArrayToString(cliest.data.client)).hoard);
                    let clouh = new Hoard();
                    //console.log(Utils.Uint8ArrayToString(cloust.data.blah));
                    return clouh.play_actions(JSON.parse(Utils.Uint8ArrayToString(cloust.data.blah)))
                    .then(() => {
                        //console.log(clieh.treeJSON());
                        //console.log(clouh.treeJSON());
                        assert.deepEqual(clieh.tree, clouh.tree);
                    });
                });
            });
        });
    });

    tr.addTest("encrypted synchronise_and_save", function() {
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
                let acted = 0;
                return h.synchronise_and_save(
                    [],
                    (a) => {
                        assert.deepEqual(a, clact, a);
                        acted++;
                    })
                .then(() => {
                    assert.equal(acted, 1);
                });
            });
        });
    });

    // Need to test for unable to update from cloud
    
    tr.deTest("undo", function() {
    });
    
    tr.deTest("each_pending_action", function() {
    });

    tr.deTest("authenticate_client", function() {
    });

    tr.deTest("check_alarms", function() {
    });

    tr.run();
});
