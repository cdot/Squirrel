/*@preserve Copyright (C) 2015-2019 Crawford Currie http://c-dot.co.uk license MIT*/

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

define(["js/Utils", "js/Translator"], function(Utils, Translator) {
    var TX = Translator.instance();

    /**
     * Create a new Hoard.
     * @class
     * @param p paramaters, including {
     * name: identifier for the hoard. The name is transitory and
     * only used for debugging; it is not saved with the hoard.
     * data: an optional JSON string containing a serialised Hoard
     * debug: optional debugging function
     * }
     * @member {object} cache root of tree
     * @member {Action[]} actions actions played since the last sync
     * @member {number} last_sync integer date since the last sync, or null
     */
    class Hoard {

        constructor(p) {
            this.debug = p.debug;
            let name = p.name;
            let data = p.data;
            this.name = name;
            if (data) {
                if (typeof data !== "object")
                    data = JSON.parse(data);

                this.last_sync = data.last_sync;
                this.actions = data.actions;
                this.cache = data.cache;
                this.options = data.options;
                this.version = data.version || VERSION;

                if (this.version > VERSION)
                    throw new Error(name + " hoard error: cannot read a version " + data.version +
                                    " hoard with " + VERSION + " code");

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

                    // What's the server path to the hoard store?
                    store_path: null
                };
        }

        /**
         * Generate a terse string version of an action for reporting
         * @param action action to report on
         * @return {string} human readable description of action
         */
        static stringify_action(action) {
            return action.type + ":" +
                action.path.join("↘") +
                (typeof action.data !== "undefined" ?
                 (" '" + action.data + "'") : "") +
                " @" + new Date(action.time)
                .toLocaleString();
        }

        /**
         * Return a dump of the current state of the hoard for debugging
         * @return a string with the JSON of the cache, and a list of the actions.
         */
        dump() {
            let data = this.JSON() + "\n"; // get the cache
            for (let i = 0; i < this.actions.length; i++) {
                data = data + Hoard.stringify_action(this.actions[i]) + "\n";
            }
            return data;
        }

        /**
         * Clear down the actions in the hoard. The cache is left untouched.
         * This is used when the client hoard has been synched with the cloud
         * and the local actions list is no longer needed.
         */
        clear_actions() {
            this.actions = [];
        }

        /**
         * Construct a new action object.
         * @param arguments This can be in the form of an existing
         * action structure to clone, or arguments (type, path, time, data)
         */
        static new_action() {
            let type, path, data, time;
            if (typeof arguments[0] === "string") {
                type = arguments[0];
                path = arguments[1];
                time = arguments[2];
                data = arguments[3];
            } else {
                let e = arguments[0];
                type = e.type;
                path = e.path;
                time = e.time;
                data = e.data;
            }
            let n = {
                type: type,
                path: path.slice(),
                time: time ? time : Date.now()
            };
            if (typeof data !== "undefined")
                n.data = data;
            return n;
        }

        /**
         * Push a new action on to the end of the action stream. No checking
         * is done on the action, though it will default the time to 'now'.
         * @param arguments the action to push. This can be in the form of an existing
         * action structure, or ordered arguments (type, path, time, data)
         * @return a reference to the action object pushed (this may have
         * defaulted fields)
         */
        push_action() {
            let copy = Hoard.new_action.apply(this, arguments);
            this.actions.push(copy);
            return copy;
        }

        /**
         * Pop the most recently pushed action off the actions stream and
         * return it.
         * @return the action popped
         */
        pop_action() {
            if (this.actions.length === 0)
                throw new Error(this.name + " hoard error: Cannot pop from empty actions stream");
            return this.actions.pop();
        }

        /**
         * @private
         * Locate the node referenced by the given path in the tree
         * @param path array of path elements
         * @param offset optional offset from the leaf e.g. 1 will find the parent
         * of the node identified by the path
         */
        _locate_node(path, offset) {
            let node = this.cache;
            offset = offset || 0;

            for (let i = 0; i < path.length - offset; i++) {
                let name = path[i];
                if (node && typeof node.data === "string") {
                    throw new Error(this.name + " hoard error: Cannot recurse into leaf node");
                } else if (node && node.data[name]) {
                    node = node.data[name];
                } else {
                    return undefined;
                }
            }
            return node;
        }

        /**
         * Promise to play a single action into the cache. The cache is updated, but
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
         * @return a promise that resolves to an object thus:
         * {
         *   event: the action being played
         *   conflict: string message, only set if there is a problem.
         * }
         */
        play_action(e) {
            if (!e.time)
                e.time = Date.now();

            function conflict(e, mess) {
                let s = TX.tx("Cannot ") + {
                    A: TX.tx("add reminder to"),
                    C: TX.tx("cancel reminder"),
                    D: TX.tx("delete"),
                    E: TX.tx("change value of"),
                    M: TX.tx("move"),
                    N: TX.tx("create"),
                    R: TX.tx("rename"),
                    X: TX.tx("constrain")
                }[e.type];
                return Promise.resolve({
                    event: e,
                    conflict: s + " '" + e.path.join("↘") + "': " + mess
                });
            }

            if (e.path.length === 0)
                return conflict(e, "Zero length path");

            if (!this.cache) {
                this.cache = {
                    data: {}
                };
            }
            let parent = this._locate_node(e.path, 1);
            // Path must always point to a valid parent pre-existing in the cache
            // parent will never be null
            if (!parent)
                return conflict(e, TX.tx("Parent folder not found"));

            let name = e.path[e.path.length - 1];
            // Node may be undefined e.g. if we are creating
            let node = parent.data[name];

            if (e.type === "N") { // New
                if (node)
                    return conflict(e, TX.tx("It already exists") + " @" +
                                    new Date(node.time));
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
                let new_parent;

                switch (e.type) {
                case "M": // Move to another parent
                    // e.data is the path of the new parent
                    new_parent = this._locate_node(e.data);
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
                    if (this.debug) throw new Error("Unrecognised action type (may be due to a version incompatibility?)");
                }
            }

            return Promise.resolve({ event: e });
        }

        /**
         * Merge an action stream into the hoard. Duplicate actions are ignored, and
         * the merged stream is sorted into time order.
         * @param actions the actions to merge. This must be in time order.
         * @return the number of actions added
         */
        merge_actions(actions) {
            let etop = 0;
            let added = 0;

            actions.sort(function (a, b) {
                return a.time < b.time ? -1 :
                    a.time > b.time ? 1 : 0;
            });

            for (let ntop = 0; ntop < actions.length; ntop++) {
                let na = actions[ntop];
                if (ntop > 0 && na.time < actions[ntop - 1].time)
                    throw new Error(TX.tx("%s hoard; merged action stream is out of order", this.name));
                while (etop < this.actions.length &&
                       this.actions[etop].time < na.time) {
                    etop++;
                }
                if (etop < this.actions.length) {
                    let ea = this.actions[etop];
                    //this.debug("cmp " + Hoard.stringify_action(na) + " and " +
                    //            Hoard.stringify_action(ea));
                    if (na.time === ea.time &&
                        na.type === ea.type &&
                        na.path.join('/') === ea.path.join('/') &&
                        na.data === ea.data) {
                        // Duplicate
                        //this.debug("already there");
                        continue;
                    }
                }
                //this.debug("Add " + Hoard.stringify_action(na));

                this.actions.splice(etop, 0, Hoard.new_action(na));
                added++;
            }
            return added;
        }

        /**
         * @private
         * Promise to reconstruct an action stream from a node and its children.
         * @param data root node of tree to reconstruct from
         * @param path path array
         * @param {function} reconstruct
         * reconstruct.call(this:Hoard, action:Action, follow:Function)
         * on each reconstructed action.
         * @param {function} progress optional, called with %age
         ;     */
        _reconstruct_actions(data, path, reconstruct, progress) {

            let self = this;

            // Promise to handle a node
            function handle_node(node, p, ready) {
                if (p.length === 0) {
                    // No action for the root
                    return Promise.resolve();
                }
                let time = (typeof node.time !== "undefined" ? node.time : Date.now());
                let action = Hoard.new_action("N", p, time);

                if (typeof node.data === "string")
                    action.data = node.data;
                else if (this.debug && typeof node.data === "undefined")
                    debugger;

                // Execute the 'N'
                return new Promise((resolve, reject) => {
                    reconstruct.call(
                        self,
                        action,
                        function () {
                            // The 'N' has been completed so the factory has the
                            // node. We can now reconstruct 'A' and 'X' actoins on
                            // it.
                            if (node.alarm) {
                                reconstruct.call(
                                    self, Hoard.new_action(
                                        "A", p, time, node.alarm));
                            }
                            if (node.constraints) {
                                reconstruct.call(
                                    self, Hoard.new_action(
                                        "X", p, time, node.constraints));
                            }
                            resolve();
                        });
                });
            }

            let count, counter;

            // Recursively traverse nodes, starting at the root
            function list_nodes(node, pat) {
                count++;
                let promise = handle_node(node, pat);

                if (progress)
                    progress = progress.then(() => {
                        progress(Math.floor(100 * (counter++) / count));
                    });

                if (typeof node.data === "object") {
                    for (let key in node.data) {
                        let p = pat.slice();
                        p.push(key);
                        promise = promise.then(() => {
                            return list_nodes(node.data[key], p);
                        });
                    }
                }
                return promise;
            }

            return list_nodes(data, path.slice());
        }

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
         */
        actions_from_hierarchy(data, reconstruct, progress) {
            return this._reconstruct_actions(data, [], reconstruct, progress);
        }

        /**
         * Promise to reconstruct an action stream from the cache in the hoard. Assumes that
         * all actions in the hoard have already been played into the cache.
         * This method doubles as a way to simplify a hoard, as the action set
         * will be pared down to just those actions that are required to recreate
         * the cache.
         * @param {function} reconstruct function to call on each action as it
         * is constructed. reconstruct.call(this:Hoard, action:Action, follow:Function)
         * @param {function} progress optional, called with a %age
         */
        reconstruct_actions(reconstruct, progress) {
            if (this.cache)
                return this._reconstruct_actions(this.cache, [], reconstruct, progress);
            // No cache => no actions
            return Promise.resolve();
        }

        /**
         * Promise to add the actions that are timestamped since the last sync into
         * this hoard. Updates the sync time to now.
         * Actions are *not* appended to our local actions stream, they are simply
         * played into the cache.
         * @param new_actions actions to add
         * @param {function} listener called to report events. Passed an object with
         * fields {
         * event: an Action
         * conflict: a message, if there was a conflict
         * progress: an integer percentage
         * }
         */
        play_actions(new_actions, listener) {
            // Play in all actions since the last sync
            let count = new_actions.length;
            if (this.debug) this.debug(
                "Playing new actions since " + new Date(this.last_sync).toLocaleString());
            let p = Promise.resolve();
            let progress = 0;
            for (let i = 0; i < count; i++) {
                if (new_actions[i].time > this.last_sync) {
                    p = p.then(() => {
                        if (this.debug) this.debug(
                            "Play " + Hoard.stringify_action(new_actions[i]));
                        return this
                            .play_action(new_actions[i]).then((res) => {
                                res.progress = Math.floor(100 * (++progress) / count);
                                if (listener)
                                    listener(res);
                            });
                    });
                } else if (this.debug) this.debug(
                    "Skip old " + Hoard.stringify_action(new_actions[i]));
            }

            this.last_sync = Date.now();
            return p;
        }

        /**
         * Return the cache node identified by the path.
         * @param path array of path elements, root first
         * @return a cache node, or null if not found.
         */
        get_node(path) {
            let node = this.cache,
                i;
            for (i = 0; i < path.length; i++) {
                if (typeof node.data === "string")
                    return null;
                node = node.data[path[i]];
            }
            return node;
        }

        /**
         * @private
         */
        _each_alarm() {
            let self = this,
                alarum = function () {
                    self._each_alarm();
                };

            while (this.check && this.check.queue.length > 0) {
                let item = this.check.queue.pop(),
                    node = item.node,
                    name;

                if (typeof node.data === "object")
                    for (name in node.data) {
                        let snode = node.data[name];
                        this.check.queue.push({
                            node: snode,
                            path: item.path.slice()
                                .concat([name])
                        });
                    }

                if (typeof node.alarm !== "undefined" &&
                    (Date.now() - node.time) >= (node.alarm * Utils.MSPERDAY)) {
                    this.check.listener(
                        item.path,
                        new Date(node.time + node.alarm * Utils.MSPERDAY),
                        alarum);
                    return;
                }
            }
            delete this.check;
        }

        /**
         * Check alarms, calling listener on all alarms that have fired
         * @param listener listener function([], Date, node)
         */
        check_alarms(listener) {

            if (!this.cache)
                return;
            this.check = {
                queue: [{
                    path: [],
                    node: this.cache
                }],
                listener: listener
            };
            this._each_alarm();
        }

        /**
         * Generate a JSON dump of the tree. Dumps the children of the root
         * node as a map.
         * @return a string containing a formatted JSON dump
         */
        JSON() {
            let data = "";
            if (this.cache)
                data = JSON.stringify(this.cache.data, null, "\t");
            return data;
        }
    }

    return Hoard;
});
