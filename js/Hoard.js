/*@preserve Copyright (C) 2015-2021 Crawford Currie http://c-dot.co.uk license MIT*/
/* eslint-env browser,node */

define("js/Hoard", ["js/Node", "js/Action", "js/Translator", "js/Serror"], function(Node, Action, Translator, Serror) {
    let TX = Translator.instance();

	/**
	 * Object that represents the result of a `play_action`.
	 * @typedef Hoard.PlayResult
	 * @property {Action} action the action being played
	 * @property {string} conflict string message, only set if there is a
	 * problem. If this is undefined, the play succeeded.
	 */

	/**
	 * History of an action that was played into the hoard.
	 * @typedef Hoard.HistoryEvent
	 * @property {Action} redo - the action that was played
	 * @property {Action?} undo - the action that has to be played to undo
	 * the event, if it can be undone.
	 */

	/**
	 * Function called to ring an alarm.
	 * @callback Hoard.Ringer
	 * @param {string[]} path path of node being rung
	 * @param {number} date - due date for alarm
	 */

	/**
	 * Function called to play an action into the UI
	 * @callback Hoard.UIPlayer
	 * @param {Action} action - action to play
	 */

    /**
	 * A Hoard is a the database object used by Squirrel. It can be populated
	 * with a tree rooted at a {@link Node}, or a list of Action. 
     */
    class Hoard {

        /**
         * Constructor
         * @param {object} options
         * @param {Hoard=} options.hoard hoard to copy. Overrides
         * `option.tree`.
         * @param {Node=} options.tree tree to copy. Ignored if 
         * `options.hoard` is set.
         * @param {function=} options.debug debugging function, same
		 * signature as console.debug
         */
        constructor(options) {
            options = options || {};
            
            if (typeof options.debug === "function")
                this.debug = options.debug;

            /**
			 * Actions played into this hoard and the
             * corresponding undos required to undo the actions played.
             * Each entry is a {@link Hoard.HistoryEvent}
			 * @member {object[]}
			 */
            this.history = [];
            
			/**
			 * Root of tree
			 * @member {Node}
			 */
			this.tree = undefined;

			/**
			 * Actions played since the last sync
			 * @member {Action[]}
			 */
			this.actions = undefined;

            if (options.hoard) {
                // hoard: overrides tree:
                this.tree = new Node(options.hoard.tree);
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
            else
                this.tree = new Node(options.tree);
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
         * Record an action and its undo
         * @param {string} type action type
         * @param {string} path the path for the undo
         * @param {number] time the time for the undo
         * @param {object=} act template for passing to the {@link Action}
		 * constructor, for the undo (e.g. for data:, alarm: etc)
         * @private
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
         * Undo the action most recently played
         * @return {Hoard.PlayResult} the result
         */
        undo() {
            Serror.assert(this.history.length > 0);
            let a = this.history.pop();
            if (this.debug) this.debug("Undo", a);
            
            // Replay the reverse of the action
            return this.play_action(a.undo, false);
        }
        
        /**
         * Is there at least one undoable operation?
		 * @return {boolean}
         */
        can_undo() {
            return this.history.length > 0;
        }
        
        /**
         * Play a single action into the tree.
         * @param {Action} action the action to play
         * @param {boolean} [undoable=true] when true, an action that
         * undos this action will be added to the undo
         * history. Default is true.
		 * @param {Hoard.UIPlayer=} uiPlayer called to play actions that
		 * may need to be played into the UI. The replayer will normally
		 * invoke play_action() recursively.
         * @return {Hoard.PlayResult} result of the play
         */
        play_action(action, undoable, uiPlayer) {
            Serror.assert(action.path && action.path.length > 0);
            Serror.assert(action instanceof Action);

            if (typeof undoable !== 'boolean') {
				uiPlayer = undoable;
				undoable = true;
			}

            if (!action.time)
                action.time = Date.now();

            if (this.debug) this.debug("Play", action);

            const conflict = (mess) => {
                return {
                    action: action,
                    conflict: TX.tx("$1 failed: $2", action.verbose(), mess)
                };
            };

			// Make nodes on the path (including the end), adding history
			// as necessary.
			// Return the node at the end of the path
			const mkNode = (path, leaf) => {
				let p = [];
				for (let index = 0; index < path.length; index++) {
					p.push(path[index]);
					const node = this.tree.getNodeAt(p);
					if (!node) {
						const act = new Action({
							type: 'N',
							time: action.time,
							path: p.slice()
						});
						if (leaf && index === path.length - 1)
							act.data = "PLACEHOLDER";
						let e = this.play_action(act, undoable, uiPlayer);
						Serror.assert(!e.conflict, e.conflict);
					}
				}
				return this.tree.getNodeAt(path);
			};

            switch (action.type) {

            case 'N': { // New
				const node = this.tree.getNodeAt(action.path);
                if (node)
                    // This is not really an error, we can survive it
                    // easily enough. However if we don't signal a
                    // conflict, the tree will be told to create a duplicate
                    // node, which it mustn't do.
                    return conflict(
                        TX.tx("It was already created @ $1",
                              new Date(node.time)));

				const parent = mkNode(action.path.slice(0, -1));
                if (undoable)
                    this._record_event(action, 'D', action.path, parent.time);

                parent.time = action.time; // collection is being modified
                let nn = new Node({ time: action.time });
                if (typeof action.data === "string")
					// STEAL the action data
					nn.setValue(action.data);
				parent.addChild(action.path.slice(-1)[0], nn);
				break;
            }

			case 'I': { // Insert
                if (undoable)
                    this._record_event(action, 'D', action.path, action.time);
                
                let json = JSON.parse(action.data);
				const parent = mkNode(action.path.slice(0, -1));
                parent.time = action.time; // collection is being modified
				const name = action.path.slice(-1)[0];
                parent.addChild(name, new Node(json));
                // collection is being modified
                parent.time = action.time;
				break;
            }
                    
            case 'A': { // Alarm
				const node = action.data ?
					  mkNode(action.path, true)
					  : this.tree.getNodeAt(action.path);

				if (!node && !action.data)
					break; // NOP

				Serror.assert(node);

                if (undoable) {
                    if (typeof node.alarm === "undefined")
                        // Undo by cancelling the new alarm
                        this._record_event(action, 'C', action.path,
                                           node.time);
                    else
                        this._record_event(
							action, 'A', action.path,
                            node.time, { alarm: node.alarm });
                }
                if (action.data)
                    node.alarm = action.data;
				else
                    delete node.alarm;
                node.time = action.time;
                break;
			}

            case 'C': {
				const node = this.tree.getNodeAt(action.path);
				if (!node)
					return conflict(TX.tx("it does not exist"));
				// Cancel alarm
                if (undoable)
                    this._record_event(action, 'A', action.path,
                                       node.time, { alarm: node.alarm });
                delete node.alarm;
                node.time = action.time;
                break;
			}

            case 'D': { // Delete
				const node = this.tree.getNodeAt(action.path);
				if (!node)
					return conflict(TX.tx("it does not exist"));
				const parent = this.tree.getNodeAt(
					action.path.slice(0, -1));
                if (undoable) {
                    this._record_event(action,
									   'I', action.path, parent.time,
									   { data: JSON.stringify(node) });
                }
                parent.removeChild(action.path.slice(-1)[0]);
                // collection is being modified
                parent.time = action.time;
				break;
			}

            case 'E': { // Edit
				const node = mkNode(action.path, true);
				if (!node)
					return conflict(TX.tx("it does not exist"));
                if (undoable)
                    this._record_event(action, 'E', action.path,
                                       node.time, { data: node.value });
                node.setValue(action.data);
                node.time = action.time;
                break;
			}

            case 'M': {
				// Move to another parent
                // action.data is the path of the new parent
 				const node = this.tree.getNodeAt(action.path);
				if (!node)
					return conflict(TX.tx("it does not exist"));
				const new_parent = mkNode(action.data);
				const name = action.path.slice(-1)[0];
                if (new_parent.getChild(name))
                    return conflict(TX.tx("it already exists"));
                
				const parent = this.tree.getNodeAt(
					action.path.slice(0, -1));
                if (undoable) {
                    let from_parent = action.path.slice();
                    from_parent.pop();
                    this._record_event(
                        action,
                        'M', action.data.slice().concat([name]),
                        parent.time,
                        { data: from_parent });
                }
                
                // collection is being modified
                new_parent.time = parent.time = action.time;

                parent.removeChild(name);
                new_parent.addChild(name, node);
                break;
			}

            case 'R': {
				// Rename
 				const node = this.tree.getNodeAt(action.path);
				if (!node)
					return conflict(TX.tx("it does not exist"));
				const parent = this.tree.getNodeAt(
					action.path.slice(0, -1));
                if (parent.getChild(action.data))
                    return conflict(TX.tx("it already exists"));
				const name = action.path.slice(-1)[0];
                if (undoable) {
                    let p = action.path.slice();
                    p[p.length - 1] = action.data;
                    this._record_event(
                        action, 'R', p, parent.time, { data: name });
                }
                parent.addChild(action.data, node);
                parent.removeChild(name);
                // collection is being modified, node is not
                parent.time = action.time;
                break;
			}

            case 'X': {
				// Constrain. Introduced in 2.0, however 1.0 code
                // will simply ignore this action.
				const node = action.data ?
					  mkNode(action.path, true)
					  : this.tree.getNodeAt(action.path);

				if (!node && !action.data)
					break; // NOP

				Serror.assert(node);

                if (undoable) {
                    if (node.constraints)
                        this._record_event(
                            action, 'X', action.path, node.time,
                            { data: node.constraints });
                    else
                        this._record_event(
                            action, 'X', action.path, node.time);
                }
                if (action.data)
                    node.constraints = action.data;
				else
                    delete node.constraints;
                node.time = action.time;
                break;
			}

            default:
                // Version incomptibility?
                Serror.assert(false, "Unrecognised action type");
            }

			// Play the action into the UI
			if (uiPlayer)
				uiPlayer(action);

            return { action: action }; // Hoard.PlayResult
        }

		/**
		 * Play a list of actions into the hoard in order.
         * @param {Array.<Action>} actions - actions to play
         * into the hoard.
		 * @param {boolean} [undoable=true] add undos for all actions
		 * played into the hoard.
		 * @param {Hoard.UIPlayer=} uiPlayer called to play actions that
		 * may need to be played into the UI.
		 * @return {string[]} a list of conflict messages.
		 */
		play_actions(actions, undoable, uiPlayer) {
            if (typeof undoable !== 'boolean') {
				uiPlayer = undoable;
				undoable = true;
			}
			const conflicts = [];
			for (let act of actions) {
				const pr = this.play_action(act, undoable, uiPlayer);
				if (pr.conflict)
					conflicts.push(pr.conflict);
			}
			return conflicts;
		}

        /**
         * Reconstruct the minimal action stream required to recreate
         * the data.  Actions will be 'N', 'A' and 'X'.
         * @return {Action[]} an action stream
         */
        actions_to_recreate() {

            let actions = [];
            
            function _visit(node, path) {
                let time = node.time;

                if (typeof time === "undefined")
                    time = Date.now();

                if (path.length > 0) {
                    let action = new Action({
                        type: 'N',
                        path: path,
                        time: time
                    });
                    
                    if (typeof node.value !== 'undefined')
                        action.data = node.value;

                    actions.push(action);
                }

                if (node.alarm) {
                    // Use the node construction time on alarms too
                    actions.push(new Action({
                        type: 'A',
                        path: path.slice(),
                        time: time,
                        data: node.alarm
                    }));
                }
                
                if (node.constraints) {
                    actions.push(new Action({
                        type: 'X',
                        path: path.slice(),
                        time: time,
                        data: node.constraints
                    }));
                }

                node.eachChild((name, node) => 
							   _visit(node, path.concat([name])));
            }

            _visit(this.tree, []);

            return actions;
        }

        /**
         * Return the tree node identified by the path.
         * @param {string[]} path - array of path elements, root first
         * @return {Node?} a tree node, or null if not found.
         */
        get_node(path) {
            return this.tree.getNodeAt(path);
        }

        /**
         * Promise to check all alarms. Returns a promise to resolve all the
         * promises returned by 'ring'.
         * @param {Hoard.Ringer} ringfn ring function([], Date)
         * @return {Promise} Promise that resolves to the number of
         * changes that need to be saved
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
				node.eachChild((name, snode) => {
                    checkAlarms.push({
                        node: snode,
                        path: item.path.slice().concat([name])
                    });
                });

                if (typeof node.alarm !== "undefined"                   
                    && node.alarm.due > 0
					&& Date.now() >= node.alarm.due) {
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
            return promise.then(() => changes);
        }
    }

    return Hoard;
});
