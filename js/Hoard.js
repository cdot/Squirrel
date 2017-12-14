/*@preserve Copyright (C) 2015 Crawford Currie http://c-dot.co.uk license MIT*/

/* global global:true */
/* global TX:true */
/* global Utils:true */

/**
 * A combined hierarchical data store with change log, designed to be
 * used in a client-cloud topology where a single cloud hoard is
 * synched with multiple client stores, each of which may change
 * asynchronously.
 *
 * On the client side, the hoard contains a tree that represents the
 * current data in the hoard. Then it has a list of actions that
 * record the actions performed on the client since the last sync with
 * the cloud. These actions are already reflected in the tree, but
 * are kept so they can be played into the cloud on the next synch.
 *
 * On the cloud side the tree is ignored, and the list of actions
 * represents all changes since the hoard was established. These can
 * be replayed in full to regenerate the tree, though this is a
 * time-consuming business.
 *
 * At any time the hoard can be optimised - basically blowing away all
 * the history. This should only be done if you are sure all clients
 * are up-to-date.
 *
 * @typedef Action
 * @type {object}
 * @property {string} type - single character type
 * @property {string[]} path - node path
 * @property {object} data - optional data object
 * @property {number} alarm - optional alarm object
 * @property {string} constraints - optional constraints on values
 *
 * @typedef Conflict
 * @type {object}
 * @property {Action} action
 * @property {string} message
 *
 * @typedef Data
 * @type {object}
 * @property {Data[]|string} colelction of subnodes, or leaf data if
 * this is string
 * @property time {integer} time of the last modification
 *
 * @callback Listener
 * @param {Action} action
 * @param {Function} chain
 */

/* Version of hoard. No version in the hoard implies it is version 1.0
 * Only increment this number when older code is no longer able to read
 * the hoard, as a version incompatibility will throw an error.
 */
const VERSION = 2.0;

if (typeof module !== "undefined")
    TX = require("./Translation");

/**
 * Create a new Hoard.
 * @class
 * @param data an optional JSON string containing a serialised Hoard
 * @member {object} cache root of tree
 * @member {Action[]} actions actions played since the last sync
 * @member {number} last_sync integer date since the last sync, or null
 */
function Hoard(data) {
    "use strict";

    if (data) {
        if (typeof data !== "object")
            data = JSON.parse(data);

        this.last_sync = data.last_sync;
        this.actions = data.actions;
        this.cache = data.cache;
        this.options = data.options;
        this.version = data.version || VERSION;

        if (this.version > VERSION)
            throw "Hoard error: cannot read a version " + data.version +
                " hoard with " + VERSION + " code";

    } else {
        this.last_sync = null;
        this.clear_actions();
        this.cache = null;
        this.version = VERSION;
    }
    if (typeof this.options === "undefined")
        this.options = {
            // options exist in both the client and cloud hoards, but
            // are only read from the client - they are never read
            // from the cloud. This is so that (for example) a tablet
            // doesn't get the autosave option when it spends most of
            // its time disconnected.

            // Is autosave turned on?
            autosave: false,

            // What's the server path to the hoard store?
            store_path: null
        };
}

/**
 * Generate a terse string version of an action for reporting
 * @param action action to report on
 * @return {string} human readable description of action
 */
Hoard.stringify_action = function (action) {
    "use strict";

    return action.type + ":" +
        action.path.join("↘") +
        (typeof action.data !== "undefined" ?
            (" '" + action.data + "'") : "") +
        " @" + new Date(action.time)
        .toLocaleString();
};

if (global.DEBUG) {
    /**
     * Return a dump of the current state of the hoard for debugging
     * @return a string with the JSON of the cache, and a list of the actions.
     */
    Hoard.prototype.dump = function () {
        "use strict";

        var data = this.JSON() + "\n"; // get the cache
        for (var i = 0; i < this.actions.length; i++) {
            data = data + Hoard.stringify_action(this.actions[i]) + "\n";
        }
        return data;
    };
}

/**
 * Clear down the actions in the hoard. The cache is left untouched.
 * This is used when the client hoard has been synched with the cloud
 * and the local actions list is no longer needed.
 */
Hoard.prototype.clear_actions = function () {
    "use strict";

    this.actions = [];
};

