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
    const MSPERDAY = 24 * 60 * 60 * 1000;
    
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
            data: { size: 32, chars: "A-Z;0-9" }
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
            let h = new Hoarder({ debug: debug, clientStore: store });
            return h.load_client()
            .then(() => {
                assert.deepEqual(h.hoard.history, clierd.history);
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

    function make_cloud(actions, store, debug) {
        let s = JSON.stringify(actions);
        store.option("pass", "pass");
        return store.writes("blah", s);
    }

    function make_client(actions, store, debug) {
        let clierd = new Hoard({debug:debug});
        store.option("pass", "pass");
        for (let act of full_tree_actions) {
            clierd.play_action(act, false);
        }
        let s = JSON.stringify({
            cloud_path: "blah",
            hoard: clierd,
            last_sync: 900
        });
        return store.writes("client", s);
    }

    // Simple update involving a local change and a remote change
    // that overlap. The update from the cloud should play the
    // remote change into the local hoard
    tr.addTest("simple synchronise", function() {
        let debug;// = console.debug;
        let cliest = new MemoryStore();
        let cloust = new MemoryStore();

        // Add an action to the cloud
        let acts = full_tree_actions.slice();
        let cloud_act = new Action({type:"N", path:["One", "From Cloud"],
                                    time:960, data:"4"});
        let h;
        acts.push(cloud_act);

        let ui_acts = [];
        return make_cloud(acts, cloust)
        .then(() => {
            // Populate the client with the base tree
            return make_client(full_tree_actions, cliest);
        })
        .then(() => {
            h = new Hoarder({
                debug: debug,
                cloudPath: "blah",
                clientStore: cliest,
                cloudStore: cloust,
                last_sync: 900
            });
            return h.load_client();
        })
        .then(() => {
            // Add a local action in the client
            let act = new Action({
                type:"N", path:["One", "Five"], time:950, data:"5"});
            return h.hoard.play_action(act, true);
        })
        .then((e) => {
            return h.synchronise(
                [],
                (c) => {
                    ui_acts.push(c);
                });
        })
        .then((actions) => {
            assert.equal(actions.length, 9);
            assert.deepEqual(ui_acts, [
                { type: 'D', path: [ 'One', 'Five' ], time: 300 },
                { type: 'N', path: [ 'One', 'From Cloud' ], time: 900, data: '4' },
                { type: 'N', path: [ 'One', 'Five' ], time: 950, data: '5' }
            ]);
            assert.deepEqual(h.hoard.tree.data, {
                One: {
                    time: 950,
                    data: {
                        Two: {
                            time: 600,
                            data: {
                                Three: {
                                    time: 500,
                                    data: "£6.70 per gram",
                                    alarm: {
                                        due: 500 + 100 * MSPERDAY,
                                        repeat: 100 * MSPERDAY
                                    },
                                    constraints: {
                                        chars: "A-Z;0-9",
                                        size: 32
                                    }
                                }
                            },
                            alarm: {
                                due: 600 + 11111 * MSPERDAY,
                                repeat: 11111 * MSPERDAY
                            }
                        },
                        "From Cloud": {
                            time: 900, // synch time
                            data: "4"
                        },
                        "Five": {
                            time: 950,
                            data: "5"
                        }
                    },
                    alarm: {
                        due: 200 + 100000 * MSPERDAY,
                        repeat: 100000 * MSPERDAY
                    }
                }
            });
        });
    });

    tr.addTest("synchronise with conflicts", function() {
        let debug;// = console.debug;
        let cliest = new MemoryStore();
        let cloust = new MemoryStore();

        // Add an action to the cloud
        let acts = full_tree_actions.slice();
        let cloud_act = new Action({
            type:"D", path:["One", "Two"], time:960});
        let h;
        acts.push(cloud_act);

        let ui_acts = [];
        return make_cloud(acts, cloust)
        .then(() => {
            // Populate the client with the base tree
            return make_client(full_tree_actions, cliest);
        })
        .then(() => {
            h = new Hoarder({
                debug: debug,
                cloudPath: "blah",
                clientStore: cliest,
                cloudStore: cloust,
                last_sync: 900
            });
            return h.load_client();
        })
        .then(() => {
            // Add a local action in the client renaming a different node to
            // the same name as the cloud action
            let act = new Action({
                type:"R", path:["One", "Two"], time:950, data:"In Client"});
            return h.hoard.play_action(act, true);
        })
        .then(() => {
            let progress = [];
            return h.synchronise(
                progress,
                (a) => {
                    ui_acts.push(a);
                })
            .then((actions) => {
                assert.equal(actions.length, 9);
                assert.deepEqual(ui_acts, [
                    // Undo client, do cloud, client is conflicted
                    { data: 'Two',
                      type: 'R',
                      path: [ 'One', 'In Client' ],
                      time: 300 },
                    { type: 'D',
                      path: [ 'One', 'Two' ],
                      time: 900 } ]);
                assert.deepEqual(actions,
                    full_tree_actions.concat(
                        [{ type: 'D',
                           path: [ 'One', 'Two' ],
                           time: 900 },
                         {
                             data: "In Client",
                             path: [ "One", "Two" ],
                             time: 950,
                             type: "R"
                         }]));
                assert.equal(progress.length, 1);
                assert.equal(progress[0].severity, "warning");
                assert.equal(progress[0].message, "Cannot rename 'One↘Two': it does not exist");
            });
        });
    });
    
    tr.addTest("synchronise and save", function() {
        let debug;// = console.debug;
        let cliest = new MemoryStore();
        let cloust = new MemoryStore();

        // Add an action to the cloud
        let acts = full_tree_actions.slice();
        let cloud_act = new Action({type:"N", path:["One", "From Cloud"], time:960, data:"4"});
        acts.push(cloud_act);
        let h;
        let progress = [];
        
        return make_cloud(acts, cloust)
        .then(() => {
            // Populate the client with the base tree
            return make_client(full_tree_actions, cliest);
        })
        .then(() => {
            h = new Hoarder({
                debug: debug,
                cloudPath: "blah",
                clientStore: cliest,
                cloudStore: cloust,
                last_sync: 900
            });
            return h.load_client();
        })
        .then(() => {
            // Add a local action in the client
            let act = new Action({type:"N", path:["One", "Five"], time:950, data:"5"});
            return h.hoard.play_action(act);
        }).then((c) => {
            assert(!c.conflict);
            return h.synchronise(progress);
        })
        .then((actions) => {
            assert.equal(actions.length, 9);
            return h.save_cloud(actions, progress)
        })
        .then(() => {
            return h.save_client(progress);
        })
        .then(() => {
            assert.equal(progress.length, 2);
            assert.equal(progress[0].message, "Saved in cloud");
            assert.equal(progress[1].message, "Saved in browser");
            let clieh = new Hoard({ debug: debug,
                hoard: JSON.parse(Utils.Uint8ArrayToString(cliest.data.client)).hoard });
            let clouh = new Hoard({ debug: debug});
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

    tr.addTest("encrypted synchronise", function() {
        let debug;// = console.debug;
        let cliest = new EncryptedStore({ understore: new MemoryStore() });
        let cloust = new EncryptedStore({ understore: new MemoryStore() });

        // Add an action to the cloud
        let acts = full_tree_actions.slice();
        let cloud_act = new Action({type:"N", path:["One", "From Cloud"], time:960, data:"4"});
        acts.push(cloud_act);
        let h;
        let progress = [];
        
        return make_cloud(acts, cloust)
        .then(() => {
            // Populate the client with the base tree
            return make_client(full_tree_actions, cliest);
        })
        .then(() => {
            h = new Hoarder({
                debug: debug,
                cloudPath: "blah",
                clientStore: cliest,
                cloudStore: cloust,
                last_sync: 900
            });
            h.authenticate({ user: "test", pass: "pass" });
            return h.load_client();
        })
        .then(() => {
            // Add a local action in the client
            let act = new Action({type:"N", path:["One", "Five"], time:950, data:"5"});
            return h.hoard.play_action(act);
        }).then((c) => {
            assert(!c.conflict);
            let acted = 0, progress = [];
            return h.synchronise(progress);
        })
        .then((actions) => {
            assert.equal(actions.length, 9);
            return h.save_cloud(actions, progress)
        })
        .then(() => {
            return h.save_client(progress);
        });
    });

    tr.addTest("synchronise unreadable cloud", function() {
        let debug;// = console.debug;
        let cliest = new MemoryStore();
        let cloust = new MemoryStore();

        // Add an action to the cloud
        let acts = full_tree_actions.slice();
        let cloud_act = new Action({type:"N", path:["One", "From Cloud"], time:960, data:"4"});
        acts.push(cloud_act);

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
                h.hoard.play_action(act);
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
        let cloud_act = new Action({type:"N", path:["One", "From Cloud"], time:960, data:"4"});
        acts.push(cloud_act);

        return make_cloud(acts, cloust)
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

    tr.run();
});
