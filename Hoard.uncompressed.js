// A store of data that can be synchronised with another store

// Characters used in event encoding. Characters in the range
// [\x00-\x07\x08-\x1F] are not permitted in paths.
const EVENT_SEP  = String.fromCharCode(10); // end of event
const FIELD_SEP  = String.fromCharCode(3);
const PATH_SEP   = String.fromCharCode(4);
const BLOCK_SEP  = String.fromCharCode(5);

function Hoard(engine) {
    this.empty();
    this.engine = engine;
}

Hoard.prototype.empty = function() {
    this.last_sync = null; // Time of last synch
    this.events = []; // events queued since the last sync
    this.cache = { data: {} }; // the cache
}

// Decode an event string to a structure
Hoard.prototype._decode_event = function(event) {
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
    if (!event.time)
        event.time = new Date();
    var e =  event.type
        + event.time.getTime() + FIELD_SEP
        + event.path.join(PATH_SEP);
    if (typeof(event.data) !== 'undefined')
        e += FIELD_SEP + event.data;
    return e;
};

/**
 * Play a single event into the hoard. The cache is updated, and
 * the event added to the event stream ready for the next synch.
 * Apply the given event
 * N with no data - create collection
 * N with data - create leaf
 * D - delete node
 * E
 * R
 */
Hoard.prototype.play_event = function(e, o) {
    var node, i, newnode;
    if (e.type === 'N') {
        if (typeof(e.time) === 'undefined' || e.time == null)
            e.time = new Date();

	node = this.cache;
	for (i = 0; i < e.path.length - 1; i++) {
            if (typeof(node.data) === 'string') {
                throw("Cannot play event over leaf node");
            } else if (node.data[e.path[i]]) {
                node = node.data[e.path[i]];
            } else {
                newnode = {
                    time: e.time,
                    data: {}
                };
                node.data[e.path[i]] = newnode;
                node = newnode;
            }
	}

        node.time = e.time; // collection is being modified

        var new_name = e.path[e.path.length - 1];
        newnode = {
            time: new Date()
        };

        if (node.data[new_name]) {
            if (o && o.conflicts)
                o.conflicts.push({ event: e, message: "Already exists" });
            return;
        }
        node.data[new_name] = newnode;

        if (typeof(e.data) === 'string')
            newnode.data = e.data;
        else
            newnode.data = {};

        this.events.push(e);

    } else if (e.type === 'D') {
	node = this.cache;
	for (i = 0; i < e.path.length - 1; i++) {
            if (typeof(node.data) !== 'string') {
                node = node.data[e.path[i]];
            } else {
                node = null;
                break;
            }
	}
        if (node)
            delete(node.data[e.path[e.path.length - 1]]);

    } else {
        throw("Unrecognised event type " + e.type);
    }
    if (o && typeof(o.pass_on) !== 'undefined')
        o.pass_on(e);
};

// Record an event in the store. We update and timestamp the cache
// as we store the event.
Hoard.prototype.record_event = function(type, path, data) {
    var e = {
        type: type,
        path: path
    };
    if (typeof(data) !== 'undefined')
        e.data = data;
    e.time = new Date();

    // Update the cache
    this.play_event(e);
    // Add to the list of events
    this.events.push(e);
};

// Freeze the hoard to a string for saving
Hoard.prototype.freeze = function() {
    var safe = this;
    var a = [
        this.time.toISOString(),
        JSON.stringify(this.cache)
    ];
    var b = [];

    // Stringify the unsynched events
    this.events.each(function(i, e) {
        b.push(safe.encode_event(e));
    });
    a.push(b.join(EVENT_SEP));

    return a.join(BLOCK_SEP);
};

// Thaw the hoard from a string. Any existing data in the hoard is
// discarded.
Hoard.prototype.thaw = function(data, o) {
    var a = data.split(BLOCK_SEP, 3);
    this.last_sync = new Date(a[0]);
    this.cache = JSON.parse(a[1]);
    this.events = [];
    var a = a[2].split(EVENT_SEP);
    for (var i = 0; i < a.length; i++) {
        var e = a[i];
        if (e.length > 0)
            events.push(this._decode_event(e));
    }
};

// Merge the content of the hoard with the event stream in the hoard passed.
// First all events in the stream since the last sync are played in
// to the hoard. Then, all events in the hoard are merged into the stream
// Finally the hoard's event stream is cleared and the sync time set to
// the time of the last event in the stream + 1

// Load hoard from local store
// Load remote
// Merge events into local cache
// Append local events to remote cache
// Save local cache
// Save remote stream

Hoard.prototype.sync = function(other, o) {
    var stream = other.events;
    var i = 0;
    var is = 0;
    var il = stream.length;
    var j = 0;
    var jl = this.events.length;
    while (i < il && stream[i].time <= this.last_sync)
        i++;
    is = i;
    while (i < il)
        this.play_event(stream[i++], o);
    i = is;
    while (j < jl) {
        while (i < il && this.events[j].time > stream[i].time)
            i++;
        if (i === il)
            stream.push(this.events[j]);
        else {
            stream.splice(i, 0, this.events[j]);
            il++;
        }
        j++;
    }
    this.events = [];
    this.last_sync = stream[il - 1].time + 1;
    // Whack the other cache
    other.cache = {};
};
