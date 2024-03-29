/*@preserve Copyright (C) 2015-2021 Crawford Currie http://c-dot.co.uk license MIT*/
/*eslint-env shared-node-browser, mocha */

import { assert } from "chai";
import { Action } from "../../src/common/Action.js";

const cloud_actions = [
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
const client_actions = [
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

describe("Action", () => {

	it("constructor", () => {
		let then = Date.now();
		let act = new Action({type:"?", path: ["Smeg"]});
		assert.equal(act.type, "?");
		assert(act.time >= then);
		assert(!act.data);
		assert.deepEqual(act.path, ["Smeg"]);
		act = new Action({ type: "E", path: ["A", "B", "C"], time:then, data: "A" });
		assert.equal(act.time, then);
		assert.equal(act.data, "A");
		assert.deepEqual(act.path, ["A", "B", "C"]);
		act = new Action({type:"N", path: "A↘B↘C"});
		assert.deepEqual(act.path, ["A", "B", "C"]);
	});

 	it("old A constructor", () => {
		let then = Date.now();
		let act = new Action({type:"A", data:"8080;99", path:["Smeg"]});
		assert.equal(act.type, "A");
		assert(act.time >= then);
		assert.equal(act.data.due, 8080);
		assert.equal(act.data.repeat, 99);
		act = new Action({type:"A", data:9, path:["Feck"]});
		assert.equal(act.type, "A");
		assert(act.time >= then);
		assert.equal(act.data.due, act.time + 9 * 24 * 60 * 60 * 1000);
		assert.equal(act.data.repeat, 9 * 24 * 60 * 60 * 1000);
	});

 	it("old X constructor", () => {
		let then = Date.now();
		let act = new Action({type:"X", data:"8;AB;CD", path:["Pah"]});
		assert.equal(act.type, "X");
		assert(act.time >= then);
		assert.equal(act.data.size, 8);
		assert.equal(act.data.chars, "AB;CD");

	});

  it('should merge action streams', function() {
    //let debug;// = console.debug;
    // Initial action stream is empty
    let m = Action.mergeStreams([], cloud_actions.slice());
    assert.deepEqual(m, cloud_actions);

    // Merging should skip duplicates
    m = Action.mergeStreams(m, cloud_actions.slice());
    assert.deepEqual(m, cloud_actions);

    m = Action.mergeStreams(cloud_actions.slice(),
                            client_actions.slice());

    assert.deepEqual(
      m,
      [
        cloud_actions[0],
        cloud_actions[1],
        client_actions[1],
      ]);

    // A merge the other way should work the same
    m = Action.mergeStreams(client_actions.slice(),
                            cloud_actions.slice());
    assert.deepEqual(
      m,
      [
        cloud_actions[0],
        cloud_actions[1],
        client_actions[1],
      ]);
  });

  const MSPERDAY = 24 * 60 * 60 * 1000;

	it('compatibility', () => {
		// Simple number of days, both due and repeat
		let act = new Action({type:"A", data:"7", path:["Pah"], time:9999});
		assert.equal(typeof act.data.due, 'number');
		assert.equal(act.data.due, 9999 + 7 * MSPERDAY);
		assert.equal(act.data.repeat, 7 * MSPERDAY);
		
		act = new Action({type:"A", data:1, path:["Pah"], time: 9999});
		assert.equal(typeof act.data.due, 'number');
		assert.equal(act.data.due, 9999 + 1 * MSPERDAY);
		assert.equal(act.data.repeat, MSPERDAY);

		// String encoding, ms
		act = new Action({type:"A", data:"1;5", path:["Pah"]});
		assert.equal(typeof act.data.due, 'number');
		assert.equal(act.data.due, 1);
		assert.equal(act.data.repeat, 5);

		// { time: number }
		act = new Action({type:"A", data:{time:1}, path:["Pah"]});
		assert.equal(typeof act.data.due, 'number');
		assert.equal(act.data.due, 1);
		assert.equal(act.data.repeat, 0);
	});
});
