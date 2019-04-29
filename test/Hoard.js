/*@preserve Copyright (C) 2015-2019 Crawford Currie http://c-dot.co.uk license MIT*/
/*eslint-env shared-node-browser, mocha */

if (typeof requirejs === "undefined")
    requirejs = require('requirejs');

requirejs.config({
    baseUrl: ".."
});

var cloud_data = {
    actions: [
	// Action already in the client
	{
	    type: "N",
	    time: Date.UTC(2000,0),
	    path: ["Fine-dining"]
	},
	// Action not in the client yet
	{
	    type: "N",
	    time: Date.UTC(2002,0),
	    path: [ "Fine-dining", "Caviar" ]
	}
    ],
    tree: null,
    version: 1
};

// Client hoard, with populated cache and action stream
var client_data = {
    actions: [
	// Duplicate an action that is already in the cloud
	cloud_data.actions[0],
	{
	    // Add an action that isn't in the cloud yet
	    type: "N",
	    time: Date.UTC(2003,0,01),
	    path: ["Fine-dining", "Truffles" ],
            data: "Fungi"
	}],
    tree: {
	data: {
	    "Fine-dining": {
		time: Date.UTC(2000,0),
		data:{
		    Truffles: {
			time: Date.UTC(2003,0),
			data: {}
		    }
		}
	    }
	},
	time:1513078020279
    },
    version: 1
};

var client_size = client_data.actions.length;
var cloud_size = cloud_data.actions.length;
var Hoard;

const MSPERDAY = 24 * 60 * 60 * 1000;