/**
 * Push a new action on to the end of the action stream. No checking
 * is done on the action, though it will default the time to 'now'.
 * @param e the action to push. The action will be deep-copied.
 */
Hoard.prototype.push_action = function (e) {
    this.actions.push({
        type: e.type,
        path: e.path.slice(),
        time: e.time ? e.time : Date.now(),
        data: e.data
    });
};

/**
 * Pop the most recently pushed action off the actions stream and
 * return it.
 * @return the action popped
 */
Hoard.prototype.pop_action = function () {
    if (global.DEBUG && this.actions.length === 0)
        throw "Cannot pop from empty actions stream";
    return this.actions.pop();
};

/**
 * @private
 * Locate the node referenced by the given path
 * @param path array of path elements
 * @param offset optional offset from the leaf e.g. 1 will find the parent
 * of the node identified by the path
 */
Hoard.prototype.locate_node = function (path, offset) {
    var node = this.cache;
    offset = offset || 0;

    for (var i = 0; i < path.length - offset; i++) {
        var name = path[i];
        if (node && typeof node.data === "string") {
            throw "Cannot recurse into leaf node";
        } else if (node && node.data[name]) {
            node = node.data[name];
        } else {
            return undefined;
        }
    }
    return node;
};

/**
 * Play a single action into the cache. The cache is updated, but
 * the action is <em>not</em> added to the action stream.
 * Action types:
 * <ul>
 * <li>'N' with no data - create collection</li>
 * <li>'N' with data - create leaf</li>
 * <li>'D' delete node, no data. Will delete the entire node tree.</li>
 * <li>'E' edit node - modify the leaf data in a node</li>
 * <li>'R' rename node - data contains new name</li>
 * <li>'A' add alarm to node - data is the alarm time</li>
 * <li>'C' cancel alarm on node</li>
 * <li>'X' add/remove value constraints</li>
 * </ul>
 * Returns a conflict object if there was an error. This has two fields,
 * 'action' for the action record and 'message'.
 * @param {Action} e the action record
 * @param {function} listener called when the action is played. Not called if
 * there is a conflict.
 * listener.call(this:Hoard, e:Action)
 * @return {Conflict} conflict object, or null if there was no conflict
 */
Hoard.prototype.play_action = function (e, listener) {
    "use strict";

    if (typeof e.time === "undefined" || e.time === null)
        e.time = Date.now();

    function conflict(e, mess) {
        var s = TX.tx("Cannot ") + {
            A: TX.tx("add reminder to"),
            C: TX.tx("cancel reminder"),
            D: TX.tx("delete"),
            E: TX.tx("change value of"),
            M: TX.tx("move"),
            N: TX.tx("create"),
            R: TX.tx("rename"),
            X: TX.tx("constrain")
        }[e.type];
        return {
            conflict: e,
            message: s + " '" + e.path.join("↘") + "': " + mess
        }
    }

    if (e.path.length === 0)
        return conflict(e, "Zero length path");

    if (!this.cache) {
        this.cache = {
            data: {}
        }
    }

    var parent = this.locate_node(e.path, 1);
    // Path must always point to a valid parent pre-existing in the cache
    // parent will never be null
    if (!parent)
        return conflict(e, TX.tx("Parent folder not found"));

    var name = e.path[e.path.length - 1];
    // Node may be undefined e.g. if we are creating
    var node = parent.data[name];

    if (e.type === "N") { // New
        if (node)
            return conflict(e, TX.tx("It already exists"));
        parent.time = e.time; // collection is being modified
        parent.data[name] = {
            time: e.time,
            data: (typeof e.data === "string") ?
                e.data : {}
        };
    } else {

        // other actions require a node
        if (!node)
            return conflict(e, TX.tx("It does not exist"));

        switch (e.type) {
        case "M": // Move to another parent
            // e.data is the path of the new parent
            var new_parent = this.locate_node(e.data);
            if (!new_parent)
                return conflict(TX.tx("New folder '$1' does not exist",
                    e.data.join("↘")));

            new_parent.time = parent.time = e.time; // collection is being modified
            delete parent.data[name];
            new_parent.data[name] = node;
            break;

        case "D": // Delete
            delete parent.data[name];
            parent.time = e.time; // collection is being modified
            break;

        case "R": // Rename
            if (parent.data[e.data])
                return conflict(e, " '" + e.data + "': " +
                    TX.tx("It already exists"));
            parent.data[e.data] = node;
            delete parent.data[name];
            parent.time = e.time; // collection is being modified, node is not
            break;

        case "E": // Edit
            node.data = e.data;
            node.time = e.time;
            break;

        case "A": // Alarm
            if (!e.data)
                delete node.alarm;
            else
                node.alarm = e.data;
            node.time = e.time;
            break;

        case "C": // Cancel alarm
            if (!node)
                return conflict(e, TX.tx("It does not exist"));
            delete node.alarm;
            node.time = e.time;
            break;

        case "X": // Constrain. Introduced in 2.0, however 1.0 code
            // will simply ignore this action.
            if (!node)
                return conflict(e, TX.tx("It does not exist"));
            if (!e.data)
                delete node.constraints;
            else
                node.constraints = e.data;
            node.time = e.time;
            break;

        default:
            // Unrecognised action type (may be due to a version incompatibility?)
            if (global.DEBUG) debugger;
        }
    }

    if (listener)
        listener.call(this, e);

    return null;
};

