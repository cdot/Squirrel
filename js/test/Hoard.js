/*eslint-env node, mocha */
var Fs = require("fs");
var assert = require('chai').assert;
var Hoard = require("../Hoard");
var Utils = require("../Utils");

var cloud_data = {
    "last_sync": null,
    "actions": [
	// Action already reflected in the client
	{
	    "type": "N",
	    "time": new Date("1 Jan 2000").getTime(),
	    "path": ["Fine-dining"]
	},
	// Action not in the client yet
	{
	    type: "N",
	    time: new Date("1 Jan 2002").getTime(),
	    path: [ "Fine-dining", "Caviar" ]
	}
    ],
    cache: null,
    "options": {
	"autosave": false,
	"store_path": "food"
    },
    "version": 1
};

var client_data = {
    "last_sync": new Date("1 Jan 2001").getTime(),
    "actions": [
	{
	    // Duplicate an action that is already in the cloud
	    "type": "N",
	    "time": new Date("1 Jan 2000").getTime(),
	    "path": ["Fine-dining"]
	},
	{
	    // Add an action that isn't in the cloud yet
	    type: "N",
	    time: new Date("1 Jan 2003").getTime(),
	    path: ["Fine-dining", "Truffles" ]
	}],
    cache: {
	data: {
	    "Fine-dining": {
		"time":new Date("1 Jan 2000").getTime(),
		"data":{
		    "Truffles": {
			time: new Date("1 Jan 2003").getTime(),
			data: {}
		    }
		}
	    }
	},
	"time":1513078020279
    },
    "options": {
	"autosave": false,
	"store_path": "bleh"
    },
    "version": 1
};

describe('Hoard', function() {
    it('should make with data and string', function() {
        var h = new Hoard(cloud_data);
	assert.equal(h.actions[0].path[0], cloud_data.actions[0].path[0]);
	h = new Hoard(JSON.stringify(cloud_data));
	assert.equal(h.actions[0].path[0], cloud_data.actions[0].path[0]);
    });

    it("should play_actions", function() {
	// Reconstruct a cache from an actions list in an empty hoard
        var h = new Hoard();
	h.play_actions(cloud_data.actions);
	assert.deepEqual(h.cache, {
	    "data":{
		"Fine-dining":{
		    "time":new Date("1 Jan 2002").getTime(),
		    "data":{
			"Caviar":{
			    "time":new Date("1 Jan 2002").getTime(),
			    "data":{}
			}
		    }
		}
	    },
	    "time": h.cache.time
	});
	assert.equal(h.actions.length, 0);

	// Play the same action set into a populated hoard
	h = new Hoard(client_data);
	assert(h.cache.data["Fine-dining"].data.Truffles);
	h.play_actions(cloud_data.actions);
	assert.deepEqual(h.cache, {
	    "data":{
		"Fine-dining":{
		    "time":new Date("1 Jan 2002").getTime(),
		    "data":{
			"Caviar":{
			    "time":new Date("1 Jan 2002").getTime(),
			    "data":{}
			},
			"Truffles": {
			    time: new Date("1 Jan 2003").getTime(),
			    data: {}
			}
		    }
		}
	    },
	    "time": h.cache.time
	});
    });

    it('should detect conflicts', function() {
        var h = new Hoard(JSON.stringify(cloud_data));
	var listened = false;
	// No cache, so listener will be called
	var c = h.play_action(
	    cloud_data.actions[0],
	    function(e) {
		assert.equal(h.actions[0].path[0], e.path[0]);
		listened = true;
	    });
	assert(listened);

	// Rebuild cache
	var c = h.play_action(
	    cloud_data.actions[0],
	    function(e) {
		assert(false, 'Should not be called');
	    });
	assert.equal(c.message, "Cannot create 'Fine-dining': It already exists");
    });

    it('should merge', function() {
	var hoard = new Hoard();
	var cloud = Fs.readFileSync("raw.js");
	cloud = JSON.parse(Utils.ArrayBufferToString(cloud));
	hoard.play_actions(cloud.actions, null, null, null);
    });
});
