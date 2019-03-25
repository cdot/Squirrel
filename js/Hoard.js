/*@preserve Copyright (C) 2015-2019 Crawford Currie http://c-dot.co.uk license MIT*/
/* eslint-env browser,node */

/**
 * A combined hierarchical data store with change log, designed to be
 * used in a client-cloud topology where a single cloud hoard is
 * synched with multiple clients, each of which may change
 * asynchronously.
 *
 * On the client side, the hoard contains a tree (called the 'cache')
 * that represents the current data in the hoard. It also has a list
 * of actions that record the actions performed on the client since
 * the last sync with the cloud. These actions are already reflected
 * in the tree, but are kept so they can be played into the cloud on
 * the next synch.
 *
 * On the cloud side the tree is ignored, and the list of actions
 * represents all changes since the hoard was established. These can
 * be replayed in full to regenerate the tree, though this is a
 * time-consuming business.
 *
 * When a client requires synching with the cloud, actions from the cloud
 * that occurred since the last synch are merged into the client action
 * stream in time order. Duplicate actions are ignored.
 *
 * At any time the hoard can be optimised - basically blowing away all
 * the history - by reconstructing an action stream from the contents of
 * the tree cache. This should only be done if you are sure all clients
 * are up-to-date.
 *
 * Note that the tree here is *not* the same as the "Tree" object in
 * the UI.
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

define(["js/Translator"], function(Translator) {
    let TX = Translator.instance();

    const MSPERDAY = 24 * 60 * 60 * 1000;

    /**
     * @class
     * @member {object} tree root of tree
     * @member {Action[]} actions actions played since the last sync
     * @member {number} last_sync integer date since the last sync, or null
     */
    class Hoard {

        /**
         * Constructor
         * @param p parameters, including <ul>
         * <li>data: an optional JSON string containing a serialised Hoard, or
         * another Hoard object (tree and actions will be stolen, not copied)
         * <li>debug: optional debugging function
         * </ul>
         */
        constructor(p) {
            p = p || {};
            this.debug = p.debug;
            let data = p.data;
            if (data) {
                if (typeof data !== "object")
                    data = JSON.parse(data);

                this.last_sync = data.last_sync;
                this.actions = data.actions || [];
                this.tree = data.tree;
                this.version = data.version || VERSION;

                if (this.version > VERSION)
                    throw new Error("Internal: cannot read a version "
                                    + data.version +
                                    " hoard with " + VERSION + " code");

            } else {
                this.last_sync = null;
                this.clear_actions();
                this.tree = null;
                this.version = VERSION;
            }
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
         * @return a string with the JSON of the tree, and a list of the actions.
         */
        dump() {
            let data = this.JSON() + "\n"; // get the tree
            for (let i = 0; i < this.actions.length; i++) {
                data = data + Hoard.stringify_action(this.actions[i]) + "\n";
            }
            return data;
        }

        /**
         * Clear down the actions in the hoard. The tree is left untouched.
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
         * Push a new action on to the end of the action stream. The
         * tree is *not* updated. No checking is done on the action.
         * @param arguments the action to push. This can be in the
         * form of an existing action structure, or ordered arguments
         * (type, path, time, data)
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
                throw new Error("Internal: Cannot pop from empty actions stream");
            return this.actions.pop();
        }

        /**
         * @private
         * Locate the node referenced by the given path in the tree
         * @param path array of path elements
         * @param offset optional offset from the leaf e.g. 1 will
         * find the parent of the node identified by the path
         */
        _locate_node(path, offset) {
            let node = this.tree;
            offset = offset || 0;

            for (let i = 0; i < path.length - offset; i++) {
                let name = path[i];
                if (node && typeof node.data === "string") {
                    throw new Error("Internal: Cannot recurse into leaf node");
                } else if (node && node.data[name]) {
                    node = node.data[name];
                } else {
                    return undefined;
                }
            }
            return node;
        }

        /**
         * Promise to play a single action into the tree. The tree
         * is updated, but the action is <em>not</em> added to the
         * action stream.
         *
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
                let s = {
                    A: TX.tx("Cannot add reminder to"),
                    C: TX.tx("Cannot cancel reminder"),
                    D: TX.tx("Cannot delete"),
                    E: TX.tx("Cannot change value of"),
                    M: TX.tx("Cannot move"),
                    N: TX.tx("Cannot create"),
                    R: TX.tx("Cannot rename"),
                    X: TX.tx("Cannot constrain")
                }[e.type];
                return Promise.resolve({
                    event: e,
                    conflict: s + " '" + e.path.join("↘") + "': " + mess
                });
            }

            if (e.path.length === 0)
                return conflict(e, "Zero length path");

            if (!this.tree) {
                this.tree = {
                    data: {}
                };
            }
            let parent = this._locate_node(e.path, 1);
            // Path must always point to a valid parent pre-existing
            // in the tree. parent will never be null
            if (!parent)
                return conflict(e, TX.tx("Node not found"));

            let name = e.path[e.path.length - 1];
            // Node may be undefined e.g. if we are creating
            let node = parent.data[name];

            if (e.type === "N") { // New
                if (node)
                    // This is not really an error, we can survive it
                    // easily enough
                    //return conflict(e, "It already exists" + " @" +
                    //                new Date(node.time));
                    return Promise.resolve({ event: e });

                parent.time = e.time; // collection is being modified
                parent.data[name] = {
                    time: e.time,
                    data: (typeof e.data === "string") ?
                        e.data : {}
                };
            }
            else { // all other actions require an existing node
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

                    // collection is being modified
                    new_parent.time = parent.time = e.time
                    = Math.max(new_parent.time, parent.time, e.time);

                    delete parent.data[name];
                    new_parent.data[name] = node;
                    break;

                case "D": // Delete
                    delete parent.data[name];
                    // collection is being modified
                    parent.time = e.time = Math.max(parent.time, e.time);
                    break;

                case "R": // Rename
                    if (parent.data[e.data])
                        return conflict(e, " '" + e.data + "': " +
                                        TX.tx("It already exists"));
                    parent.data[e.data] = node;
                    delete parent.data[name];
                    // collection is being modified, node is not
                    parent.time = e.time = Math.max(parent.time, e.time);
                    break;

                case "E": // Edit
                    node.data = e.data;
                    node.time = e.time = Math.max(node.time, e.time);
                    break;

                case "A": // Alarm
                    if (!e.data)
                        delete node.alarm;
                    else
                        node.alarm = e.data;
                    node.time = e.time = Math.max(node.time, e.time);
                    break;

                case "C": // Cancel alarm
                    delete node.alarm;
                    node.time = e.time = Math.max(node.time, e.time);
                    break;

                case "X": // Constrain. Introduced in 2.0, however 1.0 code
                    // will simply ignore this action.
                    if (!e.data)
                        delete node.constraints;
                    else
                        node.constraints = e.data;
                    node.time = e.time = Math.max(node.time, e.time);
                    break;

                default:
                    if (this.debug) throw new Error("Unrecognised action type (may be due to a version incompatibility?)");
                }
            }

            return Promise.resolve({ event: e });
        }

        /**
         * Merge an action stream into the hoard. Duplicate actions
         * are ignored. This is used to merge recent actions from a client
         * hoard into a cloud hoard, so there is no tree management; the action
         * streams are simply merged, with minimal checking.
         * @param actions the actions to merge. They must be in time order.
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
                    throw new Error("Internal: Merged action stream is out of order");
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
         * Promise to visit nodes in a tree in dependency order and generate
         * actions. Actions will all be 'N', 'A' and 'X' actions). Does not
         * (directly) affect the actions stored in the hoard (though
         * the reconstruct function might). Note that actions are visited
         * in tree (dependency) order, and NOT in date order.
         * @param root data structure, a simple hierarchical structure
         * of keys and the data they contain e.g.
         * { "key1" : { data: { subkey1: { data: "string data" } } } }
         * Other fields (such as time) may be present and are used if they are.
         * @param {function} return promise to construct the action
         * function(action)
         */
        actions_from_tree(root, reconstruct) {
            if (!root)
                return Promise.resolve();

            let self = this;

            // Promise to handle a node
            function _visit_node(node, p, after) {
                if (p.length === 0) {
                    // No action for the root
                    return Promise.resolve();
                }
                let time = node.time;

                if (typeof time === "undefined")
                    time = Date.now();

                if (typeof after !== "undefined" && time < after) {
                    // This should never happen, but just in case...
                    time = after + 1;
                }

                let action = Hoard.new_action({
                    type: "N",
                    path: p,
                    time: time
                });

                if (typeof node.data === "string")
                    action.data = node.data;

                // Execute the 'N'
                let promise = reconstruct(action);

                if (node.alarm) {
                    // Use the node construction time on alarms too
                    promise = promise.then(() => {
                        return reconstruct(Hoard.new_action({
                            type: "A",
                            path: p,
                            time: time,
                            data: node.alarm
                        }));
                    });
                }

                if (node.constraints) {
                    promise = promise.then(() => {
                        return reconstruct(Hoard.new_action({
                            type: "X",
                            path: p,
                            time: time,
                            data: node.constraints
                        }));
                    });
                }
                return promise;
            }

            // Recursively traverse nodes, starting at the root
            function _visit_nodes(node, pat, after) {
                let promise = _visit_node(node, pat, after);

                if (typeof node.data === "object") {
                    for (let key in node.data) {
                        let p = pat.slice();
                        p.push(key);
                        promise = promise
                        .then(_visit_nodes(node.data[key], p, node.time));
                    }
                }
                return promise;
            }

            return _visit_nodes(root, []);
        }

        /**
         * Promise to add the actions that are timestamped since the
         * last sync into this hoard. Updates the sync time to now.
         * Actions are *not* appended to our local actions stream,
         * they are simply played into the tree.
         * @param new_actions actions to add
         * @param {function} listener called to report events. Passed
         * an object with fields <ul>
         * <li>event: an Action object
         * <li>conflict: a message, if there was a conflict
         * </ul>
         */
        play_actions(new_actions, listener) {
            // Play in all actions since the last sync
            if (!new_actions)
                return;
            if (this.debug) this.debug(
                "Playing new actions since " + new Date(this.last_sync).toLocaleString());
            let p = Promise.resolve();
            for (let i = 0; i < new_actions.length; i++) {
                if (new_actions[i].time > this.last_sync) {
                    p = p.then(() => {
                        if (this.debug) this.debug(
                            "Play " + Hoard.stringify_action(new_actions[i]));
                        return this
                            .play_action(new_actions[i]).then((res) => {
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
         * Return the tree node identified by the path.
         * @param path array of path elements, root first
         * @return a tree node, or null if not found.
         */
        get_node(path) {
            let node = this.tree;
            for (let i = 0; i < path.length; i++) {
                if (typeof node.data === "string")
                    return null;
                node = node.data[path[i]];
                if (typeof node === "undefined")
                    return null;
            }
            return node;
        }

        /**
         * Promise to check all alarms. Returns a promise to resolve all the
         * promises returned by 'ring'.
         * @param ringfn function([], Date), return a promise
         * @return a promise
         */
        check_alarms(ringfn) {

            if (!this.tree) {
                //console.log("Empty tree");
                return Promise.resolve();
            }

            let checkAlarms = [{
                path: [],
                node: this.tree
            }];

            let promise = Promise.resolve();

            while (checkAlarms.length > 0) {
                let item = checkAlarms.pop();
                let node = item.node;
                if (typeof node.data === "object") {
                    for (let name in node.data) {
                        let snode = node.data[name];
                        checkAlarms.push({
                            node: snode,
                            path: item.path.slice().concat([name])
                        });
                    }
                }

                if (typeof node.alarm !== "undefined") {
                    // Old format alarms had one number, number of days from
                    // last node change. New format has two, repeat in MS
                    // and next ring. If repeat is 0, don't re-run the alarm.
                    let alarm = node.alarm;
                    let ding;
                    if (typeof alarm === "number") {
                        // Update to latest format
                        alarm = { time: node.time + alarm * MSPERDAY };
                        node.alarm = alarm;
                    }
                    if (Date.now() >= alarm.time) {
                        promise = promise.then(
                            ringfn(item.path, new Date(alarm.time)));
                    }
                }
            }
            return promise;
        }

        /**
         * Generate a JSON dump of the tree. Dumps the children of the root
         * node as a map.
         * @return a string containing a formatted JSON dump
         */
        JSON() {
            let data = "";
            if (this.tree)
                data = JSON.stringify(this.tree.data, null, "\t");
            return data;
        }
    }

    return Hoard;
});
