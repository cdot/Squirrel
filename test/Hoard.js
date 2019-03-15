/*@preserve Copyright (C) 2015-2019 Crawford Currie http://c-dot.co.uk license MIT*/
/*eslint-env shared-node-browser, mocha */

if (typeof module !== "undefined") {
    requirejs = require('requirejs');
    requirejs.config({
        baseUrl: ".."
    });
}

var cloud_data = {
    last_sync: null,
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
    cache: null,
    version: 1
};

// Client hoard, with populated cache and action stream
var client_data = {
    last_sync: new Date("1 Jan 2001").getTime(),
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
    cache: {
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
        var h = new Hoard({name: "Test1", data: cloud_data});
	assert.equal(h.actions[0].path[0], cloud_data.actions[0].path[0]);
	h = new Hoard({name: "Test2", data: JSON.stringify(cloud_data)});
	assert.equal(h.actions[0].path[0], cloud_data.actions[0].path[0]);
        assert.equal(client_data.actions.length, client_size);
        assert.equal(cloud_data.actions.length, cloud_size);
    });

    tr.addTest("should play_actions into empty hoard", function() {
	// Reconstruct a cache from an actions list in an empty hoard
        let h = new Hoard({name: "Test1"});
	return h.play_actions(cloud_data.actions, (r) => {
            assert(r.event);
            assert(!r.conflict);
        }).then(() => {
	    assert.deepEqual(h.cache, {
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
	        "time": h.cache.time
	    });
	    assert.equal(h.actions.length, 0);
            assert.equal(client_data.actions.length, client_size);
            assert.equal(cloud_data.actions.length, cloud_size);
        });
    });

    tr.addTest("should play_actions into populated hoard", function() {
	// Play the cloud action set into a populated client hoard
	var h = new Hoard({name: "Test1", data: client_data});
	assert(h.cache.data["Fine-dining"].data.Truffles);
	return h.play_actions(cloud_data.actions, (r) => {
            assert(r.event);
            assert(!r.conflict);
        }).then(() => {
	    assert.deepEqual(h.cache, {
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
	        time: h.cache.time
	    });
            assert.equal(client_data.actions.length, client_size);
            assert.equal(cloud_data.actions.length, cloud_size);
        });
    });

    tr.addTest('should detect zero path', function() {
        var h = new Hoard({name:"Test1"});
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
        var h = new Hoard({name:"Test1"});
	return h.play_actions(cloud_data.actions, (r) => {
            assert(r.event);
            assert(!r.conflict);
        }).then(() => {
	    return h.play_action({
	        type: "N",
	        time: new Date("1 Jan 2004").getTime(),
	        path: ["Junk", "Burger"]
	    });
        }).then((r) => {
	    assert.equal(r.conflict,
                         "Cannot create 'Junk↘Burger': Parent folder not found");
            assert.equal(client_data.actions.length, client_size);
            assert.equal(cloud_data.actions.length, cloud_size);
        });
    });

    tr.addTest('should detect already existing', function() {
        var h = new Hoard({name:"Test1"});

	// No cache, so promise should be resolved will be called
	return h.play_action(cloud_data.actions[0])
	    .then((e) => {
		assert.equal(cloud_data.actions[0], e.event);
	    })
            .then(() => {
                // Cache now there, should trip when re-adding
	        return h.play_action(cloud_data.actions[0]);
            }).then((c) => {
                assert.equal(
                    c.conflict,
                    "Cannot create 'Fine-dining': It already exists @"
                        + new Date("1 Jan 2000"));
                assert.deepEqual(c.event, cloud_data.actions[0]);
                assert.equal(client_data.actions.length, client_size);
                assert.equal(cloud_data.actions.length, cloud_size);
            });
    });

    tr.addTest('should detect no such node', function() {
        var h = new Hoard({name:"Test1", debug: console.debug});

        var kfc = {
	    type: "E",
	    time: new Date("1 Jan 2004").getTime(),
	    path: ["Fine-dining", "Doner"]
	};

	return h.play_action(cloud_data.actions[0])
	    .then((e) => {
		assert.equal(cloud_data.actions[0], e.event);
	        return h.play_action(kfc);
            }).then((e) => {
                let c = e.conflict;
	        assert.equal(c,
                             "Cannot change value of 'Fine-dining↘Doner': It does not exist");
                assert.equal(e.event, kfc);
                assert.equal(client_data.actions.length, client_size);
                assert.equal(cloud_data.actions.length, cloud_size);
            });
    });

    tr.addTest('should allow rename', function() {
        var h = new Hoard({name:"Test1"});
	var listened = 0;
	return h.play_actions(cloud_data.actions, (r) => {
            assert(r.event);
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
        var cloud = new Hoard({name:"Cloud"});
        // Initial action stream is empty
        assert.equal(cloud.merge_actions(cloud_data.actions), 2);
        assert.deepEqual(cloud.actions, cloud_data.actions);

        // Merging should skip duplicates
        assert.equal(cloud.merge_actions(cloud_data.actions), 0);
        assert.deepEqual(cloud.actions, cloud_data.actions);

        assert.equal(cloud.merge_actions(client_data.actions), 1);

        assert.deepEqual(
            cloud.actions,
            [
                cloud_data.actions[0],
                cloud_data.actions[1],
                client_data.actions[1],
            ]);

        // A merge the other way should work the same
        var client = new Hoard({name: "Client"});
        assert.equal(client.merge_actions(client_data.actions), 2);

        assert.equal(client.merge_actions(cloud_data.actions), 1);
        assert.deepEqual(
            cloud.actions,
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
                data: 100
            },
            {
                type: "A",
	        path: [ "Fine-dining", "Caviare" ],
	        time: new Date("2003-01-01Z").getTime(),
                data: 1000000
            }
        ];
        var cloud = new Hoard({name:"Cloud"});
        return cloud.play_actions(actions, (r) => {
            assert(r.event);
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
                    assert(actions[i].rung, Hoard.stringify_action(actions[i])+" did not ring");
            }
        });
    });

    tr.run();
});
