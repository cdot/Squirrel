/*@preserve Copyright (C) 2015 Crawford Currie http://c-dot.co.uk license MIT*/

/* global DEBUG:true */
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

var DEBUG = true;

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
            // options exist in both the client and cloud stores, but
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

if (DEBUG) {
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
 * Play a single action into the hoard. The cache is updated, and
 * the action added to the action stream ready for the next synch.
 * Apply the given action type:
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
 * @param {function} listener called when the action is played.
 * listener.call(this:Hoard, e:Action)
 * @param no_push {boolean} if true, don't push played actions onto the
 * action stream
 * @return {Conflict} conflict object, or null if there was no conflict
 */
Hoard.prototype.record_action = function (e, listener, no_push) {
    "use strict";

    if (typeof e.time === "undefined" || e.time === null)
        e.time = Date.now();

    if (!no_push)
        this.actions.push({
            type: e.type,
            path: e.path.slice(),
            time: e.time,
            data: e.data
        });

    function locateParent(path, node) {
        // Locate the parent in the cache
        for (var i = 0; i < path.length - 1; i++) {
            var name = path[i];
            if (node && typeof node.data === "string") {
                // "Cannot " + e.type + " over leaf node";
                if (DEBUG) debugger;
            } else if (node && node.data[name]) {
                node = node.data[name];
            } else {
                return undefined;
            }
        }
        // Should now be positioned one above the end of the path
        return node;
    }

    function c(mess) {
        return {
            conflict: e,
            message: mess
        };
    }

    var parent = locateParent(e.path, this.cache);
    if (!parent && !this.cache)
        parent = this.cache = {
            data: {}
        };

    var name = e.path[e.path.length - 1];
    var node = parent.data[name];

    switch (e.type) {
    case "N": // New
        if (!parent)
            return c(TX.tx("Cannot create") +
                " '" + e.path.join("↘") + "': " +
                TX.tx("Folder not found"));
        if (node)
            return c(TX.tx("Cannot create") +
                " '" + e.path.join("↘") + "': " +
                TX.tx("It already exists"));
        parent.time = e.time; // collection is being modified
        parent.data[name] = {
            time: e.time,
            data: (typeof e.data === "string") ?
                e.data : {}
        };
        break;

    case "M": // Move
        if (!node)
            return c(TX.tx("Cannot move") +
                " '" + e.path.join("↘") + "': " +
                TX.tx("It does not exist"));

        // e.data is the path of the new parent
        if (e.data.length > 0) {
            var npp = locateParent(e.data, this.cache),
                new_parent;
            if (npp)
                new_parent = npp.data[e.data[e.data.length - 1]];
        } else
            new_parent = this.cache; // root

        if (!new_parent)
            return c(TX.tx("Cannot move") +
                " '" + e.data.join("↘") + "': " +
                TX.tx("New folder does not exist"));

        new_parent.time = parent.time = e.time; // collection is being modified
        delete parent.data[name];
        new_parent.data[name] = node;
        break;

    case "D": // Delete
        if (!node)
            return c(TX.tx("Cannot delete") +
                " '" + e.path.join("↘") + "': " +
                TX.tx("It does not exist"));
        if (!parent)
            return c(TX.tx("Cannot delete") +
                " '" + e.path.join("↘") + "': " +
                TX.tx("Folder not found"));
        delete parent.data[name];
        parent.time = e.time; // collection is being modified
        break;

    case "R": // Rename
        if (!parent.data[name])
            return c(TX.tx("Cannot rename") +
                " '" + e.path.join("↘") + "' " +
                TX.tx("It does not exist"));
        if (parent.data[e.data])
            return c(TX.tx("Cannot rename") +
                " '" + e.path.join("↘") + "' -> '" + e.data + "': " +
                TX.tx("It already exists"));
        parent.data[e.data] = parent.data[name];
        delete parent.data[name];
        parent.time = e.time; // collection is being modified
        break;

    case "E": // Edit
        if (!parent.data[name])
            return c(TX.tx("Cannot change value of") +
                " '" + e.path.join("↘") + "': " +
                TX.tx("It does not exist"));
        parent.data[name].data = e.data;
        parent.data[name].time = e.time;
        break;

    case "A": // Alarm
        if (!parent.data[name])
            return c(TX.tx("Cannot set reminder on") +
                " '" + e.path.join("↘") + "': " +
                TX.tx("It does not exist"));
        if (!e.data)
            delete parent.data[name].alarm;
        else
            parent.data[name].alarm = e.data;
        parent.data[name].time = e.time;
        break;

    case "C": // Cancel alarm
        if (!parent.data[name])
            return c(TX.tx("Cannot cancel reminder on") +
                " '" + e.path.join("↘") + "': " +
                TX.tx("It does not exist"));
        delete parent.data[name].alarm;
        parent.data[name].time = e.time;
        break;

    case "X": // Constrain. Introduced in 2.0, however 1.0 code
        // will simply ignore this action.
        if (!parent.data[name])
            return c(TX.tx("Cannot constrain") +
                " '" + e.path.join("↘") + "': " +
                TX.tx("It does not exist"));
        if (!e.data)
            delete parent.data[name].constraints;
        else
            parent.data[name].constraints = e.data;
        parent.data[name].time = e.time;
        break;

    default:
        // Unrecognised action type (may be due to a version incompatibility?)
        if (DEBUG) debugger;
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
        else if (DEBUG && typeof node.data === "undefined")
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
 * Merge the cloud actions since the last sync into this hoard.
 * Actions are *not* appended to our local actions stream.
 * @param {Hoard} cloud the cloud hoard
 * @param {function} listener called whenever an action is played
 * listener.call(this:Hoard, e:Action)
 * @param {function} progress optional listener called with a percentage
 * completion
 * @param optinal chain function to call once all merged. Passed a list of conflicts.
 */
Hoard.prototype.merge_from_cloud = function (cloud, listener, progress, chain) {
    "use strict";

    if (cloud.actions.length > 0) {
        var i, c,
            // Save the local action stream
            local_actions = this.actions,
            conflicts = [];

        // Play in all cloud actions since the last sync
        this.actions = [];
        var count = cloud.actions.length;
        for (i = 0; i < count; i++) {
            if (cloud.actions[i].time > this.last_sync) {
                if (DEBUG) console.log(
                    "Merge " + Hoard.stringify_action(cloud.actions[i]));
                c = this.record_action(cloud.actions[i], listener, true);
                if (c !== null) {
                    if (DEBUG) console.log("Conflict: " + c.message);
                    conflicts.push(c);
                }
            } else if (DEBUG) console.log(
                "Skip old " + Hoard.stringify_action(cloud.actions[i]));
            if (progress)
                progress(Math.floor(100 * i / count));
        }
    }

    // Restore the saved actions list
    this.actions = local_actions;

    this.last_sync = Date.now();
    if (chain)
        chain(conflicts);
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
