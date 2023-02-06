/*@preserve Copyright (C) 2019 Crawford Currie http://c-dot.co.uk license MIT*/
/* eslint-env browser */

import "jquery/dist/jquery.js";
import "banana-i18n/dist/banana-i18n.js";
import { Dialog } from "../../src/Dialog.js";
import { LocalStorageStore } from "../../src/LocalStorageStore.js";
import { Action } from "../../src/Action.js";
import { Hoard } from "../../src/Hoard.js";
import { Tree } from "../../src/Tree.js";

import "../../src/jq/simulated_password.js";
import "../../src/jq/icon_button.js";
import "../../src/jq/i18n.js";

const debug = console.debug;

// Make sure global options get passed in
Dialog.set_default_options({
  debug: debug
});

const TESTR = "1234567普通话/普通話العَرَبِيَّة";
  
// Test application (do we need this any more?)
const test_app = {
  client: {
    store: new LocalStorageStore(),
    hoard: new Hoard()
  },
  cloud: {
    store: new LocalStorageStore(),
    hoard: new Hoard()
  },
  appPlayAction: function() {
    debug("appPlayAction", arguments);
    return Promise.resolve();
  }
};

const login_title = "Login";

function lert() {
  var args = Array.prototype.slice.call(arguments);
  Dialog.confirm("AlertDialog", {
    alert: args.join(" ")
  });
}

