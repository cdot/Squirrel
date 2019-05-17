/*@preserve Copyright (C) 2015-2019 Crawford Currie http://c-dot.co.uk license MIT*/
/*eslint-env shared-node-browser, mocha */

if (typeof requirejs === "undefined")
    requirejs = require('requirejs');

requirejs.config({
    baseUrl: ".."
});

var cloud_actions = [
    // Action already in the client
    {
	type: "N",
	time: Date.UTC(2000,0),
	path: ["FineDining"]
    },
    // Action not in the client yet
    {
	type: "N",
	time: Date.UTC(2002,0),
	path: [ "FineDining", "Caviar" ]
    }
];

// Client hoard, with populated cache and action stream
var client_actions = [
    // Duplicate an action that is already in the cloud, different date
    {
	type: "N",
	time: Date.UTC(2000,0,1),
	path: ["FineDining"]
    },
    {
	// Add an action that isn't in the cloud yet
	type: "N",
	time: Date.UTC(2003,0,1),
	path: ["FineDining", "Truffles" ],
        data: "Fungi"
    }
];

const MSPERDAY = 24 * 60 * 60 * 1000;

requirejs(["js/Hoard", "js/Action", "test/TestRunner"], function(Hoard, Action, TestRunner) {
    let tr = new TestRunner("Hoard");
    let assert = tr.assert;
    
    tr.addTest("should play_actions into empty hoard", function() {
        let debug;// = console.debug;
        let h = new Hoard({debug: debug});
        let original = Hoard._copy_tree(h.tree);
        assert(original);
        assert.deepEqual(original.data, {});
        assert(original.time);
	for (let act of cloud_actions) {
            h.play_action(act)
            .then((r) => {
                assert.deepEqual(r.action, act);
                assert(!r.conflict);
            });
        }
	assert.deepEqual(h.tree, {
            data: {
                FineDining: {
	            time: Date.UTC(2002,0),
	            data:{
	                Caviar: {
		            time: Date.UTC(2002,0),
		            data: {}
	                }
	            }
                }
            },
            // Touched at the time "FineDining" was stamped
            time: Date.UTC(2000,0)
        });
        assert.equal(h.history.length, 2);
    });

    tr.addTest("should play_actions into populated hoard", function() {
        let debug;// = console.debug;
	// Play the cloud action set into a populated client hoard
	var h = new Hoard({actions: client_actions, debug: debug});
	for (let act of cloud_actions) {
	    h.play_action(act, true)
            .then((r) => {
                assert.deepEqual(r.action, act);
                // There should be no conflict for the duplicate "N"
                assert(!r.conflict);
            });
        }
	assert.deepEqual(h.tree, {
	    data:{
		FineDining:{
		    time:Date.UTC(2002,0),
		    data:{
			Caviar:{
			    time:Date.UTC(2002,0),
			    data:{}
			},
			Truffles: {
			    time: Date.UTC(2003,0),
			    data: "Fungi"
			}
		    }
		}
	    },
	    time: h.tree.time
	});
    });

    tr.addTest('should play_action N (node)', function() {
        let debug;// = console.debug;
        let h = new Hoard({debug: debug});
        let original = Hoard._copy_tree(h.tree);
        let act = new Action({
	    type: "N",
	    time: Date.UTC(2002,0),
	    path: [ "Lunch" ]
        });
        return h.play_action(act)
        .then((c) => {
            assert(!c.conflict);
            assert.deepEqual(h.tree, {
                data: {
                    Lunch: {
	                time: Date.UTC(2002,0),
	                data:{}
                    }
                },
                time: Date.UTC(2002,0)
            });   
            assert.equal(h.history.length, 1);
            assert.deepEqual(h.history[0].redo, act);
            assert.equal(h.history[0].undo.type, "D");
            assert.deepEqual(h.history[0].undo.path, [ "Lunch" ]);
            return h.undo();
        })
        .then(() => {
            assert.equal(h.history.length, 0);
            // Replayed to empty tree
            assert.deepEqual(h.tree, original);
        });
    });
    
    tr.addTest('should play_action N (leaf)', function() {
        let debug;// = console.debug;
        let h = new Hoard({debug: debug});
        let original = Hoard._copy_tree(h.tree);
        let act = new Action({
	    type: "N",
	    time: Date.UTC(2002,0),
	    path: [ "Lunch" ],
            data: "Sausages"
        });
        return h.play_action(act)
        .then((c) => {
            assert(!c.conflict);
            assert.deepEqual(h.tree, {
                data: {
                    Lunch: {
	                time: Date.UTC(2002,0),
	                data: "Sausages"
                    }
                },
                time: Date.UTC(2002,0)
            });
            assert.equal(h.history.length, 1);
            assert.deepEqual(h.history[0].redo, act);
            assert.equal(h.history[0].undo.type, "D");
            assert.deepEqual(h.history[0].undo.path, [ "Lunch" ]);
            return h.undo();
        })
        .then(() => {
            assert.equal(h.history.length, 0);
            assert.deepEqual(h.tree, original);
        });
    });

    tr.addTest('should not play_action N on leaf', function() {
        let debug;// = console.debug;
        let h = new Hoard({debug: debug});
        let original = Hoard._copy_tree(h.tree);
        return h.play_action({
	    type: "N",
	    time: Date.UTC(2002,0),
	    path: [ "Lunch" ],
            data: "Sausages"
        }, false)
        .then((c) => {
            assert(!c.conflict);
            return h.play_action({
	        type: "N",
	        time: Date.UTC(2002,0),
	        path: [ "Lunch", "Break" ],
                data: "Crisps"
            }).then((c) => {
                assert(c.conflict);
                assert.deepEqual(h.tree, {
                    data: {
                        Lunch: {
	                    time: Date.UTC(2002,0),
	                    data: "Sausages"
                        }
                    },
                    time: Date.UTC(2002,0)
                });
            });
            assert.equal(h.history.length, 0);
        });
    });

    tr.addTest('should play_action M', function() {
        let debug;// = console.debug;
        let h = new Hoard({debug: debug});
	for (let act of cloud_actions) {
	    h.play_action(act, false);
        }
	h.play_action({
	    type: "N",
	    time: Date.UTC(2001,0,1),
	    path: ["FineDining", "Roe" ],
        }, false);
	h.play_action({
	    type: "N",
	    time: Date.UTC(2003,0,1),
	    path: ["FineDining", "Caviar", "Sevruga" ],
            data: "Meaty"
        }, false);
	h.play_action({
	    type: "N",
	    time: Date.UTC(2004,0,1),
	    path: ["FineDining", "Caviar", "Beluga" ],
            data: "Fishy"
        }, false);

        let original = Hoard._copy_tree(h.tree);
        
        // Move Beluga to be a subnode of Roe
        let act = new Action({
	    type: "M",
	    time: Date.UTC(2005,0),
	    path: ["FineDining", "Caviar", "Beluga"],
            data: [ "FineDining", "Roe" ]
        });
	return h.play_action(act)
        .then((r) => {
            assert(!r.conflict);
            assert.equal(h.history.length, 1);
            assert.deepEqual(h.history[0].redo, act);
            assert.equal(h.history[0].undo.type, "M");
            assert.deepEqual(h.history[0].undo.data, ["FineDining", "Caviar"]);
            assert.deepEqual(h.history[0].undo.path, ["FineDining", "Roe", "Beluga"]);
            assert.equal(h.history[0].undo.time, Date.UTC(2004,0));
	    assert.deepEqual(h.tree, {
                data: {
                    FineDining: {
	                time: Date.UTC(2001,0),
	                data:{
	                    Caviar: {
		                time: Date.UTC(2005,0),
		                data: {
                                    Sevruga: {
	                                time: Date.UTC(2003,0,1),
                                        data: "Meaty"
                                    }
                                }
	                    },
                            Roe: {
		                time: Date.UTC(2005,0),
                                data: {
                                    Beluga: {
                                       	time: Date.UTC(2004,0,1),
                                        data: "Fishy"
                                    }
                                }
                            }
	                }
                    }
                },
                time: Date.UTC(2000,0)
            });
        })
        .then(() => {
            return h.undo();
        }).then((r) => {
            assert(!r.conflict);
            // The time for "Roe" will not be restored to the original
            // creation time, but will get the time on "Caviar"
            // - this is an accepted limitation of the move process, it's
            // not perfectly symmetrical
            original.data["FineDining"].data.Roe.time
              = original.data["FineDining"].data.Caviar.time;
	    assert.deepEqual(h.tree, original);
        });
    });

    tr.addTest('should play_action R', function() {
        let debug;// = console.debug;
        let h = new Hoard({debug: debug});
	for (let act of client_actions) {
	    h.play_action(act, false);
        }

        let original = Hoard._copy_tree(h.tree);

        let act = new Action({
	    type: "R",
	    time: Date.UTC(2005,0),
	    path: ["FineDining", "Truffles"],
            data: "Earthball"
        });
	return h.play_action(act)
        .then((r) => {
            assert(!r.conflict);
	    assert.deepEqual(h.tree, {
                data: {
                    FineDining: {
	                time: Date.UTC(2005,0),
	                data:{
	                    Earthball: {
		                time: Date.UTC(2003,0),
		                data: "Fungi"
	                    }
	                }
                    }
                },
                time: Date.UTC(2000,0)
            });
            assert.equal(h.history.length, 1);
            assert.deepEqual(h.history[0].redo, act);
            assert.equal(h.history[0].undo.type, "R");
            assert.equal(h.history[0].undo.data, "Truffles");
            assert.deepEqual(h.history[0].undo.path, ["FineDining", "Earthball"]);
            assert.equal(h.history[0].undo.time, Date.UTC(2003,0,1));
            return h.undo();
        })
        .then((r) => {
            assert(!r.conflict);
            assert.equal(h.history.length, 0);
	    assert.deepEqual(h.tree, original);
        });
    });

    tr.addTest('should play_action E', function() {
        let debug;// = console.debug;
        let h = new Hoard({debug: debug});
	for (let act of client_actions) {
	    h.play_action(act, false);
        }

        let original = Hoard._copy_tree(h.tree);

        let act = new Action({
	    type: "E",
	    time: Date.UTC(2005,0),
	    path: ["FineDining", "Truffles"],
            data: "Earthball"
        });
	return h.play_action(act)
        .then((r) => {
            assert(!r.conflict);
	    assert.deepEqual(h.tree, {
                data: {
                    FineDining: {
	                time: Date.UTC(2003,0,1),
	                data:{
	                    Truffles: {
		                time: Date.UTC(2005,0),
		                data: "Earthball"
	                    }
	                }
                    }
                },
                time: Date.UTC(2000,0)
            });
            assert.equal(h.history.length, 1);
            assert.deepEqual(h.history[0].redo, act);
            assert.equal(h.history[0].undo.type, "E");
            assert.equal(h.history[0].undo.data, "Fungi");
            assert.deepEqual(h.history[0].undo.path, ["FineDining", "Truffles"]);
            assert.equal(h.history[0].undo.time, Date.UTC(2003,0,1));
            return h.undo();
        })
        .then((r) => {
            assert(!r.conflict);
            assert.equal(h.history.length, 0);
	    assert.deepEqual(h.tree, original);
        });
    });

    tr.addTest('should play_action X', function() {
        let debug;// = console.debug;
        let h = new Hoard({debug: debug});
	for (let act of client_actions) {
	    h.play_action(act, false);
        }
        let original = Hoard._copy_tree(h.tree);
        let act = new Action({
	    type: "X",
	    time: Date.UTC(2005,0),
	    path: ["FineDining", "Truffles"],
            data: { size: 1, chars: "2" }
        });
	return h.play_action(act)
        .then((r) => {
            assert(!r.conflict);
	    assert.deepEqual(h.tree, {
                data: {
                    FineDining: {
	                time: Date.UTC(2003,0,1),
	                data:{
	                    Truffles: {
		                time: Date.UTC(2005,0),
		                data: "Fungi",
                                constraints: { size: 1, chars: "2" }
	                    }
	                }
                    }
                },
                time: Date.UTC(2000,0)
            });
            assert.equal(h.history.length, 1);
            assert.deepEqual(h.history[0].redo, act);
            assert.equal(h.history[0].undo.type, "X");
            assert.isUndefined(h.history[0].undo.data);
            assert.deepEqual(h.history[0].undo.path, ["FineDining", "Truffles"]);
            assert.equal(h.history[0].undo.time, Date.UTC(2003,0,1));
            return h.undo();
        })
        .then((r) => {
            assert(!r.conflict);
            assert.equal(h.history.length, 0);
	    assert.deepEqual(h.tree, original);
        });
    });

    tr.addTest('should play_action D/I', function() {
        let debug;// = console.debug;
        let h = new Hoard({debug: debug});
	for (let act of client_actions) {
	    h.play_action(act, false);
        }
        let original = Hoard._copy_tree(h.tree);
        let act = new Action({
	    type: "D",
	    time: Date.UTC(2005,0),
	    path: ["FineDining", "Truffles"],
            data: "1;2"
        });
	return h.play_action(act).then((r) => {
            assert(!r.conflict);
	    assert.deepEqual(h.tree, {
                data: {
                    FineDining: {
	                time: Date.UTC(2005,0,1),
	                data:{}
                    }
                },
                time: Date.UTC(2000,0)
            });
            assert.equal(h.history.length, 1);
            assert.deepEqual(h.history[0].redo, act);
            assert.equal(h.history[0].undo.type, "I");
            assert(h.history[0].undo.data);
            assert.deepEqual(h.history[0].undo.path, ["FineDining", "Truffles"]);
            assert.equal(h.history[0].undo.time, Date.UTC(2003,0,1));
            return h.undo();
        })
        .then((r) => {
            assert(!r.conflict, r.conflict);
            assert.equal(h.history.length, 0);
	    assert.deepEqual(h.tree, original);
        });
    });

    tr.addTest('should play_action A/C', function() {
        let debug;// = console.debug;
        let h = new Hoard({debug: debug});
	for (let act of cloud_actions) {
	    h.play_action(act, false);
        }
        let original = Hoard._copy_tree(h.tree);
        let act = new Action({
	    type: "A",
	    time: Date.UTC(2005,0),
	    path: ["FineDining", "Caviar"],
            data: 1
        });
	return h.play_action(act).then((r) => {
            assert(!r.conflict);
	    assert.deepEqual(h.tree, {
                data: {
                    FineDining: {
	                time: Date.UTC(2002,0),
	                data:{
	                    Caviar: {
		                time: Date.UTC(2005,0),
		                data: {},
                                alarm: {
                                    due: Date.UTC(2005,0,2),
                                    repeat: 1 * 24 * 60 * 60 * 1000
                                }
	                    }
	                }
                    }
                },
                time: Date.UTC(2000,0)
            });
            assert.equal(h.history.length, 1);
            assert.deepEqual(h.history[0].redo, act);
            assert.equal(h.history[0].undo.type, "C");
            assert.deepEqual(h.history[0].undo.path, ["FineDining", "Caviar"]);
            assert.equal(h.history[0].undo.time, Date.UTC(2002,0));
            return h.undo();
        })
        .then((r) => {
            assert(!r.conflict);
            assert.equal(h.history.length, 0);
	    assert.deepEqual(h.tree, original);
        });
    });

    tr.addTest('should make from actions', function() {
        let debug;// = console.debug;
        let h = new Hoard({actions: cloud_actions, debug: debug});
        assert.deepEqual(h.tree, {
            data: {
                FineDining: {
	            time: Date.UTC(2002,0),
	            data:{
	                Caviar: {
		            time: Date.UTC(2002,0),
		            data: {}
	                }
	            }
                }
            },
            // Touched at the time "FineDining" was stamped
            time: Date.UTC(2000,0)
        });
        assert.equal(h.history.length, 0);
    });

    tr.addTest('should make from hoard', function() {
        let debug;// = console.debug;
        let h1 = new Hoard({actions: cloud_actions, debug: debug});
        let h = new Hoard({hoard: h1, debug: debug});
        assert.deepEqual(h1, h);
    });

    tr.addTest('should conflict: zero path', function() {
        let debug;// = console.debug;
        let h = new Hoard({debug: debug});
        let act = new Action({
	    type: "N",
	    time: Date.UTC(2004,0),
	    path: []
	});
	return h.play_action(act).then((c) => {
	    assert.equal(c.conflict, "Cannot create '': Zero length path");
            assert.deepEqual(c.action, act);
        });
    });

    tr.addTest('should conflict: no parent', function() {
        let debug;// = console.debug;
        let h = new Hoard({debug: debug});
	for (let act of cloud_actions) {
	    h.play_action(act);
        }
	let act = new Action({
	    type: "N",
	    time: Date.UTC(2004,0),
	    path: ["Junk", "Burger"]
        });
        return h.play_action(act)
        .then((r) => {
	    assert.equal(r.conflict,
                         "Cannot create 'Junk↘Burger': not found");
            assert.deepEqual(r.action, act);
        });
    });

    tr.addTest('should conflict: no such node (delete)', function() {
        let debug;// = console.debug;
        let h = new Hoard({debug: debug});

	// No cache, so promise should be resolved will be called
	return h.play_action({
            type: "D",
            path: ["FineDining", "La Gavroche"]
        }).then((c) => {
            assert.equal(
                c.conflict,
                "Cannot delete 'FineDining↘La Gavroche': not found");
        });
    });

    tr.addTest('should conflict: no such node (edit)', function() {
        let debug;// = console.debug;
        let h = new Hoard({debug: debug});

        let kfc = {
	    type: "E",
	    time: Date.UTC(2004,0),
	    path: ["FineDining", "Doner"]
	};

	return h.play_action(cloud_actions[0])
	.then((e) => {
		assert.equal(cloud_actions[0], e.action);
	        return h.play_action(kfc);
            }).then((e) => {
                let c = e.conflict;
	        assert.equal(c,
                             "Cannot change value of 'FineDining↘Doner': it does not exist");
                assert.equal(e.action, kfc);
            });
    });

    tr.addTest('should merge action streams', function() {
        let debug;// = console.debug;
        let cloud = new Hoard({debug: debug});
        // Initial action stream is empty
        let m = Hoard.merge_actions([], cloud_actions.slice());
        assert.deepEqual(m, cloud_actions);

        // Merging should skip duplicates
        m = Hoard.merge_actions(m, cloud_actions.slice());
        assert.deepEqual(m, cloud_actions);

        m = Hoard.merge_actions(cloud_actions.slice(),
                                client_actions.slice());

        assert.deepEqual(
            m,
            [
                cloud_actions[0],
                cloud_actions[1],
                client_actions[1],
            ]);

        // A merge the other way should work the same
        m = Hoard.merge_actions(client_actions.slice(),
                                cloud_actions.slice());
        assert.deepEqual(
            m,
            [
                cloud_actions[0],
                cloud_actions[1],
                client_actions[1],
            ]);
    });

    tr.addTest("should ring alarms", function() {
        let debug;// = console.debug;
        let actions = [
            {
	        type: "N",
	        time: Date.UTC(2000,0),
	        path: ["FineDining"]
            },
            {
	        type: "A",
	        time: Date.UTC(2007,0,30),
                data: 200, // should be interpreted as "200 days from
                // the time the alarm was added"
                ring_expected: Date.UTC(2007,7,18),
	        path: [ "FineDining" ]
            },
            {
	        type: "N",
	        time: Date.UTC(2001,6,01),
	        path: [ "FineDining", "Caviare" ]
            },
            {
	        type: "N",
	        time: Date.UTC(2002,0,01),
	        path: [ "FineDining", "Caviare", "Beluga" ],
                data: "£6.70 per gram"
            },
            {
                type: "A",
	        path: [ "FineDining", "Caviare", "Beluga" ],
	        time: Date.UTC(2003,0,01),
                ring_expected: Date.UTC(2003,3,11),
                data: {
                    due: Date.UTC(2003,3,11),
                    repeat: 3600000000
                }
            }
        ];
        let cloud = new Hoard({actions: actions, debug: debug});
        return cloud.check_alarms(function(path, rang_at) {
            for (let a of actions) {
                if (a.type === "A" && TestRunner.samePath(a.path, path)) {
                    assert(!a.rung);
                    assert.equal(
                        rang_at.getTime(), a.ring_expected,
                    
                        rang_at.toUTCString() + "!="
                        + new Date(a.ring_expected).toUTCString()
                        + " at " + path);
                    a.rung = true;
                }
            }
            return Promise.resolve();
        })
        .then(() => {
            for (let act of actions) {
                if (act.type === "A" && "ring_expected" in act)
                    assert(act.rung,
                           new Action(act).verbose()
                           + " did not ring at "
                           + new Date(act.ring_expected).toUTCString());
            }
                
            assert.equal(cloud.tree.data["FineDining"].alarm.repeat,
                         17280000000);
            assert.equal(
                cloud.tree.data["FineDining"].data.Caviare.data.Beluga.alarm.repeat,
                3600000000);
        });
    });

    tr.addTest("get_node", function() {
        let debug;// = console.debug;
        const actions = [
            {
	        type: "N",
	        time: Date.UTC(2000,0,01),
	        path: ["A"]
            },
            {
	        type: "N",
	        time: Date.UTC(2001,6,01),
	        path: [ "A", "A" ]
            },
            {
	        type: "N",
	        time: Date.UTC(2002,0,01),
	        path: [ "A", "B" ]
            },
            {
	        type: "N",
	        time: Date.UTC(2002,0,01),
	        path: [ "A", "C" ]
            },
            {
                type: "N",
	        path: [ "A", "B", "C" ],
	        time: Date.UTC(2003,0,01)
            },
            {
	        type: "N",
	        time: Date.UTC(2002,0,02),
	        path: ["A", "C"]
            },
        ];
        let cloud = new Hoard({debug: debug});
	for (let act of actions) {
	    cloud.play_action(act);
        }
        cloud.play_action({
	    type: "N",
	    time: Date.UTC(2001,6,01),
	    path: [ "A", "A" ]
        });
        let n = cloud.get_node(["A", "B", "C"]);
        assert.equal(n.time, Date.UTC(2003,0,01));
        n = cloud.get_node(["A", "A"]);
        assert.equal(n.time, Date.UTC(2001,6,01));
        n = cloud.get_node(["A", "B", "D"]);
        assert.isNull(n);
    });

    const full_tree_actions = [
        {
	    type: "N",
	    time: 100,
	    path: ["FineDining"]
        },
        {
	    type: "A",
	    time: 200,
            data: { due: Date.UTC(2015,3,4), repeat: 10 },
	    path: ["FineDining"]
        },
        {
	    type: "N",
	    time: 300,
	    path: [ "FineDining", "Caviare" ]
        },
        {
	    type: "N",
	    time: 400,
	    path: [ "FineDining", "Caviare", "Beluga" ],
            data: "£6.70 per gram"
        },
        {
            type: "A",
	    path: [ "FineDining", "Caviare", "Beluga" ],
	    time: 500,
            data: {
                due: Date.UTC(2007,11,25),
                repeat: 100
            }
        },
        {
            type: "A",
	    path: [ "FineDining", "Caviare" ],
	    time: 600,
            data: {
                due: Date.UTC(2005,3,1),
                repeat: 365}
        },
        {
	    type: "X",
	    time: 300,
	    path: [ "FineDining", "Caviare", "Beluga" ],
            data: { size: 32, chars: "A-Z;0-9" }
        }
    ];

    let full_tree_json = {
        FineDining: {
            time: 300,
            data: {
                Caviare: {
                    time: 600,
                    data: {
                        Beluga: {
                            time: 300,
                            data: "£6.70 per gram",
                            alarm: {
                                due: Date.UTC(2007,11,25),
                                repeat: 100
                            },
                            constraints: { size: 32, chars: "A-Z;0-9" }
                        }
                    },
                    alarm: {
                        due: Date.UTC(2005,3,1),
                        repeat: 365
                    }
                }
            },
            alarm: {
                due: Date.UTC(2015,3,4), repeat: 10
            }
        }
    };

    tr.addTest("actions from tree", function() {
        let debug;// = console.debug;
        let cloud = new Hoard({debug: debug, actions: full_tree_actions});

        // Make sure we can construct from the tree
	let h = new Hoard({debug: debug, tree: cloud.tree});
        assert.deepEqual(h.tree, cloud.tree);
 
        let acts = cloud.actions_to_recreate();
        assert.deepEqual(acts, [
            { type: 'N', path: [ 'FineDining' ],
              time: 300 }, // creation of 'Caviare',
            { type: 'A', path: [ 'FineDining' ],
              time: 300,
              data: {
                  due: Date.UTC(2015,3,4), repeat: 10
              }},
            { type: 'N', path: [ 'FineDining', 'Caviare' ],
              time: 600 }, // alarm
            { type: 'A', path: [ 'FineDining', 'Caviare' ],
              time: 600,
              data: {
                  due: Date.UTC(2005,3,1),
                  repeat: 365
              }},
            { type: 'N', path: [ 'FineDining', 'Caviare', 'Beluga' ],
              time: 300,
              data: '£6.70 per gram' },
            { type: 'A', path: [ 'FineDining', 'Caviare', 'Beluga' ],
              time: 300,
              data: {
                  due: Date.UTC(2007,11,25),
                  repeat: 100
              }},
            { type: 'X', path: [ 'FineDining', 'Caviare', 'Beluga' ],
              time: 300,
              data: { size: 32, chars:"A-Z;0-9" }
            }
        ]);
    });
    
    tr.addTest("generate correct JSON", function() {
        let debug;// = console.debug;
        let cloud = new Hoard({debug: debug});
	for (let act of full_tree_actions) {
	    cloud.play_action(act);
        }
        assert.equal(JSON.stringify(cloud.tree, null, " "),
                     JSON.stringify({ data: full_tree_json, time: 100 }, null, " "));
    });

    let tra =  {
        data: {
            Constraints: {
	        time: Date.UTC(2001,0),
	        constraints: { size: 1, chars: "2" },
                data: "constrained"
            },
            Alarm: {
	        time: Date.UTC(2002,0),
	        alarm: 1234567890,
                data: "alarm"
            },
            Data: {
	        time: Date.UTC(2003,0),
                data: "before"
            },
            Tree: {
	        time: Date.UTC(2004,0),
                data: {
                    A: {
	                time: Date.UTC(2005,0),
                        data: "a"
                    },
                    B: {
	                time: Date.UTC(2006,0),
                        data: "b"
                    },
                    C: {
	                time: Date.UTC(2007,0),
                        data: "c"
                    }
                }
            },
        }
    };

    let trb =  {
        data: {
            Constraints: {
	        time: Date.UTC(2001,0),
	        constraints: { size: 2, chars: "1" },
                data: "constrained"
            },
            Alarm: {
	        time: Date.UTC(2002,0),
	        alarm: 9876543210,
                data: "alarm"
            },
            Data: {
	        time: Date.UTC(2003,0),
                data: "after"
            },
            Tree: {
	        time: Date.UTC(2004,0),
                data: {
                    A: {
	                time: Date.UTC(2005,0),
                        data: "a"
                    },
                    C: {
	                time: Date.UTC(2007,0),
                        data: "c"
                    },
                    D: {
	                time: Date.UTC(2008,0),
                        data: "d"
                    },
                }
            },
        }
    };

    let tre = [
        { type: "X",
          path: [ 'Constraints' ],
          constraints: { size: 2, chars: "1" }
        },
        {
            type:"A",
            path: [ 'Alarm' ],
            alarm: 9876543210
        },
        {
            type:"E",
            path: [ 'Data' ],
            data: 'after'
        },
        {
            type:"D",
            path: [ 'Tree', 'B' ]
        },
        {
            type: "I",
            path: [ 'Tree' ],
            data: JSON.stringify({
                name: 'D',
                node: { time: Date.UTC(2008,0), data: 'd' }
            })
        }
    ];

    tr.addTest("should diff", function() {
        let debug;// = console.debug;
        let ah = new Hoard({debug: debug});
        ah.tree = tra;

        let bh = new Hoard({debug: debug});
        bh.tree = trb;

        ah.diff(bh, (act) => {
            let matched = false;
            for (let x of tre) {
                if (x.type === act.type && !x.matched) {
                    delete x.time; delete act.time;
                    assert.deepEqual(act, x);
                    x.matched = matched = true;
                    break;
                }
            }
            assert(matched, act.type);
        });
        for (let x of tre)
            assert(x.matched, x.type);

    });

    tr.run();
});
