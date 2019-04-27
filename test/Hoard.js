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
	    time: new Date("1 Jan 2000").getTime(),
	    path: ["Fine-dining"]
	},
	// Action not in the client yet
	{
	    type: "N",
	    time: new Date("1 Jan 2002").getTime(),
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
	    time: new Date("1 Jan 2003").getTime(),
	    path: ["Fine-dining", "Truffles" ],
            data: "Fungi"
	}],
    tree: {
	data: {
	    "Fine-dining": {
		time:new Date("1 Jan 2000").getTime(),
		data:{
		    Truffles: {
			time: new Date("1 Jan 2003").getTime(),
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

function samePath(a, b) {
    if (a.length !== b.length) return false;
    for (let i = 0; i < a.length; i++)
        if (a[i] !== b[i])
            return false;
    return true;
}

const MSPERDAY = 24 * 60 * 60 * 1000;

requirejs(["js/Hoard", "test/TestRunner"], function(Hoard, TestRunner) {
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
	h.play_actions(cloud_data.actions, (r) => {
            assert(r.action);
            assert(!r.conflict);
        }).then(() => {
	assert.deepEqual(h.tree, {
	    data:{
		"Fine-dining":{
		    time:new Date("1 Jan 2002").getTime(),
		    data:{
			Caviar:{
			    time:new Date("1 Jan 2002").getTime(),
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
    });

    tr.addTest("should play_actions into populated hoard", function() {
	// Play the cloud action set into a populated client hoard
	var h = new Hoard(client_data);
	assert(h.tree.data["Fine-dining"].data.Truffles);
	h.play_actions(cloud_data.actions, (r) => {
            assert(r.action);
            assert(!r.conflict);
        }).then(() => {
	assert.deepEqual(h.tree, {
	    data:{
		"Fine-dining":{
		    time:new Date("1 Jan 2002").getTime(),
		    data:{
			Caviar:{
			    time:new Date("1 Jan 2002").getTime(),
			    data:{}
			},
			Truffles: {
			    time: new Date("1 Jan 2003").getTime(),
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
    });

    tr.addTest('should detect zero path', function() {
        let h = new Hoard({});
	return h.play_action({
	    type: "N",
	    time: new Date("1 Jan 2004").getTime(),
	    path: []
	}).then((c) => {
	    assert.equal(c.conflict,
                         "Cannot create '': Zero length path");
            assert.equal(client_data.actions.length, client_size);
            assert.equal(cloud_data.actions.length, cloud_size);
        });
    });

    tr.addTest('should detect no parent', function() {
        let h = new Hoard({});
	h.play_actions(cloud_data.actions, (r) => {
            assert(r.action);
            assert(!r.conflict);
        });
	return h.play_action({
	    type: "N",
	    time: new Date("1 Jan 2004").getTime(),
	    path: ["Junk", "Burger"]
        }).then((r) => {
	    assert.equal(r.conflict,
                         "Cannot create 'Junk↘Burger': Node not found");
            assert.equal(client_data.actions.length, client_size);
            assert.equal(cloud_data.actions.length, cloud_size);
        });
    });

    tr.addTest('should detect no such node', function() {
        let h = new Hoard({});

	// No cache, so promise should be resolved will be called
	return h.play_action({
            type: "D",
            path: ["Fine-dining", "La Gavroche"]
        }).then((c) => {
            assert.equal(
                c.conflict,
                "Cannot delete 'Fine-dining↘La Gavroche': Node not found");
        });
    });

    tr.addTest('should detect no such node', function() {
        let h = new Hoard({debug: console.debug});

        let kfc = {
	    type: "E",
	    time: new Date("1 Jan 2004").getTime(),
	    path: ["Fine-dining", "Doner"]
	};

	return h.play_action(cloud_data.actions[0])
	.then((e) => {
		assert.equal(cloud_data.actions[0], e.action);
	        return h.play_action(kfc);
            }).then((e) => {
                let c = e.conflict;
	        assert.equal(c,
                             "Cannot change value of 'Fine-dining↘Doner': It does not exist");
                assert.equal(e.action, kfc);
                assert.equal(client_data.actions.length, client_size);
                assert.equal(cloud_data.actions.length, cloud_size);
            });
    });

    tr.addTest('should allow rename', function() {
        let h = new Hoard({});
	var listened = 0;
	h.play_actions(cloud_data.actions, (r) => {
            assert(r.action);
            assert(!r.conflict);
        }).then(() => {
	    return h.play_action({
	        type: "R",
	        time: new Date("1 Jan 2005").getTime(),
	        path: ["Fine-dining", "Caviar"],
                data: "Turbot"
            });
        }).then((r) => {
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
        const actions = [
            {
	        type: "N",
	        time: new Date("2000-01-01Z").getTime(),
	        path: ["Fine-dining"]
            },
            {
	        type: "A",
	        time: new Date("2007-01-30Z").getTime(),
                data: 200,
                // SMELL: child node will be modified on 1 Jul 2001,
                // so the recomputed alarm is:
                ring_expected: new Date("2002-01-17Z"),
	        path: ["Fine-dining"]
            },
            {
	        type: "N",
	        time: new Date("2001-07-01Z").getTime(),
	        path: [ "Fine-dining", "Caviare" ]
            },
            {
	        type: "N",
	        time: new Date("2002-01-01Z").getTime(),
	        path: [ "Fine-dining", "Caviare", "Beluga" ],
                data: "£6.70 per gram"
            },
            {
                type: "A",
	        path: [ "Fine-dining", "Caviare", "Beluga" ],
	        time: new Date("2003-01-01Z").getTime(),
                ring_expected: new Date("2003-04-11Z"),
                data: { time: new Date("2003-04-11Z") }
            },
            {
                type: "A",
	        path: [ "Fine-dining", "Caviare" ],
	        time: new Date("2003-01-01Z").getTime(),
                data: 1000000
            }
        ];
        let cloud = new Hoard({});
        cloud.play_actions(actions, (r) => {
            assert(r.action);
            assert(!r.conflict);
        }).then(() => {
            return cloud.check_alarms(function(path, rang_at) {
                return new Promise((resolve) => {
                    for (let i = 0; i < actions.length; i++) {
                        let a = actions[i];
                        if (a.type === "A" && samePath(a.path, path)) {
                            assert(!a.rung);
                            assert.equal(
                                rang_at.getTime(), a.ring_expected.getTime(),
                                path + ": " + rang_at + " != " + a.ring_expected);
                            a.rung = true;
                        }
                    }
                resolve();
                });
            });
        }).then(() => {
            for (let i = 0; i < actions.length; i++) {
                if (actions[i].type === "A" && actions[i].ring_expected)
                    assert(actions[i].rung, actions[i] + " did not ring");
            }
        });
    });

    tr.addTest("push/pop actions and get_node", function() {
        const actions = [
            {
	        type: "N",
	        time: new Date("2000-01-01Z").getTime(),
	        path: ["A"]
            },
            {
	        type: "N",
	        time: new Date("2001-07-01Z").getTime(),
	        path: [ "A", "A" ]
            },
            {
	        type: "N",
	        time: new Date("2002-01-01Z").getTime(),
	        path: [ "A", "B" ]
            },
            {
	        type: "N",
	        time: new Date("2002-01-01Z").getTime(),
	        path: [ "A", "C" ]
            },
            {
                type: "N",
	        path: [ "A", "B", "C" ],
	        time: new Date("2003-01-01Z").getTime()
            },
            {
	        type: "N",
	        time: new Date("2002-01-02Z").getTime(),
	        path: ["A", "C"]
            },
        ];
        let cloud = new Hoard({});
        cloud.play_actions(actions, (r) => {
            assert(r.action);
            assert(!r.conflict); // no conflict on duplicate node create
        }).then(() => {
            cloud.push_action({
	        type: "N",
	        time: new Date("2001-07-01Z").getTime(),
	        path: [ "A", "A" ]
            });
            let n = cloud.get_node(["A", "B", "C"]);
            assert.equal(n.time, new Date("2003-01-01Z").getTime());
            n = cloud.get_node(["A", "A"]);
            assert.equal(n.time, new Date("2001-07-01Z").getTime());
            n = cloud.get_node(["A", "B", "D"]);
            assert.isNull(n);
        });
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

    tr.addTest("should play_actions from since", function() {
        let actions = full_tree_actions.slice();
        actions.push({
	        type: "N",
	        time: 1000,
	    path: [ "Fine-dining", "Caviare", "Sevruga" ]
        });
        let h = new Hoard({});
        return h.play_actions(full_tree_actions)
        .then(() => {
            let ec = 0;
            return h.play_actions(actions, 999, (r) => {
                assert(r.action);
                assert(!r.conflict);
                ec++;
            }).then(() => {
                assert.equal(ec, 1);
            });
        });
    });
    
    tr.addTest("actions from tree", function() {

        let cloud = new Hoard({});
        cloud.play_actions(full_tree_actions, (r) => {
            assert(r.action);
            assert(!r.conflict); // no conflict on duplicate node create
        }).then(() => {
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
    });
    
    tr.addTest("generate correct JSON", function() {
        let cloud = new Hoard({});
        cloud.play_actions(full_tree_actions, (r) => {
            assert(r.action);
            assert(!r.conflict); // no conflict on duplicate node create
        }).then(() => {
            assert.equal(cloud.treeJSON(), JSON.stringify(full_tree_json, null, " "));
        });
    });

    tr.run();
});
