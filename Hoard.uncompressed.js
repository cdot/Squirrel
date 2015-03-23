/* Copyright (C) 2015 Crawford Currie http://c-dot.co.uk / MIT */

/**
 * A combined hierarchical data store with change log, designed to be
 * used in a client-cloud topology where a single cloud hoard is synched
 * with multiple client stores, each of which may change asynchronously.
 *
 * On the client side, the hoard contains a cache that represents
 * the current data in the hoard. Then it has a list of
 * actions that record the list of actions performed on the cache since the
 * last sync. These changes are already reflected in the cache, but are kept
 * until the hoard is synched with the cloud hoard.
 * 
 * In the cloud hoard the cache is maintained empty, and the list of actions
 * represents all changes since the hoard was established. These can be
 * replayed in full to regenerate the cache, though this is a time-consuming
 * business. At any time the hoard can be optimised - basically blowing away
 * all the history. This should only be done if you are sure all clients are
 * up-to-date.
 *
 * @typedef Action
 * @type {object}
 * @property {string} type - single character type
 * @property {string[]} path - node path
 * @property {Object} data - optional data object
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

/**
 * Create a new Hoard
 * @class
 * @member {Data} cache root of the data structure
 * @member {Action[]} actions actions played since the last sync
 * @member {number} last_sync integer date since the last sync, or null
 */
function Hoard(data) {
    "use strict";

    if (data) {
        this.last_sync = data.last_sync;
        this.actions = data.actions;
        this.cache = data.cache;
        this.options = data.options;
    } else {
        this.last_sync = null;
        this.clear_actions();
        this.cache = null;
    }
    if (typeof this.options === "undefined")
        this.options = {
            // autosave exists in both the client and cloud stores, but
            // is only read from the client - it is never read
            // from the cloud. This is so that (for example) a tablet
            // doesn't get the option when it spends most of its time
            // disconnected.
            autosave: true
        };
}

Hoard.stringify_action = function(action) {
    "use strict";

    return action.type + ":"
        + action.path.join("/")
        + (typeof action.data !== "undefined" ?
           (" '" + action.data + "'") : "")
        + " @" + new Date(action.time).toLocaleString();
};


/**
 * Clear down the actions in the hoard. The cache is left untouched.
 * This is used when the client hoard has been synched with the cloud
 * and the local actions list is no longer needed.
 */
