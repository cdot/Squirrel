/*@preserve Copyright (C) 2019 Crawford Currie http://c-dot.co.uk license MIT*/
/*eslint-env shared-node-browser, mocha */

import { assert } from "chai";
import { Hoarder } from "../../src/common/Hoarder.js";
import { Action } from "../../src/common/Action.js";
import { Hoard } from "../../src/common/Hoard.js";
import { LocalStorageStore } from "../../src/stores/LocalStorageStore.js";
import { CryptoLayer } from "../../src/stores/CryptoLayer.js";
import { Utils } from "../../src/common/Utils.js";
import { Serror } from "../../src/common/Serror.js";
import { MemoryStore } from "../../src/stores/MemoryStore.js";

import { i18n } from "../i18n.js";

const MSPERDAY = 24 * 60 * 60 * 1000;

describe("Hoarder", () => {

  before(() => i18n());

  it("constructor", function() {
    let h = new Hoarder();
    assert.equal(h.cloudChanged, false);
    h.cloud_store(new LocalStorageStore({ debug: console.debug,
                                          user: "Cumulo",
                                          pass: "Nimbus" }));
    assert.equal(h.cloudChanged, false);
    h.client_store(new LocalStorageStore({ debug: console.debug,
                                           user: "Stratus",
                                           pass: "Alto"}));
    assert.equal(h.cloudChanged, false);
    h.cloud_path("CLOUD");
    assert.equal(h.cloudChanged, false);
    assert.equal(h.clientChanges.length, 1);

    assert.equal(h.user(), "Stratus");
    assert.equal(h.encryption_pass(), "Alto");
    assert.equal(h.cloudChanged, false);
  });

  const full_tree_actions = [
    {
			type: "N",
			time: 100,
			path: ["One"]
    },
    {
			type: "A",
			time: 200,
      data: {
        due: Date.UTC(2513,9,9),
        repeat: 100
      },
			path: ["One"]
    },
    {
			type: "N",
			time: 300,
			path: [ "One", "Two" ]
    },
    {
			type: "N",
			time: 400,
			path: [ "One", "Two", "Three" ],
      data: "£6.70 per gram"
    },
    {
      type: "A",
			path: [ "One", "Two", "Three" ],
			time: 500,
      data: {
        due: Date.UTC(2918,11,11),
        repeat: 100
      }
    },
    {
      type: "A",
			path: [ "One", "Two" ],
			time: 600,
      data: {
        due: Date.UTC(2413,6,23),
        repeat: 100
      }
    },
    {
			type: "X",
			time: 500,
			path: [ "One", "Two", "Three" ],
      data: {
				size: 32,
				chars: "A-Z;0-9"
			}
    }
  ].map(a => new Action(a));

  it("load_client", async () => {
    let debug;// = console.debug;
    let store = new MemoryStore({ debug: debug });
    let clierd = new Hoard(debug);
    for (let act of full_tree_actions) {
      await clierd.play_action(act);
    }
    let data = { cloud_path: "blah", hoard: clierd };
    return store.writes("client", JSON.stringify(data)).then(() => {
      let h = new Hoarder({ debug: debug, clientStore: store });
      return h.load_client()
      .then(() => {
        assert.deepEqual(h.hoard.history, clierd.history);
        assert.deepEqual(h.hoard.tree, clierd.tree);
      });
    });
  });

  it("load_cloud", function() {
    let debug;// = console.debug;
    const store = new MemoryStore({ debug: debug, user: "Zeno" });
    const h = new Hoarder({
      debug: debug, cloudPath: "blah", cloudStore: store });
    return store.writes("blah", JSON.stringify(full_tree_actions))
		.then(() => {
      return h.load_cloud()
      .then(actions => {
        assert.deepEqual(actions, full_tree_actions);
      });
    });
  });

  it("load_cloud fails 1", function() {
    let debug;// = console.log;
    let store = new MemoryStore({ debug: debug, user: "Zeno" });
    let h = new Hoarder({
      debug: debug, cloudPath: "paradox", cloudStore: store });
    return h.load_cloud()
    .then(() => {
      assert(false);
    })
    .catch(e => {
      assert(e instanceof Serror);
      assert.equal(e.status, 400);
      assert.equal(e.message, "paradox is not in store");
    });
  });

  it("load_cloud fails 2", function() {
    let debug;// = console.debug;
    let store = new MemoryStore({ debug: debug, user: "Zeno" });
    let h = new Hoarder({
      debug: debug, cloudPath: "blah", cloudStore: store });
    return store.writes("blah", "rubbish")
    .then(() => {
      return h.load_cloud()
      .then(() => {
        assert(false);
      })
      .catch(e => {
        assert(e instanceof Serror);
      });
    });
  });

  function make_cloud(actions, store) {
    let s = JSON.stringify(actions);
    store.option("pass", "pass");
    return store.writes("blah", s);
  }

  async function make_client(actions, store, debug) {
    let clierd = new Hoard({debug:debug});
    store.option("pass", "pass");
    for (let act of full_tree_actions) {
      await clierd.play_action(act, {undoable:false});
    }
    let s = JSON.stringify({
      cloud_path: "blah",
      hoard: clierd,
      last_sync: 900
    });
    return store.writes("client", s);
  }

  // Simple update involving a local change and a remote change
  // that overlap. The update from the cloud should play the
  // remote change into the local hoard
  it("simple synchronise", function() {
    let debug;// = console.log;
    let cliest = new MemoryStore();
    let cloust = new MemoryStore();

    // Add an action to the cloud that won't be in the client
    let acts = full_tree_actions.slice();
    let cloud_act = new Action({
			type:"N",
			path:["One", "From Cloud"],
      time: 1000,
			data:"cloud action"
		});
    acts.push(cloud_act);

		// Make an action that will be in the client, but not the cloud,
		// slightly before the cloud one
    let client_act = new Action({
      type:"N",
			path:["One", "From Client"],
			time: 950,
			data:"client action"
		});

    let h;
		let conflicts = [];
    return make_cloud(acts, cloust)
    .then(() => {
      // Populate the client with the basic actions
      return make_client(full_tree_actions, cliest);
    })
    .then(() => {
      h = new Hoarder({
        debug: debug,
        cloudPath: "blah",
        clientStore: cliest,
        cloudStore: cloust
      });
      return h.load_client();
    })
    .then(() =>
          // Add local action in the client, adding an undo
          h.hoard.play_action(client_act, {autocreate: true}))
    .then((/*e*/) =>
          h.update_from_cloud(
            {progress: conflicts} // array supports push, which is all we need
          ))
    .then(actions => {
			assert.equal(conflicts.length, 0);
			assert(h.last_sync > 510);
			// Make sure client and cloud actions both present
      assert.deepEqual(actions, full_tree_actions.concat(
        [ client_act,  cloud_act ]));
      assert.deepEqual(h.hoard.tree.children, {
        One: {
          time: 1000, // cloud action time
          children: {
            Two: {
              time: 600,
              children: {
                Three: {
                  time: 500,
                  value: "£6.70 per gram",
                  alarm: {
                    due: Date.UTC(2918,11,11),
                    repeat: 100
                  },
                  constraints: {
                    chars: "A-Z;0-9",
                    size: 32
                  }
                }
              },
              alarm: {
                due: Date.UTC(2413,6,23),
                repeat: 100
              }
            },
            "From Cloud": {
              time: 1000, // synch time
              value: "cloud action"
            },
            "From Client": {
              time: 950,
              value: "client action"
            }
          },
          alarm: {
            due: Date.UTC(2513,9,9),
            repeat: 100
          }
        }
      });
    });
  });

  it("synchronise with conflicts", function() {
    let debug;// = console.debug;
    let cliest = new MemoryStore();
    let cloust = new MemoryStore();

    // Add an action to the cloud
    let acts = full_tree_actions.slice();
    let cloud_act = new Action({
      type:"R", path:["One", "Two"], data:"Whoops", time:960});
    let h;
    acts.push(cloud_act);

    let eact = new Action({
      type:"R", path:["One", "Two"], time:950, data:"In Client"});
    return make_cloud(acts, cloust)
    .then(() => {
      // Populate the client with the base tree
      return make_client(full_tree_actions, cliest);
    })
    .then(() => {
      h = new Hoarder({
        debug: debug,
        cloudPath: "blah",
        clientStore: cliest,
        cloudStore: cloust,
        last_sync: 900
      });
      return h.load_client();
    })
    .then(() =>
          // Add a local action in the client renaming a different node to
          // the same name as the cloud action
          
          h.hoard.play_action(eact))
    .then(() => {
      let progress = [];
      return h.update_from_cloud({
        progress: progress,
        selector: a => Promise.resolve(a)})
      .then(actions => {
        assert.equal(actions.length, 8);
        assert.deepEqual(actions, full_tree_actions.concat(
          [eact]));
				/** noisy fail
            assert.equal(progress.length, 1);
            assert.equal(progress[0].severity, "warning");
            assert.equal(progress[0].message, "Delete One↘Two failed: it does not exist");
				*/
      });
    });
  });
  
  it("synchronise and save", function() {
    let debug;// = console.debug;
    let cliest = new MemoryStore();
    let cloust = new MemoryStore();

    // Add an action to the cloud
    let acts = full_tree_actions.slice();
    let cloud_act = new Action({type:"N", path:["One", "From Cloud"], time:960, data:"4"});
    acts.push(cloud_act);
    let h;
    let progress = [];
    let clieh;
		
    return make_cloud(acts, cloust)
    .then(() => {
      // Populate the client with the base tree
      return make_client(full_tree_actions, cliest);
    })
    .then(() => {
      h = new Hoarder({
        debug: debug,
        cloudPath: "blah",
        clientStore: cliest,
        cloudStore: cloust,
        last_sync: 900
      });
      return h.load_client();
    })
    .then(() => {
      // Add a local action in the client
      return h.hoard.play_action(
				new Action({type:"N", path:["One", "Five"],
							      time:950, data:"5"}));
		})
    .then(() => {
			return h.update_from_cloud(progress);
		})
    .then(actions => {
			return h.save_cloud(actions, progress);
		})
    .then(() => {
			return h.save_client(progress);
		})
    .then(() => {
      assert.equal(progress.length, 2);
      assert.equal(progress[0].message, "Saved in cloud");
      assert.equal(progress[1].message, "Saved in local store");
      return cliest.reads("client");
		})
		.then(clied => {
			clieh = new Hoard({ debug: debug, hoard: JSON.parse(clied).hoard });
			return cloust.reads("blah");
		})
		.then(async cloud => {
      let clouh = new Hoard({ debug: debug});
      //console.log(cloud));
      let acts = JSON.parse(cloud);
      for (let act of acts) {
        await clouh.play_action(new Action(act));
      }
      //console.log(clieh.treeJSON());
      //console.log(clouh.treeJSON());
      assert.deepEqual(clieh.tree, clouh.tree);
    });
  });

  it("encrypted synchronise", function() {
    let debug;// = console.debug;
    let cliest = new CryptoLayer({ understore: new MemoryStore() });
    let cloust = new CryptoLayer({ understore: new MemoryStore() });

    // Add an action to the cloud
    let acts = full_tree_actions.slice();
    let cloud_act = new Action({type:"N", path:["One", "From Cloud"], time:960, data:"4"});
    acts.push(cloud_act);
    let h;
    let progress = [];
    
    return make_cloud(acts, cloust)
    .then(() => {
      // Populate the client with the base tree
      return make_client(full_tree_actions, cliest);
    })
    .then(() => {
      h = new Hoarder({
        debug: debug,
        cloudPath: "blah",
        clientStore: cliest,
        cloudStore: cloust,
        last_sync: 900
      });
      h.authenticate({ user: "test", pass: "pass" });
      return h.load_client();
    })
    .then(() => {
      // Add a local action in the client
      let act = new Action({type:"N", path:["One", "Five"], time:950, data:"5"});
      return h.hoard.play_action(act)
			.then(() => {
				let progress = [];
				return h.update_from_cloud(progress);
			});
    })
    .then(actions => {
      assert.equal(actions.length, 9);
      return h.save_cloud(actions, progress)
    })
    .then(() => {
      return h.save_client(progress);
    });
  });

  it("synchronise unreadable cloud", function() {
    let debug;// = console.debug;
    let cliest = new MemoryStore();
    let cloust = new MemoryStore();

    // Add an action to the cloud
    let acts = full_tree_actions.slice();
    let cloud_act = new Action({type:"N", path:["One", "From Cloud"], time:960, data:"4"});
    acts.push(cloud_act);

    cloust.writes("blah", "rubbish")
    .then(() => {
      // Populate the client with the base tree
      return make_client(full_tree_actions, cliest);
    })
    .then(() => {
      let h = new Hoarder({
        debug: debug,
        cloudPath: "blah",
        clientStore: cliest,
        cloudStore: cloust,
        last_sync: 900
      });
      return h.load_client()
      .then(() => {
        // Add a local action in the client
        let act = new Action({type:"N", path:["One", "Five"], time:950, data:"5"});
        let progress = [];
        return h.hoard.play_action(act)
        .then(() => h.update_from_cloud(progress))
        .then(() => {
          assert(false);
        })
        .catch(e => {
          assert(e instanceof Serror);
          assert.equal(e.message, "Cloud store could not be parsed");
          assert.equal(e.status, 400);
        });
      });
    });
  });

  it("check_alarms", function() {
    let debug;// = console.debug;
    let cliest = new MemoryStore();
    let cloust = new MemoryStore();

    // Add an action to the cloud
    let acts = full_tree_actions.slice();
    let cloud_act = new Action({type:"N", path:["One", "From Cloud"], time:960, data:"4"});
    acts.push(cloud_act);

    return make_cloud(acts, cloust)
    .then(() => {
      // Populate the client with the base tree
      return make_client(full_tree_actions, cliest);
    })
    .then(() => {
      let h = new Hoarder({
        debug: debug,
        cloudPath: "blah",
        clientStore: cliest,
        cloudStore: cloust,
        last_sync: 900
      });
      return h.load_client()
      .then(() => {
        return h.check_alarms(function(path/*, rang_at*/) {
          for (let a of full_tree_actions) {
            if (a.type === "A" && TestRunner.samePath(a.path, path)) {
              assert(!a.rung);
              //console.log(a,"at",rang_at);
              a.rung = true;
            }
          }
          return Promise.resolve();
        });
      });
    });
  });

	// Like simple syncrhonise, but save_stores should do most of the work
  it("save_stores", function() {
    let debug;// = console.debug;
    let cliest = new MemoryStore();
    let cloust = new MemoryStore();

    // Add an action to the cloud
    let acts = full_tree_actions.slice();
    let cloud_act = new Action({
			type:"N",
			path:["One", "From Cloud"],
      time:960,
			data:"4"
		});
    let h;
    acts.push(cloud_act);

    let eact = new Action({
      type:"N",
			path:["One", "Five"],
			time:950,
			data:"5"
		});
    return make_cloud(acts, cloust)
    .then(() => {
      // Populate the client with the base tree
      return make_client(full_tree_actions, cliest);
    })
    .then(() => {
      h = new Hoarder({
        debug: debug,
        cloudPath: "blah",
        clientStore: cliest,
        cloudStore: cloust,
        last_sync: 900
      });
      return h.load_client();
    })
    .then(() =>
          // Add a local action in the client
          h.hoard.play_action(eact))
    .then(() => {
      return h.save_stores({
        progress: [],
        selector: choose => {
          return Promise.resolve(choose);
        }
      });
    })
    .then(() => {
			let loco = h.hoard.actions_to_recreate();
			assert.equal(loco.length, 9);
			let remoh = new Hoard({});
			let remoa = JSON.parse(cloust.data.blah).map(a => new Action(a));
			return remoh.play_actions(remoa)
			.then(cs => {
				let remo = remoh.actions_to_recreate();
				assert.equal(remo.length, loco.length);
				assert.deepEqual(remo, loco);
			});
    });
  });
});