const tests = {
  add_node: function() {
    return Dialog.confirm("AddDialog", {
      path: [ "New", "Node", "Not", "x" ],
      validate: key => {
        return key !== "x";
      },
      is_value: false
    }).then(result => {
      lert("add_node", "OK", result.key);
    });
  },
  add_leaf: function() {
    return Dialog.confirm("AddDialog", {
      path: [ "Leaf", "Value", "Not", "x" ],
      validate: key => {
        return key !== "x";
      },
      is_value: true
    }).then(result => {
      lert("add_leaf", "OK", result.key, "=", result.value);
    });
  },
  alarm: function() {
    return Dialog.confirm("AlarmDialog", {
      path: ["Squirrel", "Nut", "Kin"],
      alarm: { due: Date.UTC(2002,0,2), repeat: 12345678910 },
      last_change: Date.UTC(1998,3,1)
    })
    .then(act => {
      lert("Alarm", act);
    });
  },
  alert: function() {
    return Dialog.confirm("AlertDialog", {
      alert: [
        {
          severity: "notice",
          message: "Notice"
        },
        {
          severity: "warning",
          message: "Close this dialog to open a non-blocking"
        },
        {
          severity: "error",
          http: 401
        },
        "Plain text"
      ]
    }).then((/*dlg*/) => {
      Dialog.open("AlertDialog", {
        alert: {
          severity: "warning",
          message: "Message"
        }
      }).then(dlg => {
        dlg.push([
          {
            severity: "error",
            message: "An error"
          },
          {
            severity: "notice",
            message: "And a notice"
          }]);
        return dlg;
      })
      .then(dlg => {
        lert("Waiting for confirmation or cancel");
        return dlg.wait();
      })
      .then(() => {
        lert("OKed");
      });
    });
  },
  choose_changes: function() {
    return Dialog.confirm("ChangesDialog", {
      changes: [
        new Action({
					type: "N",
					time: Date.UTC(2000,0,1),
					path: ["A"]
        }),
        new Action({
					type: "A",
					time: Date.UTC(2001,6,1),
					data: { time: Date.UTC(2001,6,1),
                  repeat: (1000 * 60 * 60 * 24 * 100) },
					path: [ "A" ]
        }),
        new Action({
					type: "C",
					time: Date.UTC(2001,6,1),
					path: [ "A" ]
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
					type: "D",
					time: Date.UTC(2002,0,1),
					path: [ "A", "C" ]
        }),
        new Action({
          type: "N",
					path: [ "A", "B", "C" ],
					time: Date.UTC(2003,0,1)
        }),
        new Action({
					type: "E",
					time: Date.UTC(2002,0,2),
					path: ["A", "B", "C"],
          data: "Nuts"
        }),
        new Action({
					type: "M",
					time: Date.UTC(2002,0,2),
					path: ["A", "B", "C"],
          data: ["A", "Nuts"]
        }),
      ]
    })
    .then(changes => {
      lert("ok choose_changes", changes);
    });
  },
  change_pass: function() {
    return Dialog.confirm("ChangePasswordDialog", {
      encryption_pass: () => "pass water"
    })
    .then(pw => {
      lert("new pw", pw);
    });
  },
  delete: function() {
    return Dialog.confirm("DeleteDialog", {
      path: [ "Woggle", "Niblick" ],
      is_leaf: true
    })
    .then(path => {
      lert("Confirmed delete of", path);
    });
  },
  extras: function() {
    return Dialog.confirm("ExtrasDialog", {
      needs_image: false,
      encryption_pass: function(pass) {
        lert("encryption pass", pass);
        return pass;
      },
      cloud_path: function(path) {
        if (typeof path !== 'undefined')
          lert("Cloud path", path);
        else path = "/a/bogus/path";
        return path;
      },
      tree_json: function(json) {
        if (typeof json !== 'undefined')
          lert("JSON", json);
        else json = JSON.stringify({ A: 1, C: 2 }, null, " ");
        return json;
      }
    })
    .then(options => {
      lert("Confirmed extras", options);
    });
  },
  insert: function() {
    return Dialog.confirm("InsertDialog", {
      $node: $("#node"),
      data: { "fruit": "bat" },
      path: [ "Woggle", "Niblick" ]
    })
    .then(options => {
      lert("insert", options);
    });
  },
  login: function() {
    return Dialog.confirm("LoginDialog", {
      title: login_title,
      user: "Jaffar",
      pass: "Cayke"
    })
    .then(info => {
      lert("Login", info.user, info.pass);
    });
  },
  pick: function() {
    return Dialog.confirm("PickDialog", {
      pick_from: "0123456789"
    });
  },
  store_settings_image: function() {
    return Dialog.confirm("StoreSettingsDialog", {
      needs_image: true,
      image_url: function(path) {
        if (typeof path !== 'undefined')
          lert("Steg image", path);
        return "../../images/GCHQ.png";
      },
      cloud_path: function(path) {
        if (typeof path !== 'undefined')
          lert("Cloud path", path);
        return "/a/bogus/path";
      }
    })
    .then(path => {
      lert("store_settings OK", path);
    });
  },
  store_settings_noimage: function() {
    return Dialog.confirm("StoreSettingsDialog", {
      cloud_path: function(path) {
        if (typeof path !== 'undefined')
          lert("Cloud path", path);
        return "/a/bogus/path";
      }
    })
    .then(path => {
      lert("store_settings OK", path);
    });
  },
  randomise: function() {
    return Dialog.confirm("RandomiseDialog", {
      key: "TEST",
      constraints: { size: 16, chars: "AB-D" }
    })
    .then(res => {
      lert("randomise OK", res);
    });
  },
  move_to: function() {
		const data = {
			A: {
				AA: {
					AAA: false
				},
				AB: false,
				AC: false,
				AD: {
					ADA: {
						ADAA: false,
						ADAB: false,
						ADAC: false
					}
				}
			},
			B: {
				BA: {
					BAA: false
				},
				BB: false,
				BC: false,
				BD: {
					BDA: {
						BDAA: false,
						BDAB: false,
						BDAC: false
					}
				}
			},
			C: {
				CA: {
					CAA: false
				},
				CB: false,
				CC: false,
				CD: {
					CDA: {
						CDAA: false,
						CDAB: false,
						CDAC: false
					}
				}
			}
		};
    return Dialog.confirm("MoveToDialog", {
      key: "TEST",
      path: [ "A", "AA", "AAA" ],
			getContent: path => {
				let n = data;
				for (let i of path)
					n = n[i];
				return n;
			}
    })
    .then(res => {
      lert("move_to OK", res);
    });
  }
};

// Fake the need for store_settings
test_app.cloud.store.option("needs_image", true);

$(() => {

  $("#node").data("key", "spoon");
  $("#node").data("value",TESTR);
  $("#node").data("path", []);
  $("#node").tree({});

  $("#node").data("alarm", { time: Date.UTC(2020,1,2) });

  for (let name in tests) {
    const $button = $("<button>" + name + " </button>");
    $button.on("click", () => {
      tests[name]()
      .catch(f => {
        lert("Aborted", f);
      });
    });
    $("#buttons").append($button);
    $("#buttons").append("<br/>");
  }
});

