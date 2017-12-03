/*@preserve Copyright (C) 2015 Crawford Currie http://c-dot.co.uk license MIT*/

/* global DEBUG:true */
/* global TX */
/* global Utils */

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
        return { conflict: e, message: mess };
    }

    var parent = locateParent(e.path, this.cache);
    if (!parent) {
        if (this.cache) {
            return c("'" + e.path.join("/") + "' "
                     + TX.tx("parent not found"));
        } else {
            parent = this.cache = { data: {} };
        }
    }

    var name = e.path[e.path.length - 1];
    var node = parent.data[name];

    switch (e.type) {
    case "N": // New
        if (node)
            return c(TX.tx("Cannot create, '$1' already exists",
                           e.path.join("/")));
        parent.time = e.time; // collection is being modified
        parent.data[name] = {
            time: e.time,
            data: (typeof e.data === "string") ?
                e.data : {}
        };
        break;

    case "M": // Move
        if (!node) {
            return c(TX.tx("Cannot move, '$1' does not exist",
                           e.path.join("/")));
        }

        // e.data is the path of the new parent
        if (e.data.length > 0) {
            var npp = locateParent(e.data, this.cache), new_parent;
            if (npp)
                new_parent = npp.data[e.data[e.data.length - 1]];
        }
        else
            new_parent = this.cache; // root
        
        if (!new_parent)
            return c("Cannot move, '" + e.data.join("/") + "' "
                     + TX.tx("does not exist"));

        new_parent.time = parent.time = e.time; // collection is being modified
        delete parent.data[name];
        new_parent.data[name] = node;
        break;

    case "D": // Delete
        if (!node)
            return c(TX.tx("Cannot delete, '$1' does not exist",
                           e.path.join("/")));
        delete parent.data[name];
        parent.time = e.time; // collection is being modified
        break;

    case "R": // Rename
        if (!parent.data[name])
            return c(TX.tx("Cannot rename, '$1' does not exist",
                          e.path.join("/")));
        if (parent.data[e.data])
            return c(TX.tx("Cannot rename '$1', '$2' already exists",
                           e.path.join("/"), e.data));
        parent.data[e.data] = parent.data[name];
        delete parent.data[name];
        parent.time = e.time; // collection is being modified
        break;

    case "E": // Edit
        if (!parent.data[name])
            return c(TX.tx("Cannot change value, '$1' does not exist",
                           e.path.join("/")));
        parent.data[name].data = e.data;
        parent.data[name].time = e.time;
        break;

    case "A": // Alarm
        if (!parent.data[name])
            return c(TX.tx("Cannot set reminder, '$1' does not exist",
                           e.path.join("/")));
        parent.data[name].alarm = e.data;
        break;

    case "C": // Cancel alarm
        if (!parent.data[name])
            return c(TX.tx("Cannot cancel reminder, '$1' does not exist",
                           e.path.join("/")));
        delete parent.data[name].alarm;
        break;

    default:
        // Internal error unrecognised action type
        if (DEBUG) debugger;
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
            if (DEBUG && er !== null) debugger;
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

    var self = this;
    var queue = [];

    // Handle a node
    var handle_node = function(node, p, ready) {
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

        // slice this time, to avoid re-use of the same object
        // in alarms
        var pal = p.slice();
        listener.call(
            self,
            action,
            function() {
                if (node.alarm) {
                    listener.call(
                        self,
                        {
                            type: "A", 
                            path: pal,
                            time: time,
                            data: node.alarm
                        });
                }
                ready();
            });
    };

    // Recursively build a list of all nodes, starting at the root
    var list_nodes = function(q, node, pat) {
        var key, p;
        q.push(function(ready) {
            handle_node(node, pat, ready);
        });
        if (typeof node.data === "object") {
            for (key in node.data) {
                p = pat.slice();
                p.push(key);
                list_nodes(q, node.data[key], p);
            }
        }
    };

    list_nodes(queue, data, path.slice());
    queue.push(chain);
    Utils.execute_queue(queue);
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
            if (DEBUG) console.debug(
                "Merge " + Hoard.stringify_action(cloud.actions[i]));
            c = this.record_action(cloud.actions[i], listener, true);
            if (c !== null) {
                if (DEBUG) console.debug("Conflict: " + c.message);
                conflicts.push(c);
            }
        }
        else if (DEBUG) {
            console.debug(
                "Skip " + Hoard.stringify_action(cloud.actions[i]));
        }
    }

    // Restore the saved actions list
    this.actions = local_actions;
    this.last_sync = Date.now();
    if (chain)
        chain(conflicts);
};

/**
 * Return a dump of the current state of the hoard.
 * @return a string with the JSON of the cache, and a list of the actions.
 */
Hoard.prototype.dump = function() {
    "use strict";

    var data = this.JSON() + "\n"; // get the cache
    for (var i = 0; i < this.actions.length; i++) {
        data = data + Hoard.stringify_action(this.actions[i]) + "\n";
    }
    return data;
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

/**
* @private
*/
Hoard.prototype.each_alarm = function() {
    "use strict";

    var self = this,
    alarum = function() {
        self.each_alarm();
    };

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
            }

        if (typeof node.alarm !== "undefined"
            && (Date.now() - node.time) >= (node.alarm * Utils.MSPERDAY)) {
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
Hoard.prototype.check_alarms = function(callback) {
    "use strict";

    if (!this.cache)
        return;
    this.check = {
        queue: [ { path: [], node: this.cache } ],
        alarm: callback
    };
    this.each_alarm();
};

/**
 * Generate a JSON dump of the cache.
 * @return a string containing a formatted JSON dump
 */
Hoard.prototype.JSON = function() {
    "use strict";

    var data = "";
    if (this.cache)
        data = JSON.stringify(this.cache.data, null, "\t");
    return data;
};
