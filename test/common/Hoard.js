/*@preserve Copyright (C) 2015-2019 Crawford Currie http://c-dot.co.uk license MIT*/
/*eslint-env shared-node-browser, mocha */

import { assert } from "chai";
import { Hoard } from "../../src/common/Hoard.js";
import { Node } from "../../src/common/Node.js";
import { Action } from "../../src/common/Action.js";

import { i18n } from "../i18n.js"; // will load jsdom

const cloud_actions = [
	// Action already in the client
	new Action({
		type: "N",
		time: Date.UTC(2000,0),
		path: ["FineDining"]
	}),
	// Action not in the client yet
	new Action({
		type: "N",
		time: Date.UTC(2002,0),
		path: [ "FineDining", "Caviar" ]
	})
];

// Client hoard, with populated cache and action stream
const client_actions = [
	// Duplicate an action that is already in the cloud, different date
	new Action({
		type: "N",
		time: Date.UTC(2000,0,1),
		path: ["FineDining"]
	}),
	new Action({
		// Add an action that isn't in the cloud yet
		type: "N",
		time: Date.UTC(2003,0,1),
		path: ["FineDining", "Truffles" ],
		data: "Fungi"
	})
];

describe("Hoard", () => {

  before(() => i18n());

  it("play_actions into empty hoard", async () => {
    let debug;// = console.debug;
    let h = new Hoard({debug: debug});
    let original = new Node(h.tree); // make copy
    assert(original);
    assert(!original.children);
    assert(original.time);
		const played = [];
		return h.play_actions(cloud_actions, {
			undoable: true,
			uiPlayer: a => Promise.resolve(played.push(a))})
		.then(c => {
			assert.equal(c.length, 0, c);
			assert.deepEqual(played, cloud_actions);
			assert.deepEqual(h.tree, {
				children: {
					FineDining: {
						time: Date.UTC(2002,0),
						children:{
							Caviar: {
								time: Date.UTC(2002,0)
							}
						}
					}
				},
				// Touched at the time "FineDining" was stamped
				time: Date.UTC(2000,0)
			});
			assert.equal(h.history.length, 2);
		});
  });

  it("play_actions into populated hoard", async () => {
    let debug;// = console.debug;
		var h = new Hoard({debug: debug});
		return h.play_actions(client_actions)
		.then(conflicts => assert.equal(conflicts.length, 0))
		.then(() => h.play_actions(cloud_actions, {
			autocreate: true, undoable: true }))
		.then(conflicts => {
      assert.equal(conflicts.length, 0);
			assert.deepEqual(h.tree, {
				children:{
					FineDining:{
						time:Date.UTC(2002,0),
						children:{
							Caviar:{
								time:Date.UTC(2002,0)
							},
							Truffles: {
								time: Date.UTC(2003,0),
								value: "Fungi"
							}
						}
					}
				},
				time: h.tree.time
			});
		});
  });

  it('N (node)', async () => {
    let debug;// = console.debug;
    let h = new Hoard({debug: debug});
    let original = new Node(h.tree);
    let act = new Action({
			type: "N",
			time: Date.UTC(2002,0),
			path: [ "Lunch" ]
    });
		let played = [];
    return h.play_action(act, {
			undoable: true,
			uiPlayer: a => Promise.resolve(played.push(a))
		})
		.then(() => {
			assert.equal(played.length, 1);
			assert.deepEqual(played[0], act);
			assert.deepEqual(h.tree, {
				children: {
					Lunch: {
						time: Date.UTC(2002,0)
					}
				},
				time: Date.UTC(2002,0)
			});   
			assert.equal(h.history.length, 1);
			assert.deepEqual(h.history[0].redo, act);
			assert.equal(h.history[0].undo.type, "D");
			assert.deepEqual(h.history[0].undo.path, [ "Lunch" ]);
			assert(h.can_undo());
			return h.undo();
		})
		.then(() => {
			console.log(h.history[0]);
			assert.equal(h.history.length, 0);
			// Replayed to empty tree
			assert.deepEqual(h.tree, original);
		});
  });
  
  it('N (leaf)', async () => {
    let debug;// = console.debug;
    let h = new Hoard({debug: debug});
    let original = new Node(h.tree);
    let act = new Action({
			type: "N",
			time: Date.UTC(2002,0),
			path: [ "Lunch" ],
      data: "Sausages"
    });
    return h.play_action(act)
		.then(() => {
			assert.deepEqual(h.tree, {
				children: {
					Lunch: {
						time: Date.UTC(2002,0),
						value: "Sausages"
					}
				},
				time: Date.UTC(2002,0)
			});
			assert.equal(h.history.length, 1);
			assert.deepEqual(h.history[0].redo, act);
			assert.equal(h.history[0].undo.type, "D");
			assert.deepEqual(h.history[0].undo.path, [ "Lunch" ]);
			assert(h.can_undo());
			return h.undo();
		})
		.then(() => {
			assert.equal(h.history.length, 0);
			assert.deepEqual(h.tree, original);
		});
  });

  it('N collection on leaf', async () =>  {
    let debug;// = console.debug;
    let h = new Hoard({debug: debug});
    return h.play_action(new Action({
			type: "N",
			time: Date.UTC(2002,0),
			path: [ "Lunch" ],
      data: "Sausages"
    }), { undoable: false })
		.then(() => h.play_action(new Action({
			type: "N",
			time: Date.UTC(2003,0),
			path: [ "Lunch", "Break" ],
      data: "Crisps"
    })))
		.then(() => {
			// Note that hoards support nodes having both data
			// and collections of child nodes.
			assert.deepEqual(h.tree, {
				children: {
					Lunch: {
						time: Date.UTC(2003,0),
						children: {
							Break: {
								time: Date.UTC(2003,0),
								value: "Crisps"
							}
						},
						value: "Sausages"
					}
				},
				time: Date.UTC(2002,0)
			});
		});
  });

  it("N missing intermediates", async function() {
    let debug;// = console.debug;
    let h = new Hoard(debug);
		const acts = [
			new Action({
				type: "N",
				time: 500,
				path: [ "One", "Two", "Three" ],
				data: "Floop"
			})
		];
		const played = [];
    return h.play_actions(
			acts, { undoable: false,
					    autocreate: true,
					    uiPlayer: act => Promise.resolve(played.push(act))})
		.then(conflicts => {
			assert.equal(conflicts.length, 0, conflicts);
			assert.deepEqual(played, [
				new Action( { type: "N", path: [ 'One' ], time: 500 }),
				new Action( { type: "N", path: [ 'One', 'Two' ], time: 500 }),
				new Action({
					type: "N",
					path: [ 'One', 'Two', 'Three' ],
					time: 500,
					data: 'Floop'
				})
			]);
		});
  });

  it('X existing node', async () => {
    let debug;// = console.debug;
    let h = new Hoard({debug: debug});
		let original, act;
		return h.play_actions(client_actions, {undoable: false})
		.then(() => {
			original = new Node(h.tree);
			act = new Action({
				type: "X",
				time: Date.UTC(2005,0),
				path: ["FineDining", "Truffles"],
				data: { size: 1, chars: "2" }
			});
			return h.play_action(act);
		})
		.then(() => {
			assert.deepEqual(h.tree, {
				children: {
					FineDining: {
						time: Date.UTC(2003,0,1),
						children:{
							Truffles: {
								time: Date.UTC(2005,0),
								value: "Fungi",
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
			assert(h.can_undo());
			return h.undo();
		})
		.then(() => {
			assert.equal(h.history.length, 0);
			assert.deepEqual(h.tree, original);
		});
  });

  it("X missing path set", async function() {
    let debug;// = console.debug;
    let h = new Hoard(debug);
		return h.play_action(new Action({
			type: "X",
			time: 500,
			path: [ "One", "Two", "Three" ],
			data: {
				size: 10,
				chars: "ABC"
			}
		}), {autocreate: true} )
		.then(() => {
			assert(h.tree.getNodeAt([ "One" ]));
			assert(h.tree.getNodeAt([ "One", "Two" ]));
			assert(h.tree.getNodeAt([ "One", "Two", "Three" ]));
		});
  });

  it("X missing path clear", async function() {
    let debug;// = console.debug;
    let h = new Hoard(debug);
		return h.play_action(
			new Action({
				type: "X",
				time: 500,
				path: [ "One", "Two", "Three" ]
				// data being undefined should remove the constraint.
				// But since the leaf doesn't exist, this should be a NOP
			}))
		.then(() => {
			assert(!h.tree.getNodeAt([ "One" ]));
		});
		/* If it wasn't a NOP....
		   .then(() => { 
		   assert(false);
		   })
		   .catch(e => {
		   assert.equal(e, "Clear constraints on One↘Two↘Three failed: it does not exist");
		   });*/
  });

  it("E missing leaf autocreate", async function() {
    let debug;// = console.debug;
    let h = new Hoard(debug);
		const played = [];
    return h.play_action(new Action({
			type: "E",
			time: 500,
			path: [ "One", "Two", "Three" ],
			data: "Smooch"
		}), { uiPlayer: act => Promise.resolve(played.push(act)),
			    autocreate: true })
		.then(() => {
			assert.deepEqual(played, [
				new Action( { type: "N", path: [ 'One' ], time: 500 }),
				new Action( { type: "N", path: [ 'One', 'Two' ], time: 500 }),
				new Action( { type: "N", path: [ 'One', 'Two', 'Three' ], time: 500 }),
				new Action( {
					type: "E",
					path: [ 'One', 'Two', 'Three' ],
					time: 500,
					data: 'Smooch'
				})
			]);
			assert(h.tree.getNodeAt([ "One", "Two", "Three" ]));
		});
  });

  it("E missing leaf no autocreate", async function() {
    let debug;// = console.debug;
    let h = new Hoard(debug);
		const played = [];
    return h.play_action(new Action({
			type: "E",
			time: 500,
			path: [ "One", "Two", "Three" ],
			data: "Smooch"
		}), { uiPlayer: act => Promise.resolve(played.push(act)),
			    autocreate: false })
		.then(() => {
			assert(false);
		})
		.catch(e => assert.equal(e.message, "Change value of One↘Two↘Three to 'Smooch' failed: One↘Two↘Three does not exist"));
  });

  it('A & undo', async () => {
    let debug;// = console.debug;
    let h = new Hoard({debug: debug});
		let original, act;
		return h.play_actions(cloud_actions, { undoable: false})
		.then(() => {
			original = new Node(h.tree);
			act = new Action({
				type: "A",
				time: Date.UTC(2005,0),
				path: ["FineDining", "Caviar"],
				data: 1
			});
			return h.play_action(act);
		})
		.then(() => {
			assert.deepEqual(h.tree, {
				children: {
					FineDining: {
						time: Date.UTC(2002,0),
						children:{
							Caviar: {
								time: Date.UTC(2005,0),
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
			assert.equal(h.history[0].undo.type, "A");
			assert.deepEqual(h.history[0].undo.path, ["FineDining", "Caviar"]);
			assert.equal(h.history[0].undo.time, Date.UTC(2002,0));
			assert(h.can_undo());
			return h.undo();
		})
		.then(() => {
			assert.equal(h.history.length, 0);
			assert.deepEqual(h.tree, original);
		});
  });

  it("A cancel missing leaf", async function() {
    let debug;// = console.debug;
    let h = new Hoard(debug);
		return h.play_action(
			new Action({
				type: "A",
				time: 500,
				path: [ "One", "Two", "Three" ]
				// data being undefined should remove the alarm.
			}), {undoable: false})
		.catch(e => {
			// Data is not set, so should not fail
			assert(false, "should not get here");
		});
  });

  it("A cancel create leaf", async function() {
    let debug;// = console.debug;
    let h = new Hoard(debug);
		return h.play_action(
			new Action({
				type: "A",
				time: 500,
				path: [ "One", "Two", "Three" ]
				// data being undefined should remove the alarm.
			}), {undoable: false, autocreate: true});
  });

  it("A set missing leaf", async function() {
    let debug;// = console.debug;
    let h = new Hoard(debug);
		return h.play_action(
			new Action({
				type: "A",
				time: 500,
				path: [ "One", "Two", "Three" ],
				data: {due: Date.UTC(2005,0), repeat: 100000 }
			}), {undoable: false})
		.then(() => {
			assert(false, "Should not succeed");
		})
		.catch(e => {
			assert.equal(e.message, "Add reminder on 01/01/2005, 00:00:00 (repeat every 1 days) to One↘Two↘Three failed: One↘Two↘Three does not exist");
		});
  });

  it("A set create leaf", async function() {
    let debug= console.debug;
    let h = new Hoard(debug);
		return h.play_action(
			new Action({
				type: "A",
				time: 500,
				path: [ "One", "Two", "Three" ],
				data: {due: Date.UTC(2005,0), repeat: 100000 }
			}), {undoable: false, autocreate: true});
  });

  it("M", async () => {
    let debug;// = console.debug;
    let h = new Hoard({debug: debug});
		let original, act;
		return h.play_actions(cloud_actions, { undoable: false})
		.then(() => h.play_action(new Action({
			type: "N",
			time: Date.UTC(2001,0,1),
			path: ["FineDining", "Roe" ],
    }), { undoable: false}))
		.then(() => h.play_action(new Action({
			type: "N",
			time: Date.UTC(2003,0,1),
			path: ["FineDining", "Caviar", "Sevruga" ],
      data: "Meaty"
    }), { undoable: false}))
		.then(() => h.play_action(new Action({
			type: "N",
			time: Date.UTC(2004,0,1),
			path: ["FineDining", "Caviar", "Beluga" ],
      data: "Fishy"
    }), { undoable: false}))
		.then(() => {
			original = new Node(h.tree);
			
			// Move Beluga to be a subnode of Roe
			act = new Action({
				type: "M",
				time: Date.UTC(2005,0),
				path: ["FineDining", "Caviar", "Beluga"],
				data: [ "FineDining", "Roe" ]
			});
			return h.play_action(act);
		})
		.then(() => {
			assert.equal(h.history.length, 1);
			assert.deepEqual(h.history[0].redo, act);
			assert.equal(h.history[0].undo.type, "M");
			assert.deepEqual(h.history[0].undo.data, ["FineDining", "Caviar"]);
			assert.deepEqual(h.history[0].undo.path, ["FineDining", "Roe", "Beluga"]);
			assert.equal(h.history[0].undo.time, Date.UTC(2004,0));
			assert.deepEqual(h.tree, {
				children: {
					FineDining: {
						time: Date.UTC(2001,0),
						children:{
							Caviar: {
								time: Date.UTC(2005,0),
								children: {
									Sevruga: {
										time: Date.UTC(2003,0,1),
										value: "Meaty"
									}
								}
							},
							Roe: {
								time: Date.UTC(2005,0),
								children: {
									Beluga: {
										time: Date.UTC(2004,0,1),
										value: "Fishy"
									}
								}
							}
						}
					}
				},
				time: Date.UTC(2000,0)
			});
			assert(h.can_undo());
			return h.undo();
		})
		.then(() => {
			// The time for "Roe" will not be restored to the original
			// creation time, but will get the time on "Caviar"
			// - this is an accepted limitation of the move process, it's
			// not perfectly symmetrical
			original.getNodeAt('FineDining↘Roe').time
			= original.getNodeAt('FineDining↘Caviar').time;
			assert.deepEqual(h.tree, original);
		});
  });

  it("R", async () => {
    let debug;// = console.debug;
    let h = new Hoard({debug: debug});
		let original, act;
		return h.play_actions(client_actions, { undoable: false })
		.then(() => {
			original = new Node(h.tree);
			act = new Action({
				type: "R",
				time: Date.UTC(2005,0),
				path: ["FineDining", "Truffles"],
				data: "Earthball"
			});
			return h.play_action(act);
		})
		.then(() => {
			assert.deepEqual(h.tree, {
				children: {
					FineDining: {
						time: Date.UTC(2005,0),
						children:{
							Earthball: {
								time: Date.UTC(2003,0),
								value: "Fungi"
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
			assert(h.can_undo());
			return h.undo();
		})
		.then(() => {
			assert.equal(h.history.length, 0);
			assert.deepEqual(h.tree, original);
		});
  });

  it("E", async () => {
    let debug;// = console.debug;
    let h = new Hoard({debug: debug});
		let original, act;
		return h.play_actions(client_actions, {undoable: false})
		.then(() => {
			original = new Node(h.tree);
			act = new Action({
				type: "E",
				time: Date.UTC(2005,0),
				path: ["FineDining", "Truffles"],
				data: "Earthball"
			});
			return h.play_action(act);
		})
		.then(() => {
			assert.deepEqual(h.tree, {
				children: {
					FineDining: {
						time: Date.UTC(2003,0,1),
						children:{
							Truffles: {
								time: Date.UTC(2005,0),
								value: "Earthball"
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
			assert(h.can_undo());
			return  h.undo();
		})
		.then(() => {
			assert.equal(h.history.length, 0);
			assert.deepEqual(h.tree, original);
		});
  });

  it("D non-existant node", async function() {
    let debug;// = console.debug;
    let h = new Hoard(debug);
		return h.play_action(
			new Action({
				type: "D",
				time: 500,
				path: [ "One" ]
			}))
		.then(() => {
			assert(false);
		})
		.catch(e => {
			assert.equal(e.message, "Delete One failed: One does not exist");
		});
	});

	it('D and undo', async () => {
		let debug;// = console.debug;
		let h = new Hoard({debug: debug});
		let original, act;
		return h.play_actions(client_actions, {undoable: false})
		.then(() => {
			original = new Node(h.tree);
			act = new Action({
				type: "D",
				time: Date.UTC(2005,0),
				path: ["FineDining", "Truffles"]
			});
			return h.play_action(act);
		})
		.then(() => {
			assert.deepEqual(h.tree, {
				children: {
					FineDining: {
						time: Date.UTC(2005,0,1)
					}
				},
				time: Date.UTC(2000,0)
			});
			assert.equal(h.history.length, 1);
			assert.deepEqual(h.history[0].redo, act);
			assert.equal(h.history[0].undo.type, "I");
			assert.equal(typeof h.history[0].undo.data, 'string');
			assert.deepEqual(h.history[0].undo.path, ["FineDining", "Truffles"]);
			assert.equal(h.history[0].undo.time, Date.UTC(2003,0,1));
			assert(h.can_undo());
			return h.undo();
		})
		.then(() => {
			assert.equal(h.history.length, 0);
			assert.deepEqual(h.tree, original);
		});
  });

  it('should make from actions', () => {
    let debug;// = console.debug;
		var h = new Hoard({debug: debug});
		return h.play_actions(cloud_actions)
		.then(conflicts => {
			assert.equal(conflicts.length, 0);
			assert.deepEqual(h.tree, {
				children: {
					FineDining: {
						time: Date.UTC(2002,0),
						children:{
							Caviar: {
								time: Date.UTC(2002,0),
							}
						}
					}
				},
				// Touched at the time "FineDining" was stamped
				time: Date.UTC(2000,0)
			});
			assert.equal(h.history.length, 2);
		});
  });

  it('should make from hoard', async function() {
    let debug;// = console.debug;
    let h1 = new Hoard({debug: debug});
		return h1.play_actions(client_actions)
		.then(conflicts => {
			assert.equal(conflicts.length, 0);
			let h = new Hoard({hoard: h1, debug: debug});
			assert.deepEqual(h1, h);
		});
  });

  it('D no such node', function() {
    let debug;// = console.debug;
    let h = new Hoard({debug: debug});

		// No cache, so promise should be resolved will be called
		return h.play_action(new Action({
      type: "D",
      path: ["FineDining", "La Gavroche"]
    }))
		.then(() => assert(false, "Should be rejected"))
    .catch(c => {
			assert.equal(
				c.message,
				"Delete FineDining↘La Gavroche failed: FineDining↘La Gavroche does not exist");
		});
  });

  it('E should autocreate', async () => {
    let debug;// = console.debug;
    let h = new Hoard({debug: debug});

    let kfc = new Action({
			type: "E",
			time: Date.UTC(2004,0),
			path: ["FineDining", "Doner"],
      data: "Sausages"
		});

		return h.play_action(cloud_actions[0])
		.then(() => h.play_action(kfc, {autocreate: true}))
		.then(() => {
			let node = h.tree.getNodeAt(["FineDining", "Doner"]);
			assert.equal(node.value, "Sausages");
		});
  });

  it('E should not autocreate', async () => {
    let debug;// = console.debug;
    let h = new Hoard({debug: debug});

    let kfc = new Action({
			type: "E",
			time: Date.UTC(2004,0),
			path: ["FineDining", "Doner"],
      data: "Sausages"
		});

		return h.play_action(cloud_actions[0])
		.then(() => h.play_action(kfc, {autocreate: false}))
		.then(() => {
			assert(false, "Should not get here");
		})
		.catch(e => {
			assert.equal(e.message, "Change value of FineDining↘Doner to 'Sausages' failed: FineDining↘Doner does not exist");
		});
  });

  it("should ring alarms", async function() {
    let debug;// = console.debug;
    let actions = [
      new Action({
				type: "N",
				time: Date.UTC(2000,0),
				path: ["FineDining"]
      }),
      new Action({
				type: "A",
				time: Date.UTC(2007,0,30),
        data: 200, // should be interpreted as "200 days from
        // the time the alarm was added"
				path: [ "FineDining" ]
      }),
      new Action({
				type: "N",
				time: Date.UTC(2001,6,1),
				path: [ "FineDining", "Caviare" ]
      }),
      new Action({
				type: "N",
				time: Date.UTC(2002,0,1),
				path: [ "FineDining", "Caviare", "Beluga" ],
        data: "£6.70 per gram"
      }),
      new Action({
        type: "A",
				path: [ "FineDining", "Caviare", "Beluga" ],
				time: Date.UTC(2003,0,1),
        data: {
          due: Date.UTC(2003,3,11),
          repeat: 3600000000
        }
      })
    ];
		actions[1].ring_expected = Date.UTC(2007,7,18);
		actions[4].ring_expected = Date.UTC(2003,3,11);
		
    let cloud = new Hoard({debug: debug});
		return cloud.play_actions(actions)
    .then(c => cloud.check_alarms((path, rang_at) => {
      for (let a of actions) {
        if (a.type === "A" && a.path.join("/") === path.join("/")) {
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
    }))
    .then(() => {
      for (let act of actions) {
        if (act.type === "A" && "ring_expected" in act)
          assert(act.rung,
                 new Action(act).verbose()
                 + " did not ring at "
                 + new Date(act.ring_expected).toUTCString());
      }
      
      assert.equal(cloud.tree.getChild("FineDining").alarm.repeat,
                   17280000000);
      assert.equal(
        cloud.tree.getNodeAt("FineDining↘Caviare↘Beluga").alarm.repeat,
        3600000000);
    });
  });

  it("get_node", async () => {
    let debug;// = console.debug;
    const actions = [
      new Action({
				type: "N",
				time: Date.UTC(2000,0,1),
				path: ["A"]
      }),
      new Action({
				type: "N",
				time: Date.UTC(2001,6,1),
				path: [ "A", "A" ]
      }),
      new Action({
				type: "N",
				time: Date.UTC(2002,0,1),
				path: [ "A", "B" ]
      }),
      new Action({
				type: "N",
				time: Date.UTC(2002,0,1),
				path: [ "A", "C" ]
      }),
      new Action({
        type: "N",
				path: [ "A", "B", "C" ],
				time: Date.UTC(2003,0,1)
      })
    ];
    let cloud = new Hoard({debug: debug});
		return cloud.play_actions(actions)
		.then(c => {
			let n = cloud.get_node(["A", "B", "C"]);
			assert.equal(n.time, Date.UTC(2003,0,1));
			n = cloud.get_node(["A", "A"]);
			assert.equal(n.time, Date.UTC(2001,6,1));
			n = cloud.get_node(["A", "B", "D"]);
			assert(!n);
		});
  });

  const full_tree_actions = [
    new Action({
			type: "N",
			time: 100,
			path: ["FineDining"]
    }),
    new Action({
			type: "A",
			time: 200,
      data: { due: Date.UTC(2015,3,4), repeat: 10 },
			path: ["FineDining"]
    }),
    new Action({
			type: "N",
			time: 300,
			path: [ "FineDining", "Caviare" ]
    }),
    new Action({
			type: "N",
			time: 400,
			path: [ "FineDining", "Caviare", "Beluga" ],
      data: "£6.70 per gram"
    }),
    new Action({
      type: "A",
			path: [ "FineDining", "Caviare", "Beluga" ],
			time: 500,
      data: {
        due: Date.UTC(2007,11,25),
        repeat: 100
      }
    }),
    new Action({
      type: "A",
			path: [ "FineDining", "Caviare" ],
			time: 600,
      data: {
        due: Date.UTC(2005,3,1),
        repeat: 365}
    }),
    new Action({
			type: "X",
			time: 300,
			path: [ "FineDining", "Caviare", "Beluga" ],
      data: { size: 32, chars: "A-Z;0-9" }
    })
  ];

  let full_tree_json = {
    FineDining: {
      time: 300,
      children: {
        Caviare: {
          time: 600,
          children: {
            Beluga: {
              time: 300,
              value: "£6.70 per gram",
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

  it("actions from tree", async function() {
    let debug;// = console.debug;
    let cloud = new Hoard({debug: debug});
		await cloud.play_actions(full_tree_actions)
		.then(conflicts => assert.equal(conflicts.length, 0));

    // Make sure we can construct from the tree
		let h = new Hoard({debug: debug, tree: cloud.tree});
    assert.deepEqual(h.tree, cloud.tree);
		
    let acts = cloud.actions_to_recreate();
    assert.deepEqual(acts, [
      { type: "N", path: [ 'FineDining' ],
        time: 300 }, // creation of 'Caviare',
      { type: "A", path: [ 'FineDining' ],
        time: 300,
        data: {
          due: Date.UTC(2015,3,4), repeat: 10
        }},
      { type: "N", path: [ 'FineDining', 'Caviare' ],
        time: 600 }, // alarm
      { type: "A", path: [ 'FineDining', 'Caviare' ],
        time: 600,
        data: {
          due: Date.UTC(2005,3,1),
          repeat: 365
        }},
      { type: "N", path: [ 'FineDining', 'Caviare', 'Beluga' ],
        time: 300,
        data: '£6.70 per gram' },
      { type: "A", path: [ 'FineDining', 'Caviare', 'Beluga' ],
        time: 300,
        data: {
          due: Date.UTC(2007,11,25),
          repeat: 100
        }},
      { type: "X", path: [ 'FineDining', 'Caviare', 'Beluga' ],
        time: 300,
        data: { size: 32, chars:"A-Z;0-9" }
      }
    ]);
  });

  it('undo empty hoard', async () => {
    let debug;// = console.debug;
    let h = new Hoard({debug: debug});
    let original = new Node(h.tree);
		let played = [];
    return h.undo({
			undoable: true,
			uiPlayer: a => Promise.resolve(played.push(a))
		})
		.then(() => {
			assert(false);
		})
		.catch(e => {
			assert.equal(e.message, "Nothing to undo");
		});
  });
});