/**
 * @private
 * Method to reconstruct an action stream from a node and its children.
 * @param data root node of tree to reconstruct from
 * @param path path array
 * @param {function} reconstruct
 * reconstruct.call(this:Hoard, action:Action, follow:Function)
 * on each reconstructed action.
 * @param {function} progress optional, called with %age
 * @param {function} chain optional chain()
 */
Hoard.prototype._reconstruct_actions = function (data, path, reconstruct, progress, chain) {
    "use strict";

    var self = this;
    var queue = [];

    // Handle a node
    function handle_node(node, p, ready) {
        if (p.length === 0) {
            // No action for the root
            ready();
            return;
        }
        var time = (typeof node.time !== "undefined" ? node.time : Date.now());
        var action = {
            type: "N",
            path: p,
            time: time
        };

        if (typeof node.data === "string")
            action.data = node.data;
        else if (global.DEBUG && typeof node.data === "undefined")
            debugger;

        // Execute the 'N'
        reconstruct.call(
            self,
            action,
            function () {
                // The 'N' has been completed so the factory has the
                // node. We can now reconstruct 'A' and 'X' actoins on
                // it.
                if (node.alarm) {
                    reconstruct.call(
                        self, {
                            type: "A",
                            // slice to avoid re-use of the same object
                            path: p.slice(),
                            time: time,
                            data: node.alarm
                        });
                }
                if (node.constraints) {
                    reconstruct.call(
                        self, {
                            type: "X",
                            // slice to avoid re-use of the same object
                            path: p.slice(),
                            time: time,
                            data: node.constraints
                        });
                }
                ready();
            });
    }

    var count, counter;

    // Recursively build a list of all nodes, starting at the root
    function list_nodes(q, node, pat) {
        var key, p;
        q.push(function (ready) {
            handle_node(node, pat, ready);
            if (progress)
                progress(Math.floor(100 * (counter++) / count));
        });
        if (typeof node.data === "object") {
            for (key in node.data) {
                p = pat.slice();
                p.push(key);
                list_nodes(q, node.data[key], p);
            }
        }
    }

    // Build a queue of functions to call
    list_nodes(queue, data, path.slice());
    count = queue.length;
    counter = 0;

    // Add the chain to the end of the queue
    if (chain)
        queue.push(function (ready) {
            chain();
            ready();
        });
    // And execute the queue
    Utils.execute_queue(queue);
};

/**
 * Reconstruct an action stream (which will all be 'N', 'A' and 'X' actions)
 * from a data block. Does not (directly) affect the actions stored in
 * the hoard (though the listener might).
 * @param data data structure, a simple hierarchical structure
 * of keys and the data they contain e.g.
 * { "key1" : { data: { subkey1: { data: "string data" } } } }
 * Other fields (such as time) may be present and are used if they are.
 * @param {function} reconstruct function to call on each action as it
 * is constructed. reconstruct.call(this:Hoard, action:Action, follow:Function)
 * @param {function} progress optional called with percent
 * @param {function} chain callback invoked when all actions have been
 * constructed. chain()
 */
