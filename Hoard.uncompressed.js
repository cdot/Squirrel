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
    } else {
        this.last_sync = null;
        this.clear_actions();
        this.cache = null;
    }
}

/**
 * Clear down the actions in the hoard. The cache is left untouched.
 * This is used when the client hoard has been synched with the cloud
 * and the local actions list is no longer needed.
 */
Hoard.prototype.clear_actions = function() {
    "use strict";

    this.actions = [];
};

Hoard.prototype.is_modified = function() {
    "use strict";

    return this.actions.length > 0;
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
Hoard.prototype.play_action = function(e, listener, no_push) {
    "use strict";

    var parent, name, i;

    if (typeof e.time === "undefined" || e.time === null) {
        e.time = new Date().valueOf();
    }

    if (!no_push) {
        this.actions.push(e);
    }

    // Update the cache; the listener will only be called if this
    // succeeds
    parent = this.cache;
    for (i = 0; i < e.path.length - 1; i++) {
        name = e.path[i];
        if (parent && typeof parent.data === "string") {
            throw "Cannot play action over leaf node";
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

    if (e.type === "N") {
        if (parent.data[name]) {
            return { action: e, message: TX.tx("Cannot create, already exists") };
        }
        parent.time = e.time; // collection is being modified
        parent.data[name] = {
            time: e.time,
            data: (typeof e.data === "string") ?
                e.data : {}
        };
    } else if (e.type === "D") {
        if (!parent.data[name]) {
            return { action: e, message: TX.tx("Cannot delete, does not exist") };
        }
        delete parent.data[name];
    } else if (e.type === "R") {
        if (!parent.data[name]) {
            return { action: e, message: TX.tx("Cannot rename, does not exist") };
        }
        parent.data[e.data] = parent.data[name];
        delete parent.data[name];
    } else if (e.type === "E") {
        if (!parent.data[name]) {
            return { action: e, message: TX.tx("Cannot change value, does not exist") };
        }
        parent.data[name].data = e.data;
    } else {
        throw "Unrecognised action type '" + e.type + "'";
    }

    if (listener) {
        listener.call(this, e);
    }

    return null;
};

/**
 * Simplify the action stream in the hoard by eliminating all but "N" actions.
 * Set node change times according to the most recent change.
 * Designed to be used on the cloud hoard, this will result in an empty
 * cache and simplified action stream. Note that this will destroy the
 * cache.
 */
Hoard.prototype.simplify = function() {
    "use strict";

    // First reconstruct the cache by playing all the actions
    this.cache = null;
    if (this.actions) {
        for (var i = 0; i < this.actions.length; i++) {
            // Play the action with no push and no listener
            var er = this.play_action(this.actions[i], false, true);
            if (er !== null) {
                throw "Disaster! " + er.message;
            }
        }
    }

    // Now reconstruct the action stream from the simplified cache
    this.actions = [];
    if (this.cache) {
        this._reconstruct_actions(this.cache, [], function(e) {
            this.actions.push({
                type: e.type,
                time: e.time,
                data: e.data,
                path: e.path.slice()
            });
        });
        this.cache = null;
    }
};

/**
 * @private method to reconstruct an action stream from a node and it's
 * subtree
 */
Hoard.prototype._reconstruct_actions = function(node, path, listener) {
    "use strict";
    var key;

    if (typeof node.data === "string") {
        listener.call(this, {
            type: "N", 
            path: path.slice(),
            time: node.time,
            data: node.data
        });
    } else if (typeof node.data !== "undefined") {
        if (path.length > 0) {
            // No action for the root
            listener.call(this, {
                type: "N", 
                time: node.time,
                path: path.slice()
            });
        }

        for (key in node.data) {
            path.push(key);
            this._reconstruct_actions(node.data[key], path, listener);
            path.pop();
        }
    } else {
        throw "Internal error";
    }
};

/**
 * Reconstruct an action stream (which will all be 'N' actions) from
 * the cache in the hoard. This is used to generate the UI tree from
 * a stored cache. Does not (directly) affect the actions stored in
 * the hoard (though the listener might).
 * @param listener {Listener} callback that takes an action. Note that
 * the listener can do what it likes with the action it is passed.
 */
Hoard.prototype.reconstruct_actions = function(listener) {
    "use strict";

    if (this.cache) {
        this._reconstruct_actions(this.cache, [], listener);
    }
};

/**
 * Merge the cloud actions since the last sync into this hoard.
 * Actions are *not* appended to our local actions stream.
 * @param {Hoard} cloud the cloud hoard
 * @param {Listener} [listener] called whenever an action is played
 * @param {Object[]} conflicts, as returned by play_action, if there are any
 */
Hoard.prototype.merge_from_cloud = function(cloud, listener, conflicts) {
    "use strict";

    var i, c,
    // Save the local action stream
    local_actions = this.actions;

    // Play in all cloud actions since the last sync
    this.actions = [];
    for (i = 0; i < cloud.actions.length; i++) {
        if (cloud.actions[i].time > this.last_sync) {
            c = this.play_action(cloud.actions[i], listener);
            if (c !== null) {
                conflicts.push(c);
            }
        }
    }

    // Restore the saved actions list
    this.actions = local_actions;
    this.last_sync = new Date().valueOf();
};