requirejs(["js/Hoard", "js/Action", "test/TestRunner"], function(Hoard, Action, TestRunner) {
    let tr = new TestRunner("Hoard");
    let assert = tr.assert;

    tr.addTest('should make with data and string', function() {
        let h = new Hoard(cloud_data);
	assert.equal(h.actions[0].path[0], cloud_data.actions[0].path[0]);
	h = new Hoard(JSON.stringify(cloud_data));
	assert.equal(h.actions[0].path[0], cloud_data.actions[0].path[0]);
        assert.equal(client_data.actions.length, client_size);
        assert.equal(cloud_data.actions.length, cloud_size);
    });

    tr.addTest("should play_actions into empty hoard", function() {
	// Reconstruct a cache from an actions list in an empty hoard
        let h = new Hoard({});
	for (let act of cloud_data.actions) {
            h.play_action(act)
            .then((r) => {
                assert.deepEqual(r.action, act);
                assert(!r.conflict);
            });
        }
	assert.deepEqual(h.tree, {
	    data:{
		"Fine-dining":{
		    time:Date.UTC(2002,0),
		    data:{
			Caviar:{
			    time:Date.UTC(2002.0),
			    data:{}
			}
		    }
		}
	    },
	    "time": h.tree.time
	});
	assert.equal(h.actions.length, 0);
        assert.equal(client_data.actions.length, client_size);
        assert.equal(cloud_data.actions.length, cloud_size);
    });

    tr.addTest("should play_actions into populated hoard", function() {
	// Play the cloud action set into a populated client hoard
	var h = new Hoard(client_data);
	assert(h.tree.data["Fine-dining"].data.Truffles);
	for (let act of cloud_data.actions) {
	    h.play_action(act)
            .then((r) => {
                assert.deepEqual(r.action, act);
                assert(!r.conflict);
            });
        }
	assert.deepEqual(h.tree, {
	    data:{
		"Fine-dining":{
		    time:Date.UTC(2002,0),
		    data:{
			Caviar:{
			    time:Date.UTC(2002,0),
			    data:{}
			},
			Truffles: {
			    time: Date.UTC(2003,0),
			    data: {}
			}
		    }
		}
	    },
	    time: h.tree.time
	});
        assert.equal(client_data.actions.length, client_size);
        assert.equal(cloud_data.actions.length, cloud_size);
    });

    tr.addTest('should conflict: zero path', function() {
        let h = new Hoard({});
        let act = new Action({
	    type: "N",
	    time: Date.UTC(2004,0),
	    path: []
	});
	return h.play_action(act).then((c) => {
	    assert.equal(c.conflict, "Cannot create '': Zero length path");
            assert.deepEqual(c.action, act);
            assert.equal(client_data.actions.length, client_size);
            assert.equal(cloud_data.actions.length, cloud_size);
        });
    });

    tr.addTest('should conflict: no parent', function() {
        let h = new Hoard({});
	for (let act of cloud_data.actions) {
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
            assert.equal(client_data.actions.length, client_size);
            assert.equal(cloud_data.actions.length, cloud_size);
        });
    });

    tr.addTest('should conflict: no such node (delete)', function() {
        let h = new Hoard({});

	// No cache, so promise should be resolved will be called
	return h.play_action({
            type: "D",
            path: ["Fine-dining", "La Gavroche"]
        }).then((c) => {
            assert.equal(
                c.conflict,
                "Cannot delete 'Fine-dining↘La Gavroche': not found");
        });
    });

    tr.addTest('should conflict: no such node (edit)', function() {
        let h = new Hoard({debug: console.debug});

        let kfc = {
	    type: "E",
	    time: Date.UTC(2004,0),
	    path: ["Fine-dining", "Doner"]
	};

	return h.play_action(cloud_data.actions[0])
	.then((e) => {
		assert.equal(cloud_data.actions[0], e.action);
	        return h.play_action(kfc);
            }).then((e) => {
                let c = e.conflict;
	        assert.equal(c,
                             "Cannot change value of 'Fine-dining↘Doner': it does not exist");
                assert.equal(e.action, kfc);
                assert.equal(client_data.actions.length, client_size);
                assert.equal(cloud_data.actions.length, cloud_size);
            });
    });

    tr.addTest('should allow rename', function() {
        let h = new Hoard({});
	var listened = 0;
	for (let act of cloud_data.actions) {
	    h.play_action(act);
        }
	return h.play_action({
	    type: "R",
	    time: Date.UTC(2005,0),
	    path: ["Fine-dining", "Caviar"],
            data: "Turbot"
        }).then((r) => {
            assert(!r.conflict);
            //console.log(h.dump());
            assert.equal(client_data.actions.length, client_size);
            assert.equal(cloud_data.actions.length, cloud_size);
        });
    });

    tr.addTest('should merge action streams', function() {
        let cloud = new Hoard({});
        // Initial action stream is empty
        let m = Hoard.merge_actions([], cloud_data.actions.slice());
        assert.deepEqual(m, cloud_data.actions);

        // Merging should skip duplicates
        m = Hoard.merge_actions(m, cloud_data.actions.slice());
        assert.deepEqual(m, cloud_data.actions);

        m = Hoard.merge_actions(cloud_data.actions.slice(),
                                client_data.actions.slice());

        assert.deepEqual(
            m,
            [
                cloud_data.actions[0],
                cloud_data.actions[1],
                client_data.actions[1],
            ]);

        // A merge the other way should work the same
        m = Hoard.merge_actions(client_data.actions.slice(),
                                cloud_data.actions.slice());
        assert.deepEqual(
            m,
            [
                cloud_data.actions[0],
                cloud_data.actions[1],
                client_data.actions[1],
            ]);
    });

    tr.addTest("should ring alarms", function() {
        let debug;// = console.debug;
        let actions = [
            {
	        type: "N",
	        time: Date.UTC(2000,0),
	        path: ["Fine-dining"]
            },
            {
	        type: "A",
	        time: Date.UTC(2007,0,30),
                data: 200,
                // SMELL: child node will be modified on 1 Jul 2001,
                // so the recomputed alarm is:
                ring_expected: Date.UTC(2002,0,17),
	        path: [ "Fine-dining" ]
            },
            {
	        type: "N",
	        time: Date.UTC(2001,6,01),
	        path: [ "Fine-dining", "Caviare" ]
            },
            {
	        type: "N",
	        time: Date.UTC(2002,0,01),
	        path: [ "Fine-dining", "Caviare", "Beluga" ],
                data: "£6.70 per gram"
            },
            {
                type: "A",
	        path: [ "Fine-dining", "Caviare", "Beluga" ],
	        time: Date.UTC(2003,0,01),
                ring_expected: Date.UTC(2003,3,11),
                data: { time: Date.UTC(2003,3,11) }
            },
            {
                type: "A",
	        path: [ "Fine-dining", "Caviare" ],
	        time: Date.UTC(2003,0,01),
                data: 10000000
            }
        ];
        let cloud = new Hoard({}, debug);
	for (let actac of actions) {
	    cloud.play_action(actac);
        }
        return cloud.check_alarms(function(path, rang_at) {
            return new Promise((resolve) => {
                for (let a of actions) {
                    if (a.type === "A" && TestRunner.samePath(a.path, path)) {
                        assert(!a.rung);
                        assert.equal(
                            rang_at.getTime(), a.ring_expected,
                            path + ": " + rang_at + " != " + new Date(a.ring_expected));
                        a.rung = true;
                    }
                }
                resolve();
            });
        }).then(() => {
            for (let act of actions) {
                if (act.type === "A" && "ring_expected" in act)
                    assert(act.rung, new Action(act) + " did not ring at "
                          + act.ring_expected);
            }
        });
    });

    tr.addTest("push/pop actions and get_node", function() {
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
        let cloud = new Hoard({});
	for (let act of actions) {
	    cloud.play_action(act);
        }
        cloud.push_action({
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
	    path: ["Fine-dining"]
        },
        {
	    type: "A",
	    time: 200,
            data: 100000,
	    path: ["Fine-dining"]
        },
        {
	    type: "N",
	    time: 300,
	    path: [ "Fine-dining", "Caviare" ]
        },
        {
	    type: "N",
	    time: 400,
	    path: [ "Fine-dining", "Caviare", "Beluga" ],
            data: "£6.70 per gram"
        },
        {
            type: "A",
	    path: [ "Fine-dining", "Caviare", "Beluga" ],
	    time: 500,
            data: 100
        },
        {
            type: "A",
	    path: [ "Fine-dining", "Caviare" ],
	    time: 600,
            data: 11111
        },
        {
	    type: "X",
	    time: 300,
	    path: [ "Fine-dining", "Caviare", "Beluga" ],
            data: "32;A-Z;0-9"
        }
    ];

    let full_tree_json = {
        "Fine-dining": {
            "time": 300,
            "data": {
                "Caviare": {
                    "time": 600,
                    "data": {
                        "Beluga": {
                            "time": 500,
                            "data": "£6.70 per gram",
                            "alarm": 100,
                            "constraints": "32;A-Z;0-9"
                        }
                    },
                    "alarm": 11111
                }
            },
            "alarm": 100000
        }
    };

    tr.addTest("actions from tree", function() {

        let cloud = new Hoard({});
	for (let act of full_tree_actions) {
	    cloud.play_action(act);
        }
        let acts = [];
        Hoard.actions_from_tree(cloud.tree, (a) => {
            acts.push(a);
            return Promise.resolve();
        });
        assert.deepEqual(acts, [
            { type: 'N', path: [ 'Fine-dining' ],
              time: 300 }, // creation of 'Caviare',
            { type: 'A', path: [ 'Fine-dining' ],
              time: 300,
              data: 100000 },
            { type: 'N', path: [ 'Fine-dining', 'Caviare' ],
              time: 600 }, // alarm
            { type: 'A', path: [ 'Fine-dining', 'Caviare' ],
              time: 600,
              data: 11111 },
            { type: 'N', path: [ 'Fine-dining', 'Caviare', 'Beluga' ],
              time: 601, // create time before parent
              data: '£6.70 per gram' },
            { type: 'A', path: [ 'Fine-dining', 'Caviare', 'Beluga' ],
              time: 601,
              data: 100 },
            { type: 'X', path: [ 'Fine-dining', 'Caviare', 'Beluga' ],
              time: 601,
              data: '32;A-Z;0-9' } ]);
    });
    
    tr.addTest("generate correct JSON", function() {
        let cloud = new Hoard({});
	for (let act of full_tree_actions) {
	    cloud.play_action(act);
        }
        assert.equal(cloud.treeJSON(), JSON.stringify(full_tree_json, null, " "));
    });

    tr.run();
});