Hoard.prototype.actions_from_hierarchy = function (data, reconstruct, progress, chain) {
    "use strict";

    this._reconstruct_actions(data, [], reconstruct, progress, chain);
};

/**
 * Reconstruct an action stream from the cache in the hoard. Assumes that
 * all actions in the hoard have already been played into the cache.
 * This method doubles as a way to simplify a hoard, as the action set
 * will be pared down to just those actions that are required to recreate
 * the cache.
 * @param {function} reconstruct function to call on each action as it
 * is constructed. reconstruct.call(this:Hoard, action:Action, follow:Function)
 * @param {function} progress optional, called with a %age
 * @param {function} chain callback invoked when all actions have been
 * constructed. chain()
 */
Hoard.prototype.reconstruct_actions = function (reconstruct, progress, chain) {
    "use strict";

    if (this.cache) {
        this._reconstruct_actions(this.cache, [], reconstruct, progress, chain);
    } else {
        // No cache => no actions
        chain();
    }
};

/**
 * Promise to add the actions that are timestamped since the last sync into
 * this hoard. Updates the sync time to now.
 * Actions are *not* appended to our local actions stream, they are simply
 * played into the cache.
 * @param {Hoard} cloud the cloud hoard
 * @param {function} listener called whenever an action is played
 * listener.call(this:Hoard, e:Action)
 * @param {function} progress optional listener called with a percentage
 * completion
 * @return a list of conflicts.
 */
Hoard.prototype.play_actions = function (new_actions, listener, progress) {
    "use strict";

    var conflicts = [];

    var i, c;

    // Play in all actions since the last sync
    var count = new_actions.length;
    for (i = 0; i < count; i++) {
        if (new_actions[i].time > this.last_sync) {
            if (global.DEBUG) console.log(
                "Play " + Hoard.stringify_action(new_actions[i]));
            c = this.play_action(new_actions[i], listener);
            if (c) {
                if (global.DEBUG) console.log("Conflict: " + c.message);
                conflicts.push(c);
            }
        } else if (global.DEBUG) console.log(
            "Skip old " + Hoard.stringify_action(new_actions[i]));
        if (progress)
            progress(Math.floor(100 * i / count));
    }

    this.last_sync = Date.now();

    return conflicts;
};

/**
 * Return the cache node identified by the path.
 * @param path array of path elements, root first
 * @return a cache node, or null if not found.
 */
Hoard.prototype.get_node = function (path) {
    "use strict";

    var node = this.cache,
        i;
    for (i = 0; i < path.length; i++) {
        if (typeof node.data === "string")
            return null;
        node = node.data[path[i]];
    }
    return node;
};

/**
 * @private
 */
Hoard.prototype.each_alarm = function () {
    "use strict";

    var self = this,
        alarum = function () {
            self.each_alarm();
        };

    while (this.check && this.check.queue.length > 0) {
        var item = this.check.queue.pop(),
            node = item.node,
            name;

        if (typeof node.data === "object")
            for (name in node.data) {
                var snode = node.data[name];
                this.check.queue.push({
                    node: snode,
                    path: item.path.slice()
                        .concat([name])
                });
            }

        if (typeof node.alarm !== "undefined" &&
            (Date.now() - node.time) >= (node.alarm * Utils.MSPERDAY)) {
            this.check.alarm(
                item.path,
                new Date(node.time + node.alarm * Utils.MSPERDAY),
                alarum);
            return;
        }
    }
    delete this.check;
};

/**
 * Check alarms, calling callback on all alarms that have fired
 */
Hoard.prototype.check_alarms = function (callback) {
    "use strict";

    if (!this.cache)
        return;
    this.check = {
        queue: [{
            path: [],
            node: this.cache
        }],
        alarm: callback
    };
    this.each_alarm();
};

/**
 * Generate a JSON dump of the tree. Dumps the children of the root
 * node as a map.
 * @return a string containing a formatted JSON dump
 */
Hoard.prototype.JSON = function () {
    "use strict";

    var data = "";
    if (this.cache)
        data = JSON.stringify(this.cache.data, null, "\t");
    return data;
};

if (typeof module !== "undefined")
    module.exports = Hoard;