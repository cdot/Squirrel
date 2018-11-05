/*eslint-env node, mocha */

var Fs = require("fs");
var assert = require('chai').assert;
var Hoard = require("../Hoard");
var Utils = require("../Utils");

var cloud_data = {
    last_sync: null,
    actions: [
	// Action already reflected in the client
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
	{
	    // Duplicate an action that is already in the cloud
            // Should give us a conflict
	    type: "N",
	    time: new Date("1 Jan 2000").getTime(),
	    path: ["Fine-dining"]
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

describe('Hoard', function() {
    it('should make with data and string', function() {
        var h = new Hoard(cloud_data);
	assert.equal(h.actions[0].path[0], cloud_data.actions[0].path[0]);
	h = new Hoard(JSON.stringify(cloud_data));
	assert.equal(h.actions[0].path[0], cloud_data.actions[0].path[0]);
    });

    it("should play_actions into empty hoard", function() {
	// Reconstruct a cache from an actions list in an empty hoard
        var h = new Hoard();
	var c = h.play_actions(cloud_data.actions);
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
	assert.equal(c.length, 0);
	assert.equal(h.actions.length, 0);
    });

    it("should play_actions into populated hoard", function() {
	// Play the cloud action set into a populated client hoard
	var h = new Hoard(client_data);
	assert(h.cache.data["Fine-dining"].data.Truffles);
	var cs = h.play_actions(cloud_data.actions);
	assert.equal(cs.length, 0);
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
    });

    it('should detect zero path', function() {
        var h = new Hoard();
        var kfc = {
	    type: "N",
	    time: new Date("1 Jan 2004").getTime(),
	    path: []
	};
	var c = h.play_action(
	    kfc,
	    function(e) {
		assert(false, 'Should not be called');
	    });
	assert.equal(c.message,
                     "Cannot create '': Zero length path");
    });
       
    it('should detect no parent', function() {
        var h = new Hoard();
	var cs = h.play_actions(cloud_data.actions);
	assert.equal(cs.length, 0);
        var kfc = {
	    type: "N",
	    time: new Date("1 Jan 2004").getTime(),
	    path: ["Junk", "Burger"]
	};
	var c = h.play_action(
	    kfc,
	    function(e) {
		assert(false, 'Should not be called');
	    });
	assert.equal(c.message,
                     "Cannot create 'Junk↘Burger': Parent folder not found");
        assert.equal(c.conflict, kfc);
    });

    it('should detect already existing', function() {
        var h = new Hoard();
        
	var listened = false;
	// No cache, so listener will be called
	var c = h.play_action(
	    cloud_data.actions[0],
	    function(e) {
		assert.equal(cloud_data.actions[0], e);
		listened = true;
	    });
	assert(listened);

        // Cache now there, should trip when re-adding
	var c = h.play_action(
	    cloud_data.actions[0],
	    function(e) {
		assert(false, 'Should not be called');
	    });
	assert.equal(
            c.message,
            "Cannot create 'Fine-dining': It already exists @"
            + new Date("1 Jan 2000"));
        assert.deepEqual(c.conflict, cloud_data.actions[0]);
    });
    
    it('should detect no such node', function() {
        var h = new Hoard();
	var listened = false;
	// No cache, so listener will be called
	var c = h.play_action(
	    cloud_data.actions[0],
	    function(e) {
		assert.equal(cloud_data.actions[0], e);
		listened = true;
	    });
	assert(listened);
        var kfc = {
	    type: "E",
	    time: new Date("1 Jan 2004").getTime(),
	    path: ["Fine-dining", "Doner"]
	        };
        
	var c = h.play_action(
	    kfc,
	    function(e) {
		assert(false);
	    });

	assert.equal(c.message,
                     "Cannot change value of 'Fine-dining↘Doner': It does not exist");
        assert.equal(c.conflict, kfc);
    });

    it('should allow rename', function() {
        var h = new Hoard();
	var listened = 0;
        var stage = 0;
	var c = h.play_actions(
	    cloud_data.actions,
	    function(e) {
		listened++;
	    },
            function(page) {
                assert.equal(page, stage);
                stage += 50;
                listened++;
            });
	assert.equal(c.length, 0);
	assert.equal(listened, 4);
        var kfc = {
	    type: "R",
	    time: new Date("1 Jan 2005").getTime(),
	    path: ["Fine-dining", "Caviar"],
            data: "Turbot"
	};
        listened = 0;
	var c = h.play_action(
	    kfc,
	    function(e) {
                listened++;
	    });
        assert.equal(listened, 1);
        assert(!c, "conflicts");
        //console.log(h.dump());
    });
});
