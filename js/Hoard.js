/*@preserve Copyright (C) 2015-2019 Crawford Currie http://c-dot.co.uk license MIT*/
/* eslint-env browser,node */

/**
 * @typedef Conflict
 * @type {object}
 * @property {Action} action
 * @property {string} message
 *
 * @typedef Node
 * @type {object}
 * @property {Data[]|string} collection of subnodes, or leaf (non-object) data
 * @property time {integer} time of the last modification
 * @property alarm {string} time of next alarm, encode as "next ring;repeat"
 * @property constraints {string} constraints, encoded as "length;chars"
 */

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
         * @param options structure with: <dl>
         * <dt>hoard</dt><dd>optional hoard to copy (silently overrides
         * tree and actions)</dd>
         * <dt>tree</dt><dd>optional tree to copy (if hoard: not set)</dd>
         * <dt>actions</dt><dd>optional array of actions to play into the
         * hoard after the tree has been copied (if hoard: not set)</dd>
         * <dt>debug</dt><dd>optional debugging function</dd></dl>
         */
        constructor(options) {
            options = options || {};
            
            if (typeof options.debug === "function")
                this.debug = options.debug;

            // Actions played into this hoard and the
            // corresponding undos required to undo the actions played.
            // Each entry is { redo:, undo: }
            this.history = [];
            
            if (options.hoard) {
                // hoard: overrides tree: and actions:
                this.tree = options.hoard.tree;
                if (options.hoard.actions)
                    this.history = options.hoard.actions.map((a) => {
                        return { redo: new Action(a) };
                    });
                else
                    this.history = options.hoard.history.map((a) => {
                        return { redo: new Action(a.redo),
                                 undo: new Action(a.undo) };
                    });
            }
            else {
                if (options.tree)
                    this.tree = Hoard._copy_tree(options.tree);
                else
                    this.tree = { data: {}, time: Date.now() };

                if (options.actions)
                    // Play actions without adding to history
                    for (let act of options.actions)
                        this.play_action(act, false);
            }
        }

        /**
         * Clear the history
         * @return the events removed
         */
        clear_history() {
            let events = this.history;
            this.history = [];
            return events;
        }
        
        /**
         * @private
         * Deep copy a hoard tree
         */
        static _copy_tree(tree) {
            let node = {
                time: tree.time
            };
            if (tree.alarm)
                node.alarm = tree.alarm;
            if (tree.constraints)
                node.constraints = tree.constraints;
            if (typeof tree.data === "object") {
                node.data = {};
                for (let sub in tree.data) {
                    node.data[sub] = Hoard._copy_tree(tree.data[sub]);
                }
            } else if (tree.data)
                node.data = tree.data;
            return node;
        }
        
        /**
         * @private
         * Get the path of the given node. Depth-first search for the
         * node object.
         */
        _get_path(node) {
            function _dfe(node, path, tgt) {
                if (node == tgt)
                    return path;
                if (typeof node.data === "object")
                    for (let snn in node.data) {
                        let sr = _dfe(node.data[snn], path.concat(snn), tgt);
                        if (sr)
                            return sr;
                    }
                return undefined;
            }

            return _dfe(this.tree, [], node);
        }

        /**
         * @private
         * Record an action and its undo
         * @param type action type
         * @param path the path for the undo
         * @param time the time for the undo
         * @param act template for the undo (e.g. for data:, alarm: etc)
         */
        _record_event(redo, type, path, time, act) {
            if (!act)
                act = {};
            act.type = type;
            act.path = path.slice();
            act.time = time || Date.now();
            this.history.push({ redo: new Action(redo),
                                undo: new Action(act) });
        }
        
        /**
         * @private
         * Locate the node referenced by the given path in the tree
         * @param path path string, or path array
         * @param offset optional offset from the leaf e.g. 1 will
         * find the parent of the node identified by the path
         */
        _locate_node(path, offset) {
            if (typeof path === "string") {
                debugger;
                path = path.split("↘");
            }
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
         * Undo the action most recently played
         * @return a promise that resolves to an object thus:
         * {
         *   action: the action being played
         *   conflict: string message, only set if there is a problem.
         * }
         */
        undo() {
            Serror.assert(this.history.length > 0);
            let a = this.history.pop();
            if (this.debug) this.debug("Undo", a);
            
            // Replay the reverse of the action
            return this.play_action(a.undo, false);
        }
        
        /**
         * Return true if there is at least one undoable operation
         */
        can_undo() {
            return this.history.length > 0;
        }
        
        /**
         * Promise to play a single action into the tree.
         *
         * Action types:
         * <ul>
         * <li>'N' with no data - create collection</li>
         * <li>'N' with data - create leaf</li>
         * <li>'D' delete node, no data. Will delete the entire node tree.</li>
         * <li>'I' insert node, insert an entire node tree at a named node.</li>
         * <li>'E' edit node - modify the leaf data in a node</li>
         * <li>'R' rename node - data contains new name</li>
         * <li>'A' add alarm to node - data is the alarm time</li>
         * <li>'C' cancel alarm on node</li>
         * <li>'X' add/remove value constraints</li>
         * </ul>
         * Returns a conflict object if there was an error. This has two fields,
         * 'action' for the action record and 'message'.
         * @param {Action} action the action record
         * @param {boolean} undoable if true and action that undos this action
         * will be added to the undo history. Default is true.
         * @return a promise that resolves to an object thus:
         * {
         *   action: the action being played
         *   conflict: string message, only set if there is a problem.
         * }
         */
        play_action(action, undoable) {
            action = new Action(action);
            if (typeof undoable === "undefined")
                undoable = true;
            if (!action.time)
                action.time = Date.now();

            if (this.debug) this.debug("Play", action);

            function conflict(action, mess) {
                return Promise.resolve({
                    action: action,
                    conflict: TX.tx("$1 failed: $2", action.verbose(), mess)
                });
            }

            if (action.path.length === 0)
                return conflict(action, "Zero length path");

            let parent = this._locate_node(action.path, 1);
            // Path must always point to a valid parent pre-existing
            // in the tree. parent will never be null
            if (!parent)
                return conflict(action, TX.tx("not found"));

            let name = action.path[action.path.length - 1];
            // Node may be undefined e.g. if we are creating
            let node = parent.data[name];

            if (action.type === "N") { // New
                if (typeof parent.data !== "object")
                    return conflict(action,
                        TX.tx("Cannot add child to leaf node '$1'",
                              Action.pathS(action.path)));

                if (node)
                    // This is not really an error, we can survive it
                    // easily enough. However if we don't signal a
                    // conflict, the tree will be told to create a duplicate
                    // node, which it mustn't do.
                    return conflict(
                        action,
                        TX.tx("It was already created @ $1",
                              new Date(node.time)));

                if (undoable)
                    this._record_event(action, "D", action.path, parent.time);

                parent.time = action.time; // collection is being modified
                parent.data[name] = {
                    time: action.time,
                    data: (typeof action.data === "string") ?
                    action.data : {}
                };
            }
            else if (action.type === "I") { // Insert
                if (typeof parent.data !== "object")
                    return conflict(TX.tx("Cannot insert into a value"));
                let json = JSON.parse(action.data);
                if (undoable)
                    this._record_event(action, "D", action.path, action.time);
                
                parent.data[name] = json;
                // collection is being modified
                parent.time = action.time;
            }
            else { // all other actions require an existing node
                if (!node)
                    return conflict(action, TX.tx("it does not exist"));
                let new_parent;

                switch (action.type) {
                    
                case "A": // Alarm
                    if (undoable) {
                        if (typeof node.alarm === "undefined")
                            // Undo by cancelling the new alarm
                            this._record_event(action, "C", action.path,
                                              node.time);
                        else
                            this._record_event(action, "A", action.path,
                                              node.time, { alarm: node.alarm });
                    }
                    if (!action.data)
                        delete node.alarm;
                    else if (typeof action.data === "number"
                             || typeof action.data === "string") {
                        // Old format alarms had one number, number of
                        // days from last node change. New format has two,
                        // next ring in epoch MS, and repeat in MS.
                        
                        // Update to latest format
                        node.alarm = {
                            due: action.time + (action.data * MSPERDAY),
                            repeat: action.data * MSPERDAY };
                    }
                    else
                        node.alarm = action.data;
                    node.time = action.time;
                    break;

                case "C": // Cancel alarm
                    if (undoable)
                        this._record_event(action, "A", action.path,
                                          node.time, { alarm: node.alarm });
                    delete node.alarm;
                    node.time = action.time;
                    break;

                case "D": // Delete
                    if (undoable) {
                        this._record_event(action,
                            "I", action.path, parent.time,
                            { data: JSON.stringify(node) });
                    }
                    delete parent.data[name];
                    // collection is being modified
                    parent.time = action.time;
                    break;

                case "E": // Edit
                    if (undoable)
                        this._record_event(action, "E", action.path,
                                          node.time, { data: node.data });
                    node.data = action.data;
                    node.time = action.time;
                    break;

                case "M": // Move to another parent
                    // action.data is the path of the new parent
                    new_parent = this._locate_node(action.data);
                    if (!new_parent)
                        return conflict(
                            TX.tx("target folder '$1' does not exist",
                                  Action.pathS(action.data)));

                    if (new_parent.data[name])
                        return conflict(action, TX.tx("it already exists"));
                    
                    if (undoable) {
                        let from_parent = action.path.slice();
                        from_parent.pop();
                        this._record_event(
                            action,
                            "M", action.data.slice().concat([name]),
                            parent.time,
                            { data: from_parent });
                    }
                    
                    // collection is being modified
                    new_parent.time = parent.time = action.time;

                    delete parent.data[name];
                    new_parent.data[name] = node;
                    break;

                case "R": // Rename
                    if (parent.data[action.data])
                        return conflict(action, TX.tx("it already exists"));
                    if (undoable) {
                        let p = action.path.slice();
                        p[p.length - 1] = action.data;
                        this._record_event(
                            action, "R", p, parent.time, { data: name });
                    }
                    parent.data[action.data] = node;
                    delete parent.data[name];
                    // collection is being modified, node is not
                    parent.time = action.time;
                    break;

                case "X": // Constrain. Introduced in 2.0, however 1.0 code
                    // will simply ignore this action.
                    if (undoable) {
                        if (node.constraints)
                            this._record_event(
                                action, "X", action.path, node.time,
                                { data: node.constraints });
                        else
                            this._record_event(
                                action, "X", action.path, node.time);
                    }
                    if (!action.data)
                        delete node.constraints;
                    else
                        node.constraints = action.data;
                    node.time = action.time;
                    break;

                default:
                    // Version incomptibility?
                    Serror.assert(false, "Unrecognised action type");
                }
            }

            return Promise.resolve({ action: action });
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
         * Reconstruct the minimal action stream required to recreate
         * the data.  Actions will be 'N', 'A' and 'X'.
         * @return an array of actions
         */
        actions_to_recreate() {

            let actions = [];
            
            function _visit(node, path) {
                let time = node.time;

                if (typeof time === "undefined")
                    time = Date.now();

                if (path.length > 0) {
                    let action = new Action({
                        type: "N",
                        path: path,
                        time: time
                    });
                    
                    if (typeof node.data !== "object")
                        action.data = node.data;

                    actions.push(action);
                }

                if (node.alarm) {
                    // Use the node construction time on alarms too
                    actions.push(new Action({
                        type: "A",
                        path: path.slice(),
                        time: time,
                        data: node.alarm
                    }));
                }
                
                if (node.constraints) {
                    actions.push(new Action({
                        type: "X",
                        path: path.slice(),
                        time: time,
                        data: node.constraints
                    }));
                }

                if (typeof node.data === "object") {
                    for (let key in node.data)
                        _visit(node.data[key], path.concat([key]));
                }
            }

            _visit(this.tree, []);

            return actions;
        }

        /**
         * Simple search for differences between two hoards.  No
         * attempt is made to resolve complex changes, such as nodes
         * being moved. Each difference detected is reported using:
         * difference(action, a, b) where 'action' is the action required
         * to transform from the tree containing a to the tree with b, and
         * a and b are the tree nodes being compared. Actions used are
         * 'A', 'C', 'D', 'E', 'I' and 'X'
         */
        diff(b, difference) {
        
            function _diff(path, a, b, difference) {
                if (b.alarm !== a.alarm) {
                    if (!b.alarm)
                        difference({ type: "C", path: path }, a, b);
                    else
                        difference({ type: "A", path: path,
                                     alarm: b.alarm }, a, b);
                }
                if (b.constraints !== a.constraints)
                    difference({ type: "X", path: path,
                                 constraints: b.constraints }, a, b);
                if (typeof b.data === "object" && typeof a.data === "object") {
                    let matched = {}, subnode;
                    for (subnode in a.data) {
                        let subpath = path.concat([subnode]);
                        if (b.data[subnode]) {
                            matched[subnode] = true;
                            _diff(
                                subpath, a.data[subnode], b.data[subnode],
                                difference);
                        } else {
                            // TODO: look for the node elsewhere in b,
                            // it might have been moved or renamed
                            difference({ type: "D", path: subpath }, a, b);
                        }
                    }
                    for (subnode in b.data) {
                        if (!matched[subnode]) {
                            // TODO: look for the node elsewhere in a,
                            // it might have been moved or renamed
                            difference({type: "I", path: path,
                                        data: JSON.stringify({
                                            name: subnode,
                                            node: b.data[subnode] }) }, a, b);
                        }
                    }
                }
                else if (b.data !== a.data)
                    difference({ type: "E", path: path, data: b.data }, a, b);
            }

            _diff([], this.tree, b.tree, difference);
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
         * @return a promise that resolves to the number of changes that need
         * to be saved
         */
        check_alarms(ringfn) {

            if (!this.tree)
                return Promise.resolve();

            let checkAlarms = [{
                path: [],
                node: this.tree
            }];

            let promise = Promise.resolve();
            let changes = 0;
            
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
                    // Old format alarms had one number, number of
                    // days from last node change. New format has two,
                    // next ring in epoch MS, and repeat in MS.
                    if (typeof node.alarm === "number"
                        || typeof node.alarm === "string") {
                        
                        // Update to latest format
                        node.alarm = {
                            due: node.time + (node.alarm * MSPERDAY),
                            repeat: node.alarm * MSPERDAY
                        };
                        changes++;
                    }
                    
                    if (node.alarm.due > 0 && Date.now() >= node.alarm.due) {
                        let ding = new Date(node.alarm.due);
                        promise = promise.then(ringfn(item.path, ding));
                        if (node.alarm.repeat > 0)
                            // Update the alarm for the next ring
                            node.alarm.due = Date.now() + node.alarm.repeat;
                        else
                            // Disable the alarm (no repeat)
                            node.alarm.due = 0;
                        changes++;
                    }
                }
            }
            return promise.then(() => changes);
        }
    }

    return Hoard;
});
