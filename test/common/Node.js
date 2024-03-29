/*@preserve Copyright (C) 2021-2023 Crawford Currie http://c-dot.co.uk license MIT*/
/*eslint-env shared-node-browser, mocha */

import { assert } from "chai";
import { Node } from "../../src/common/Node.js";
import { Action } from "../../src/common/Action.js";

const node_data = {
	time:946684800000,
	children:{
		A:{
			time:1009843200000,
			alarm: "8080;99",
			children:{
				A:{
					time:993945600000,
					alarm: 9,
					children:{}
				},
				B:{
					time:1041379200000,
					children:{
						C:{
							time:1041379200000,
							alarm: { due: 8080, repeat: 99 },
							value: "C",
							constraints: "1;A-Z"
						}
					}
				},
				C:{
					time:1009843200000,
					value: "Not C",
					children: {}
				}
			}
		}
	}
};

describe("Node", () => {

  it("construct", function() {
    let debug;// = console.debug;
		let root = new Node(node_data);
		assert(root instanceof Node);
		assert(root.children.A instanceof Node);
		assert(root.children.A.children.A instanceof Node);
		assert(root.children.A.children.B instanceof Node);
		assert(root.children.A.children.B.children.C instanceof Node);
		assert.equal(root.children.A.children.B.children.C.value,"C");
		assert(root.children.A.children.C instanceof Node);
  });

  it("getChild", function() {
    let debug;// = console.debug;
		let root = new Node(node_data);
		assert(root instanceof Node);
		assert.equal(root.getChild("A"), root.children.A);
		assert.equal(root.getChild("A").getChild("B"), root.children.A.children.B);
		assert(!root.getChild("X"));
	});
	
  it("eachChild", function() {
    let debug;// = console.debug;
		let n = new Node(node_data).getChild("A");
		let done = {};
		
		n.eachChild((name, node) => {
			assert.equal(node, n.getChild(name));
			assert(!done[name]);
			done[name] = true;
		});

		for (let name of Object.keys(n.children)) {
			assert(done[name]);
		}

		done = {};
		let res = n.eachChild((name, node) => {
			assert(!done[name]);
			done[name] = true;
			if (name === "B")
				return node;
			return undefined;
		});

		assert.equal(res, n.getChild("B"));
	});

	it("addChild", function() {
    let debug;// = console.debug;
		let root = new Node(node_data);
		root.addChild("X", new Node());
		try {
			root.addChild("A", new Node());
		} catch (e) {
			return;
		}
		assert(false, "Expected an Error");
  });

  it("removeChild", function() {
    let debug;// = console.debug;
		let root = new Node(node_data);
		let a = root.getChild("A");
		a.removeChild("A");
		try {
			a.removeChild("A");
		} catch (e) {
			return;
		}
		assert(false, "Expected an Error");		
 		a.removeChild(a.getChild("B"));
		try {
			a.removeChild("B");
		} catch (e) {
			return;
		}
		assert(false, "Expected an Error");		
  });

  it("getNodeAt", function() {
    let debug;// = console.debug;
		let node = new Node(node_data);
    const abc = node.getNodeAt(["A", "B", "C"]);
    assert.equal(abc.time, Date.UTC(2003,0,1));
    assert.equal(abc.value, "C");
		assert.deepEqual(abc.alarm, {due:8080,repeat:99});
		assert.deepEqual(abc.constraints, {size:1,chars:"A-Z"});
    const aa = node.getNodeAt(["A", "A"]);
    assert.equal(aa.time, Date.UTC(2001,6,1));
		assert.deepEqual(aa.alarm, {
			due: aa.time + 9 * 24 * 60 * 60 * 1000,
			repeat:9 * 24 * 60 * 60 * 1000
		});
    const abd = node.getNodeAt(["A", "B", "D"]);
    assert(!abd);
		const ab = node.getNodeAt(["A", "B", "C"], 1);
    assert.equal(ab.children.C.value, "C");
		const a = node.getNodeAt(["A", "B", "C"], 2);
    assert.equal(a, node.children.A);
    assert.deepEqual(a.alarm, {due:8080,repeat:99});
  });

  it("getPath", function() {
    let debug;// = console.debug;
		let root = new Node(node_data);
    let n = root.getNodeAt(["A", "B", "C"]);
    assert.equal(n.value, "C");
		
    assert.deepEqual(root.getPathTo(n),["A","B","C"]);
  });

	let tree_A =  {
    children: {
      Constraints: {
				time: Date.UTC(2001,0),
				constraints: { size: 1, chars: "2" },
				children: {},
        value: "constrained"
      },
      Alarm: {
				time: Date.UTC(2002,0),
				alarm: { due: 808080, repeat: 606060 },
				children: {},
        value: "alarm"
      },
      Data: {
				time: Date.UTC(2003,0),
				children: {},
        value: "before"
      },
      Tree: {
				time: Date.UTC(2004,0),
        children: {
          A: {
						time: Date.UTC(2005,0),
						children: {},
            value: "a"
          },
          B: {
						time: Date.UTC(2006,0),
						children: {},
            value: "b"
          },
          C: {
						time: Date.UTC(2007,0),
						children: {},
            value: "c"
          }
        }
      },
    }
  };

  let tree_B =  {
    children: {
      Constraints: {
				time: Date.UTC(2001,0),
				constraints: { size: 2, chars: "1" },
				children: {},
        value: "constrained"
      },
      Alarm: {
				time: Date.UTC(2002,0),
				alarm: { due: 909090, repeat: 1 },
				children: {},
        value: "alarm"
      },
      Data: {
				time: Date.UTC(2003,0),
				children: {},
        value: "after"
      },
      Tree: {
				time: Date.UTC(2004,0),
        children: {
          A: {
						time: Date.UTC(2005,0),
						children: {},
            value: "a"
          },
          C: {
						time: Date.UTC(2007,0),
						children: {},
            value: "c"
          },
          D: {
						time: Date.UTC(2008,0),
						children: {},
            value: "d"
          },
        }
      },
    }
  };

  let diff_actions = [
    new Action({
			type: "X",
			path: [ 'Constraints' ],
			constraints: { size: 2, chars: "1" }
		}),
    new Action({
      type:"A",
      path: [ 'Alarm' ],
      alarm: { due: 909090, repeat: 1 }
    }),
    new Action({
      type:"E",
      path: [ 'Data' ],
      data: 'after'
    }),
    new Action({
      type:"D",
      path: [ 'Tree', "B" ]
    }),
    new Action({
      type: "I",
      path: [ 'Tree' ],
      data: JSON.stringify({
        name: "D",
        node: {
					time: Date.UTC(2008,0),
					children: {},
					value: "d"
				}
      })
    })
  ];

  it("should diff", function() {
    let debug;// = console.debug;
    let tree_a = new Node(tree_A);
		let tree_b = new Node(tree_B);

    tree_a.diff([], tree_b, act => {
      let matched = false;
      for (let x of diff_actions) {
        if (x.type === act.type && !x.matched) {
					//console.log("Matched", act.toString());
          delete x.time; delete act.time;
          assert.deepEqual(act, x);
          x.matched = matched = true;
          break;
        }
      }
      assert(matched, act.toString());
    });

    for (let x of diff_actions)
      assert(x.matched, x.toString());
  });
});
