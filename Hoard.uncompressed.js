/**
 * A hierarchical data store, designed to be synched with another
 * store on a time basis.
 *
 * A hoard consists of two types of data. First, a cache that represents
 * the current state of the data in the hoard. Second, a list of Actions
 * that record the changes to the hoard since the time of the last
 * sync.
 *
 * The cache may be null, in which case the state of the data is entirely
 * represented by the Actions. These can be replayed at any time to
 * regenerate and empty cache. If the cache is non-null, the actions record
 * the changes that have been made since the last sync. In this case the
 * actions are assumed to have already been played into the cache.
 *
 * The basic idea is that the central shared hoard is represented using
 * a times stream of actions that can be replayed from any point to regenerate
 * the cache. The client has a local hoard that uses a cache, and records
 * actions since the last sync so that they can be merged with the stream
 * of actions in the shared hoard.
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
        this.cache = data.cache;
        this.actions = data.actions;
        this.last_sync = data.last_sync;
    } else {
        this.empty();
    }
}

/**
 * Clear down the hoard.
 */
Hoard.prototype.empty = function() {
    "use strict";

    this.last_sync = null;
    this.actions = [];
    this.cache = { data: {} };
};

/*
// EVENT ENCODING - not used

// Characters used in action encoding. Characters in the range
// [\x00-\x07\x08-\x1F] are not permitted in paths.
const EVENT_SEP  = String.fromCharCode(10); // end of action
const FIELD_SEP  = String.fromCharCode(3);
const PATH_SEP   = String.fromCharCode(4);
const BLOCK_SEP  = String.fromCharCode(5);

// Decode an action string to a structure
Hoard.prototype._decode_action = function(action) {
    "use strict";

    var fields = action.substring(1).split(FIELD_SEP);
    var datum = {
        type: action.charAt(0),
        time: new Date().valueOf(),
        path: fields[1].split(PATH_SEP),
    };
    datum.time.setTime(fields[0]);
    if (fields.length > 2)
        datum.data = fields[2];
    return datum;
};

// Encode an action structure as a string
Hoard.prototype._encode_action = function(action) {
    "use strict";

    if (!action.time)
        action.time = new Date().valueOf();
    var e =  action.type
        + action.time.getTime() + FIELD_SEP
        + action.path.join(PATH_SEP);
    if (typeof(action.data) !== 'undefined')
        e += FIELD_SEP + action.data;
    return e;
};
*/

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
 * @return {Conflict} conflict object, or null if there was no conflict
 */
Hoard.prototype.play_action = function(e, listener) {
    "use strict";

    var parent, name, i;

    if (typeof e.time === "undefined" || e.time === null) {
        e.time = new Date().valueOf();
    }

    this.actions.push(e);

    // Update the cache; the listener will only be called if this
    // succeeds
    parent = this.cache;
    for (i = 0; i < e.path.length - 1; i++) {
        name = e.path[i];
        if (typeof parent.data === "string") {
            throw "Cannot play action over leaf node";
        } else if (parent.data[name]) {
            parent = parent.data[name];
        } else {
            return { action: e, message:
                     "'" + e.path.slice(0, i + 1).join("/") + "' does not exist" };
        }
    }
    name = e.path[i];

    if (e.type === "N") {
        if (parent.data[name]) {
            return { action: e, message: "Already exists" };
        }

        parent.time = e.time; // collection is being modified
        parent.data[name] = {
            time: e.time,
            data: (typeof e.data === "string") ?
                e.data : {}
        };
    } else if (e.type === "D") {
        if (!parent.data[name]) {
            return { action: e, message: "Does not exist" };
        }
        delete parent.data[name];
    } else if (e.type === "R") {
        if (!parent.data[name]) {
            return { action: e, message: "Does not exist" };
        }

        parent.data[e.data] = parent.data[name];
        delete parent.data[name];
    } else if (e.type === "E") {
        if (!parent.data[name]) {
            return { action: e, message: "Does not exist" };
        }

        parent.data[name] = e.data;
    } else {
        throw "Unrecognised action type " + e.type;
    }

    if (listener) {
        listener.call(this, e);
    }

    return null;
};

/**
 * @private method to reconstruct an action stream from a node and it's
 * subtree
 */
Hoard.prototype._reconstruct = function(node, path, listener) {
    if (typeof(node.data) === 'string') {
        listener.call(this, {
            type: 'N', 
            path: path,
            time: node.time,
            data: node.data
        })
    } else if (typeof(node.data) !== 'undefined') {
        if (path.length > 0) {
            // No action for the root
            listener.call(this, {
                type: 'N', 
                time: node.time,
                path: path
            });
        }

        for (key in node.data) {
            path.push(key);
            this._reconstruct(node.data[key], path, listener);
            path.pop();
        }
    } else {
        debugger;
}
};

/**
 * Reconstruct an action stream (which will all be 'N' actions) from
 * the cache in the hoard. This is used to generate the UI tree from
 * a stored cache.
 * @param listener {Listener} callback that takes an action
 */
Hoard.prototype.reconstruct = function(listener) {
    this._reconstruct(this.cache, [], listener);
};

/**
 * Merge the content of the hoard with the action stream in the hoard passed.
 * First all actions in the stream since the last sync are played in
 * to the hoard. Then, all actions in the hoard are merged into the stream
 * Finally the hoard's action stream is cleared and the sync time set to
 * the time of the last action in the stream + 1
 * @param {Hoard} cloud the other hoard to sync with
 * @param {Listener} [listener] called whenever an action is played
 * @param {Object[]} conflicts, as returned by play_action, if there are any
 * @returns {boolean} true if a cloud update is required
 */
Hoard.prototype.sync = function(cloud, listener, conflicts) {
    "use strict";

    var i = 0, j = 0, is = 0,
    stream = cloud.actions,
    il = stream.length,
    jl = this.actions.length,
    c;

    console.log("Last sync was at " + new Date(this.last_sync));

    // Play in all cloud actions since the last sync
    while (i < il && stream[i].time <= this.last_sync) {
        console.log("...skip cloud action @" + new Date(stream[i].time));
        i++;
    }
    is = i;
    while (i < il) {
        console.log("...push cloud action @" + new Date(stream[i].time));
        c = this.play_action(stream[i++], listener);
        if (c !== null) {
            conflicts.push(c);
        }
    }

    // Merge-sort in the local action stream to the cloud action
    // stream
    var cloud_update_required = (j < jl);
    i = is;
    while (j < jl) {
        while (i < il && this.actions[j].time > stream[i].time) {
            i++;
        }
        if (i === il) {
            stream.push(this.actions[j]);
        } else {
            stream.splice(i, 0, this.actions[j]);
            il++;
        }
        j++;
    }

    // Clear our action stream - we're up to date
    this.actions = [];

    // Set the sync time
    if (il > 0) {
        this.last_sync = stream[il - 1].time + 1;
    } else {
        this.last_sync = new Date().valueOf();
    }

    return cloud_update_required;
};
