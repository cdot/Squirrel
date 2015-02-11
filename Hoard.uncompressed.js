/**
 * A hierarchical data store, designed to be synched with another
 * store on a time basis.
 *
 * A hoard consists of two types of data. First, a cache that represents
 * the current state of the data in the hoard. Second, a list of events
 * that record the changes to the hoard since the time of the last
 * sync.
 *
 * The cache may be null, in which case the state of the data is entirely
 * represented by the events. These can be replayed at any time to
 * regenerate and empty cache. If the cache is non-null, the events record
 * the changes that have been made since the last sync. In this case the
 * events are assumed to have already been played into the cache.
 *
 * The basic idea is that the central shared hoard is represented using
 * a times stream of events that can be replayed from any point to regenerate
 * the cache. The client has a local hoard that uses a cache, and records
 * events since the last sync so that they can be merged with the stream
 * of events in the shared hoard.
 *
 * @typedef Event
 * @type {object}
 * @property {string} type - single character type
 * @property {string[]} path - node path
 * @property {Object} data - optional data object
 *
 * @typedef Conflict
 * @type {object}
 * @property {Event} event
 * @property {string} message
 *
 * @typedef Data
 * @type {object}
 * @property {Data[]|string} colelction of subnodes, or leaf data if
 * this is string
 * @property time {integer} time of the last modification
 *
 * @callback listener
 * @param {Event} event
 */

/**
 * Create a new Hoard
 * @class
 * @member {Data} cache root of the data structure
 * @member {Event[]} events events played since the last sync
 * @member {number} last_sync integer date since the last sync, or null
 */
function Hoard(data) {
    "use strict";

    if (data) {
        this.cache = data.cache;
        this.events = data.events;
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
    this.events = [];
    this.cache = { data: {} };
};

/*
// EVENT ENCODING - not used

// Characters used in event encoding. Characters in the range
// [\x00-\x07\x08-\x1F] are not permitted in paths.
const EVENT_SEP  = String.fromCharCode(10); // end of event
const FIELD_SEP  = String.fromCharCode(3);
const PATH_SEP   = String.fromCharCode(4);
const BLOCK_SEP  = String.fromCharCode(5);

// Decode an event string to a structure
Hoard.prototype._decode_event = function(event) {
    "use strict";

    var fields = event.substring(1).split(FIELD_SEP);
    var datum = {
        type: event.charAt(0),
        time: new Date(),
        path: fields[1].split(PATH_SEP),
    };
    datum.time.setTime(fields[0]);
    if (fields.length > 2)
        datum.data = fields[2];
    return datum;
};

// Encode an event structure as a string
Hoard.prototype._encode_event = function(event) {
    "use strict";

    if (!event.time)
        event.time = new Date();
    var e =  event.type
        + event.time.getTime() + FIELD_SEP
        + event.path.join(PATH_SEP);
    if (typeof(event.data) !== 'undefined')
        e += FIELD_SEP + event.data;
    return e;
};
*/

/**
 * Play a single event into the hoard. The cache is updated, and
 * the event added to the event stream ready for the next synch.
 * Apply the given event type:
 * <ul>
 * <li>'N' with no data - create collection</li>
 * <li>'N' with data - create leaf</li>
 * <li>'D' delete node, no data. Will delete the entire node tree.</li>
 * <li>'E' edit node - modify the leaf data in a node</li>
 * <li>'R' rename node, data contains new name</li>
* </ul>
 * Returns a conflict object if there was an error. This has two fields,
 * 'event' for the event record and 'message'.
 * @param {Event} e the event record
 * @param {listener} [listener] called when the event is played
 * @return {Conflict} conflict object, or null if there was no conflict
 */
Hoard.prototype.play_event = function(e, listener) {
    "use strict";

    var parent, name, i;

    if (typeof e.time === "undefined" || e.time === null) {
        e.time = new Date().valueOf();
    }

    this.events.push(e);

    // Update the cache; the listener will only be called if this
    // succeeds
    parent = this.cache;
    for (i = 0; i < e.path.length - 1; i++) {
        name = e.path[i];
        if (typeof parent.data === "string") {
            throw "Cannot play event over leaf node";
        } else if (parent.data[name]) {
            parent = parent.data[name];
        } else {
            return { event: e, message:
                     e.path.slice(0, i).join("/") + " does not exist" };
        }
    }
    name = e.path[i];

    if (e.type === "N") {
        if (parent.data[name]) {
            return { event: e, message: "Already exists" };
        }

        parent.time = e.time; // collection is being modified
        parent.data[name] = {
            time: e.time,
            data: (typeof e.data === "string") ?
                e.data : {}
        };
    } else if (e.type === "D") {
        if (!parent.data[name]) {
            return { event: e, message: "Does not exist" };
        }
        delete parent.data[name];
    } else if (e.type === "R") {
        if (!parent.data[name]) {
            return { event: e, message: "Does not exist" };
        }

        parent.data[e.data] = parent.data[name];
        delete parent.data[name];
    } else if (e.type === "E") {
        if (!parent.data[name]) {
            return { event: e, message: "Does not exist" };
        }

        parent.data[name] = e.data;
    } else {
        throw "Unrecognised event type " + e.type;
    }

    if (listener) {
        listener.call(this, e);
    }

    return null;
};

/**
 * Record an event in the store. We update and timestamp the cache
 * as we store the event. This is descined for use from a UI that
 * wants to add a new event to a client hoard.
 * @param {string} type the single-character type of the event
 * @param {string[]} path array of strings representing the path of the event
 * @param {Object} event-specific data accompanying the event
 * @return {Conflict} conflict object or null if there was no conflict
 */
Hoard.prototype.record_event = function(type, path, data) {
    "use strict";

    var e = {
        type: type,
        path: path
    },
    conflict;

    if (typeof data !== "undefined") {
        e.data = data;
    }
    e.time = new Date().valueOf();

    // Update the cache
    conflict = this.play_event(e);
    if (conflict === null) {
        // Add to the list of events
        this.events.push(e);
    }
    return conflict;
};

/**
 * Merge the content of the hoard with the event stream in the hoard passed.
 * First all events in the stream since the last sync are played in
 * to the hoard. Then, all events in the hoard are merged into the stream
 * Finally the hoard's event stream is cleared and the sync time set to
 * the time of the last event in the stream + 1
 * @param {Hoard} other the other hoard to sync with
 * @param {listener} [listener] called whenever an event is played
 * @return {array} of conflicts, as returned by play_event, if there are any
 */
Hoard.prototype.sync = function(other, listener) {
    "use strict";

    var i = 0,
    stream = other.events,
    is = 0,
    il = stream.length,
    j = 0,
    jl = this.events.length,
    conflicts = [],
    c;

    // Play in all other events since the last sync
    while (i < il && stream[i].time <= this.last_sync) {
        i++;
    }
    is = i;
    while (i < il) {
        c = this.play_event(stream[i++], listener);
        if (c !== null) {
            conflicts.push(c);
        }
    }

    // Merge-sort in the local event stream to the other event
    // stream
    i = is;
    while (j < jl) {
        while (i < il && this.events[j].time > stream[i].time) {
            i++;
        }
        if (i === il) {
            stream.push(this.events[j]);
        } else {
            stream.splice(i, 0, this.events[j]);
            il++;
        }
        j++;
    }

    // Clear our event stream - we're up to date
    this.events = [];

    // Set the sync time
    this.last_sync = stream[il - 1].time + 1;

    // Delete the other cache
    other.cache = { data: {} };

    return conflicts;
};