Hoard.prototype.clear_actions = function() {
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
 * <li>'R' rename node, data contains new name</li>
 * </ul>
 * Returns a conflict object if there was an error. This has two fields,
 * 'action' for the action record and 'message'.
 * @param {Action} e the action record
 * @param {Listener} [listener] called when the action is played
 * @param no_push {boolean} if true, don't push played actions onto the
 * action stream
 * @return {Conflict} conflict object, or null if there was no conflict
 */
Hoard.prototype.record_action = function(e, listener, no_push) {
    "use strict";

    var parent, name, node, i, c;

    if (typeof e.time === "undefined" || e.time === null) {
        e.time = Date.now();
    }

    if (!no_push)
        this.actions.push(e);

    // Update the cache; the listener will only be called if this
    // succeeds
    parent = this.cache;
    for (i = 0; i < e.path.length - 1; i++) {
        name = e.path[i];
        if (parent && typeof parent.data === "string") {
            throw "Internal error: Cannot " + e.type + " over leaf node";
        } else if (parent && parent.data[name]) {
            parent = parent.data[name];
        } else {
            return { action: e, message:
                     "'" + e.path.slice(0, i + 1).join("/") + "' "
                     + TX.tx("does not exist") };
        }
    }
    name = e.path[i];

    if (!parent) {
        parent = this.cache = { data: {} };
    }

    c = function(mess) {
        return { action: e, message: mess };
    };

    switch (e.type) {
    case "N": // New
        if (parent.data[name])
            return c(TX.tx("Cannot create, '$1' already exists", name));
        parent.time = e.time; // collection is being modified
        parent.data[name] = {
            time: e.time,
            data: (typeof e.data === "string") ?
                e.data : {}
        };
        break;

    case "D": // Delete
        if (!parent.data[name])
            return c(TX.tx("Cannot delete, '$1' does not exist", name));
        delete parent.data[name];
        break;

    case "R": // Rename
        if (!parent.data[name])
            return c(TX.tx("Cannot rename, '$1' does not exist", name));
        if (parent.data[e.data])
            return c(TX.tx("Cannot rename, '$1' already exists",
                           e.data));
        parent.data[e.data] = parent.data[name];
        delete parent.data[name];
        break;

    case "E": // Edit
        if (!parent.data[name])
            return c(TX.tx("Cannot change value, '$1' does not exist", name));
        parent.data[name].data = e.data;
        break;

    case "A": // Alarm
        if (!parent.data[name])
            return c(TX.tx("Cannot set reminder, '$1' does not exist", name));
        parent.data[name].alarm = e.data;
        break;

    case "C": // Cancel alarm
        if (!parent.data[name])
            return c(TX.tx("Cannot cancel reminder, '$1' does not exist", name));
        delete parent.data[name].alarm;
        break;

    default:
        // Internal error
        throw "Internal error: Unrecognised action type '" + e.type + "'";
    }

    if (listener)
        listener.call(this, e);

    return null;
};

/**
 * Simplify the action stream in the hoard by eliminating all but "N" actions.
 * Set node change times according to the most recent change.
 * Designed to be used on the cloud hoard, this will result in an empty
 * cache and simplified action stream. Note that this will destroy the
 * cache.
 */
Hoard.prototype.simplify = function(chain) {
    "use strict";

    // First reconstruct the cache by playing all the actions
    this.cache = null;
    if (this.actions) {
        for (var i = 0; i < this.actions.length; i++) {
            // Play the action with no push and no listener
            var er = this.record_action(this.actions[i], false, true);
            if (er !== null)
                throw "Disaster! " + er.message;
        }
    }

    // Now reconstruct the action stream from the simplified cache
    this.actions = [];
    if (this.cache) {
        this._reconstruct_actions(
            this.cache.data, [], function(e) {
                this.actions.push({
                    type: e.type,
                    time: e.time,
                    data: e.data,
                    path: e.path.slice()
                });
            },
            chain);
        this.cache = null;
    } else if (chain)
        chain();
};

/**
 * @private method to reconstruct an action stream from a node and it's
 * subtree. Relies on the listener to call the next function.
 */
Hoard.prototype._reconstruct_actions = function(data, path, listener, chain) {
    "use strict";
    var context, node, path, key, self = this, p, time,

    list_nodes = function(node, path) {
        self.reconstruct.queue.push({
            node: node,
            path: path });

        if (typeof node.data === "object") {
            for (key in node.data) {
                p = path.slice();
                p.push(key);
                list_nodes(node.data[key], p);
            }
        }
    },

    next_node = function() {
        if (!self.reconstruct)
            return;

        if (self.reconstruct.queue.length === 0) {
            var ch = self.reconstruct.chain;
            delete self.reconstruct;
            if (typeof ch !== "undefined")
                ch();
            return;
        }

        context = self.reconstruct.queue.shift();
        node = context.node;
        path = context.path;
        time = (typeof node.time !== "undefined" ? node.time : Date.now());

        if (typeof node.data === "string") {
            self.reconstruct.listener.call(
                self,
                {
                    type: "N", 
                    path: path.slice(),
                    time: time,
                    data: node.data
                },
                function() {
                    if (node.alarm) {
                        self.reconstruct.listener.call(
                            self,
                            {
                                type: "A", 
                                path: path.slice(),
                                time: time,
                                data: node.alarm
                            },
                            next_node);
                    } else
                        next_node();
                });
            return;
        } else if (typeof node.data !== "undefined") {
            if (path.length > 0) {
                // No action for the root
                self.reconstruct.listener.call(
                    self,
                    {
                        type: "N", 
                        time: time,
                        path: path.slice()
                    },
                    next_node);
            } else
                next_node();
        } else {
            if (DEBUG) debugger;
            throw "Internal error";
        }        
    };

    this.reconstruct = {
        queue: [],
        listener: listener,
        chain: chain
    };

    list_nodes(data, path);
    next_node();
};

/**
 * Reconstruct an action stream (which will all be 'N' actions) from
 * a data block. Does not (directly) affect the actions stored in
 * the hoard (though the listener might).
 * @param data data structure, a simple hierarchical structure
 * of keys and the data they contain e.g.
 * { "key1" : { data: { subkey1: { data: "string data" } } } }
 * Other fields (such as time) may be present and are used if they are.
 * @param {Listener} [listener] callback that takes an action, and a
 * function that must be called once the action has been applied. Note that
 * the listener can do what it likes with the action it is passed, and
 * the function need not be called immediately.
 * @param chain callback invoked when all actions have been constructed
 * (no parameters, no this)
 */
Hoard.prototype.actions_from_hierarchy = function(data, listener, chain) {
    "use strict";

    this._reconstruct_actions(data, [], listener, chain);
};

/**
 * Reconstruct an action stream from the cache in the hoard. This is
 * used to generate the UI tree from a stored cache. 
 * @param {Listener} [listener] callback that takes an action, and a
 * function that must be called once the action has been applied. Note that
 * the listener can do what it likes with the action it is passed, and
 * the function need not be called immediately.
 * @param chain callback invoked when all actions have been constructed
 * (no parameters, no this)
 */
Hoard.prototype.reconstruct_actions = function(listener, chain) {
    "use strict";

    if (this.cache) {
        this.actions_from_hierarchy(this.cache, listener, chain);
    } else {
        chain();
    }
};

/**
 * Merge the cloud actions since the last sync into this hoard.
 * Actions are *not* appended to our local actions stream.
 * @param {Hoard} cloud the cloud hoard
 * @param {Listener} [listener] called whenever an action is played
 * @param {Object[]} conflicts, as returned by record_action, if there are any
 * @param chain function to call once all merged. Passed a list of conflicts.
 */
Hoard.prototype.merge_from_cloud = function(cloud, listener, chain) {
    "use strict";

    var i, c,
    // Save the local action stream
    local_actions = this.actions,
    conflicts = [];

    // Play in all cloud actions since the last sync
    this.actions = [];
    for (i = 0; i < cloud.actions.length; i++) {
        if (cloud.actions[i].time > this.last_sync) {
            //if (DEBUG) console.debug("Merge " + Hoard.stringify_action(cloud.actions[i]));
            c = this.record_action(cloud.actions[i], listener, true);
            if (c !== null)
                conflicts.push(c);
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
 * @return a cache node, or null if not found.
 */
Hoard.prototype.get_node = function(path) {
    "use strict";

    var node = this.cache, i;
    for (i = 0; i < path.length; i++) {
        if (typeof node.data === "string")
            return null;
        node = node.data[path[i]];
    }
    return node;
};

// Milliseconds in a day
const MSDAY = 24 * 60 * 60 * 1000;

/**
* @private
*/
Hoard.prototype.each_alarm = function() {
    var self = this;

    while (this.check && this.check.queue.length > 0) {
        var item = this.check.queue.pop(),
        node = item.node, name;

        if (typeof node.data === "object")
            for (name in node.data) {
                var snode = node.data[name];
                this.check.queue.push({
                    node: snode,
                    path: item.path.slice().concat([ name ])
                });
            };

        if (typeof node.alarm !== "undefined"
            && (Date.now() - node.time) >= (node.alarm * MSDAY)) {
            this.check.alarm(
                item.path,
                new Date(node.time + node.alarm * MSDAY),
                function() {
                    self.each_alarm();
                });
            return;
        }
    }
    delete this.check;
}

/**
 * Check alarms, calling callback on all alarms that have fired
 */
Hoard.prototype.check_alarms = function(callback) {
    if (!this.cache)
        return;
    this.check = {
        queue: [ { path: [], node: this.cache } ],
        alarm: callback
    };
    this.each_alarm();
};
