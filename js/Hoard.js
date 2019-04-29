/*@preserve Copyright (C) 2015-2019 Crawford Currie http://c-dot.co.uk license MIT*/
/* eslint-env browser,node */

/**
 * A combined hierarchical database with change log, designed to be
 * used in a client-cloud topology where a single cloud database is
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
 * The cloud stores a list of actions that record all changes since the
 * hoard was established. When replayed in full these will regenerate the
 * client tree, though this is a time-consuming business. These actions
 * will usually (though not always!) be in the time order that they
 * occurred.
 *
 * When a client requires synching with changes in the cloud, actions
 * from the cloud that are timestamped since the last synch are played
 * into the client tree in time order. Duplicate actions are ignored.
 * Conflicts - such as a data item that was modified locally also
 * being modified by a cloud action - are detected.
 *
 * When the cloud needs to be updated with changes from the client,
 * the actions recorded in the client can simply be merged into the
 * cloud action stream using `merge_actions'.
 *
 * At any time you can reconstruct an action stream from the contents
 * of the tree. This action stream will not have any of the history of
 * the cloud, but will be a lot smaller.
 *
 * When an action is played into the tree, listeners can be used to
 * reflect that action in the UI.
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

define("js/Hoard", ["js/Action", "js/Translator", "js/Serror"], function(Action, Translator, Serror) {
    let TX = Translator.instance();

    const MSPERDAY = 24 * 60 * 60 * 1000;

    /**
     * @class
     * @member {object} tree root of tree
     * @member {Action[]} actions actions played since the last sync
     */
    class Hoard {

        /**
         * Constructor
         * @param data: an optional JSON string containing a serialised
         * Hoard, or
         * another Hoard object (tree and actions will be stolen, not copied)
         * @param debug: optional debugging function
         */
        constructor(data, debug) {
            if (typeof data === "function" && typeof debug === "undefined") {
                debug = data;
                data = undefined;
            }
            if (typeof debug === "function")
                this.debug = debug;

            if (data) {
                if (typeof data !== "object")
                    data = JSON.parse(data);

                if (data.actions)
                    this.actions = data.actions.map(
                        (x) => { return new Action(x); });
                else
                    this.actions = [];
                this.tree = data.tree;
                this.version = data.version || VERSION;

                if (this.version > VERSION)
                    throw new Serror(400, "Cannot read a version "
                                    + data.version +
                                    " hoard with " + VERSION + " code");

            } else {
                this.actions = [];
                this.tree = null;
                this.version = VERSION;
            }
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
         * Push a new action on to the end of the action stream. The
         * tree is *not* updated. No checking is done on the action.
         * @param act the action to push. This can be in the
         * form of an existing action structure, or a simple object with.
         * This is always copied.
         * fields  {type, path, time, data}
         * @return a reference to the action object pushed
         */
        push_action(act) {
            let copy = new Action(act);
            this.actions.push(copy);
            return copy;
        }

        /**
         * Pop the most recently pushed action off the actions stream and
         * return it.
         * @return the action popped
         */
        pop_action() {
            Serror.assert(this.actions.length > 0);
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
                Serror.assert(node && typeof node.data !== "string");
                if (node && node.data[name]) {
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
         *   action: the action being played
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
                    P: TX.tx("Cannot play"),
                    R: TX.tx("Cannot rename"),
                    X: TX.tx("Cannot constrain")
                }[e.type];
                return Promise.resolve({
                    action: e,
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
                return conflict(e, TX.tx("not found"));

            let name = e.path[e.path.length - 1];
            // Node may be undefined e.g. if we are creating
            let node = parent.data[name];

            if (e.type === "N") { // New
                if (node)
                    // This is not really an error, we can survive it
                    // easily enough
                    //return conflict(e, "It already exists" + " @" +
                    //                new Date(node.time));
                    return Promise.resolve({ action: e });

                parent.time = e.time; // collection is being modified
                parent.data[name] = {
                    time: e.time,
                    data: (typeof e.data === "string") ?
                        e.data : {}
                };
            }
            else { // all other actions require an existing node
                if (!node)
                    return conflict(e, TX.tx("it does not exist"));
                let new_parent;

                switch (e.type) {
                case "M": // Move to another parent
                    // e.data is the path of the new parent
                    new_parent = this._locate_node(e.data);
                    if (!new_parent)
                        return conflict(TX.tx("new folder '$1' does not exist",
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
                        return conflict(e, TX.tx("it already exists"));
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
                    // Version incomptibility?
                    Serror.assert(false, "Unrecognised action type");
                }
            }

            return Promise.resolve({ action: e });
        }

        /**
         * Merge two action streams in time order. Duplicate actions
         * are merged. The input action streams will be irretrevably damaged.
         * @param a the first action stream to merge
         * @param b the second action stream to merge
         * @return the merged action stream, sorted in time order. Note that
         * the action objects in a and b are preserved for use here
         */
        static merge_actions(a, b) {

            if (a.length === 0)
                return b;
            
            if (b.length == 0)
                return a;

            function comp_act(a, b) {
                return a.time < b.time ? -1 : a.time > b.time ? 1 : 0;
            }

            // Sort streams into time order
            a.sort(comp_act);
            b.sort(comp_act);

            let aact = a.shift(), bact = b.shift();
            let c = [];
            while (aact || bact) {
                if (aact && bact) {
                    if (aact.time === bact.time &&
                        aact.type === bact.type &&
                        aact.path.join('/') === bact.path.join('/') &&
                        aact.data === bact.data) {
                        // Duplicate, ignore one of them
                        aact = a.shift();
                    } else if (aact.time < bact.time) {
                        c.push(aact);
                        aact = a.shift();
                    } else {
                        c.push(bact);
                        bact = b.shift();
                    }
                } else if (aact) {
                    c.push(aact);
                    aact = a.shift();
                } else {
                    c.push(bact);
                    bact = b.shift();
                }
            }
            return c;
        }

        /**
         * Recontruct the minimal action stream required to recreate the data.
         * Visits nodes in the data in tail-recursive order and
         * generate actions. Actions will all be 'N', 'A' and 'X'
         * actions, and are passed to the 'reconstruct' method.
         * @param tree data structure, a simple hierarchical structure
         * of keys and the data they contain e.g.
         * { "key1" : { data: { subkey1: { data: "string data" } } } }
         * Other fields (such as time) may be present and are used if they are.
         * @param {function} return promise to construct the action
         * function(action)
         */
        static actions_from_tree(tree, reconstruct) {
            if (!tree)
                return;

            // Promise to handle a node
            function _visit_node(node, p, after) {
                if (p.length === 0) {
                    // No action for the root
                    return;
                }
                let time = node.time;

                if (typeof time === "undefined")
                    time = Date.now();

                if (typeof after !== "undefined" && time < after) {
                    // This should never happen, but just in case...
                    time = after + 1;
                }

                let action = new Action({
                    type: "N",
                    path: p,
                    time: time
                });

                if (typeof node.data === "string")
                    action.data = node.data;

                // Execute the 'N'
                reconstruct(action);

                if (node.alarm) {
                    // Use the node construction time on alarms too
                    reconstruct(new Action({
                        type: "A",
                        path: p,
                        time: time,
                        data: node.alarm
                    }));
                }
                if (node.constraints) {
                    reconstruct(new Action({
                        type: "X",
                        path: p,
                        time: time,
                        data: node.constraints
                    }));
                }
            }

            // Recursively traverse nodes, starting at the root
            function _visit_nodes(node, pat, after) {
                _visit_node(node, pat, after);

                if (typeof node.data === "object") {
                    for (let key in node.data) {
                        let p = pat.slice();
                        p.push(key);
                        _visit_nodes(node.data[key], p, node.time);
                    }
                }
            }

            _visit_nodes(tree, []);
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
         * @param ringfn function([], Date)
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

                    if (typeof node.alarm === "number") {
                        // Update to latest format
                        node.alarm = {
                            time: node.time + node.alarm * MSPERDAY
                        };
                    }
                    if (Date.now() >= node.alarm.time) {
                        promise = promise.then(() => {
                            return ringfn(item.path, new Date(node.alarm.time));
                        });
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
        treeJSON() {
            let data = "";
            if (this.tree)
                data = JSON.stringify(this.tree.data, null, " ");
            return data;
        }
    }

    return Hoard;
});
