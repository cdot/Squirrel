/*eslint-env node, mocha */

if (typeof fs === "undefined")
    fs = require("fs");
if (typeof Hoard === "undefined")
    Hoard = require("../Hoard");
if (typeof Utils === "undefined")
    Utils = require("../Utils");
if (typeof Translator === "undefined")
    Translator = require("../Translator");

if (typeof assert === "undefined")
    var assert = require('chai').assert;

Translator.global(new Translator());

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
    options: {
	store_path: "food"
    },
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
    options: {
	store_path: "bleh"
    },
    version: 1
};

var client_size = client_data.actions.length;
var cloud_size = cloud_data.actions.length;

describe('Hoard', function() {
    it('should make with data and string', function() {
        var h = new Hoard("Test1", cloud_data);
	assert.equal(h.actions[0].path[0], cloud_data.actions[0].path[0]);
	h = new Hoard("Test2", JSON.stringify(cloud_data));
	assert.equal(h.actions[0].path[0], cloud_data.actions[0].path[0]);
        assert.equal(client_data.actions.length, client_size);
        assert.equal(cloud_data.actions.length, cloud_size);
    });

    it("should play_actions into empty hoard", function() {
	// Reconstruct a cache from an actions list in an empty hoard,
        // Monitoring progress
        let h = new Hoard("Test1");
        let percent = 0;
	return h.play_actions(cloud_data.actions, (r) => {
            assert(r.event);
            assert(!r.conflict);
            assert(r.progress > percent);
            percent = r.progress;
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
            assert.equal(percent, 100);
	    assert.equal(h.actions.length, 0);
            assert.equal(client_data.actions.length, client_size);
            assert.equal(cloud_data.actions.length, cloud_size);
        });
    });

    it("should play_actions into populated hoard", function() {
	// Play the cloud action set into a populated client hoard
	var h = new Hoard("Test1", client_data);
	assert(h.cache.data["Fine-dining"].data.Truffles);
        let percent = 0;
	return h.play_actions(cloud_data.actions, (r) => {
            assert(r.event);
            assert(!r.conflict);
            assert(r.progress > percent);
            percent = r.progress;
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

    it('should detect zero path', function() {
        var h = new Hoard("Test1");
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
       
    it('should detect no parent', function() {
        var h = new Hoard("Test1");
        let percent = 0;
	return h.play_actions(cloud_data.actions, (r) => {
            assert(r.event);
            assert(!r.conflict);
            assert(r.progress > percent);
            percent = r.progress;
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

    it('should detect already existing', function() {
        var h = new Hoard("Test1");
        
	// No cache, so promise should be resolved will be called
	return h.play_action(cloud_data.actions[0])
	    .then((e) => {
		assert.equal(cloud_data.actions[0], e);
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
    
    it('should detect no such node', function() {
        var h = new Hoard("Test1");

        var kfc = {
	    type: "E",
	    time: new Date("1 Jan 2004").getTime(),
	    path: ["Fine-dining", "Doner"]
	        };
        
	return h.play_action(cloud_data.actions[0])
	    .then((e) => {
		assert.equal(cloud_data.actions[0], e);
	        return h.play_action(kfc);
            }).then((e) => {
		assert(false);
	    })
            .catch((c) => {
	        assert.equal(c.message,
                     "Cannot change value of 'Fine-dining↘Doner': It does not exist");
                assert.equal(c.conflict, kfc);
                assert.equal(client_data.actions.length, client_size);
                assert.equal(cloud_data.actions.length, cloud_size);
            });
    });

    it('should allow rename', function() {
        var h = new Hoard("Test1");
	var listened = 0;
        var percent = 0;
	return h.play_actions(cloud_data.actions, (r) => {
            assert(r.event);
            assert(!r.conflict);
            assert(r.progress > percent);
            percent = r.progress;
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
    
    it('should merge action streams', function() {
        var cloud = new Hoard("Cloud");
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
        var client = new Hoard("Client");
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
});
