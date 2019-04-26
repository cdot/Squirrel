/*@preserve Copyright (C) 2019 Crawford Currie http://c-dot.co.uk license MIT*/
/*eslint-env shared-node-browser, mocha */

if (typeof module !== "undefined") {
    requirejs = require('requirejs');
    requirejs.config({
        baseUrl: ".."
    });
}

requirejs(["js/Hoarder", "js/Hoard", "js/LocalStorageStore", "test/MemoryStore", "test/TestRunner"], function(Hoarder, Hoard, LocalStorageStore, MemoryStore, TestRunner) {
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
	    time: 300,
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
            let act = Hoard.new_action("N", ["One", "Four"], Date.now(), 4);
            return h.add_action(act)
            .then((res) => {
                assert(!res.conflict);
                assert.equal(res.event, act);
                assert.deepEqual(h.hoard.actions, [ act ]);
            })
            .then(() => {
                let nact = Hoard.new_action("N", ["One", "Four"], Date.now(), 5);
                return h.add_action(nact)
                .then((res) => {
                    assert(!res.conflict);
                    assert.deepEqual(res.event, nact);
                });
            });
        });
    });

    function make_cloud(actions, store, debug) {
        return store.writes("blah", JSON.stringify(actions));
    }

    function make_client(actions, store, debug) {
        let clierd = new Hoard(debug);
        return clierd.play_actions(full_tree_actions)
        .then(() => {
                        console.log(clierd.JSON());
            return store.writes("client", JSON.stringify({
                cloud_path: "blah",
                hoard: clierd
            }));
        });
    }

    // Simple update involving a local change and a remote change
    // that overlap. The update from the cloud should play the
    // remote change into the local hoard
    tr.addTest("simple_update_from_cloud", function() {
        let debug = console.debug;
        let cliest = new MemoryStore();
        let cloust = new MemoryStore();

        // Add an action to the cloud
        let acts = full_tree_actions.slice();
        let clact = Hoard.new_action("N", ["One", "Four"], 960, "4");
        acts.push(clact);

        make_cloud(acts, cliest)
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
                let act = Hoard.new_action("N", ["One", "Five"], 950, "5");
                h.add_action(act);
                
                return h.update_from_cloud(
                    (m) => {
                        console.log("Progress", m);
                    },
                    (a) => {
                        assert.deepEqual(a.event, clact);
                    })
                .then(() => {
                    console.log(h.hoard.JSON())
                });
            });
        });
    });

    tr.addTest("undo", function() {
    });
    
    tr.addTest("each_pending_action", function() {
    });

    tr.addTest("authenticate_client", function() {
    });

    tr.addTest("synchronise_and_save", function() {
    });

    tr.addTest("check_alarms", function() {
    });

    tr.run();
});
