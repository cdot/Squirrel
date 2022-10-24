/*@preserve Copyright (C) 2015-2021 Crawford Currie http://c-dot.co.uk license MIT*/
/* eslint-env browser,node */

define("js/Hoard", [
	"js/Node", "js/Action", "js/Serror",
  "i18n"
], (
	Node, Action, Serror
) => {

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
	 * Function that plays an action into the UI
	 * @callback Hoard.UIPlayer
	 * @param {Action} action - action to play
	 * @return {Promise} a promise to play the action into the UI
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
      
      if (typeof options.debug === 'function')
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
          this.history = options.hoard.actions.map(a => {
            return { redo: new Action(a) };
          });
        else
          this.history = options.hoard.history.map(a => {
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
      const events = this.history;
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
     * Undo the action most recently played.
		 * @param {object=} options options passed to {@link Hoard#play_action}.
		 * `undoable` is forced to `false`
     * @return {Promise} Promise that resolves to undefined.
     */
    undo(options) {
			options = options || {};
      if (this.history.length === 0)
				return Promise.reject(new Error($.i18n("Nothing to undo")));
      const a = this.history.pop();
      if (this.debug) this.debug("undo", a);
      
			// Don't stack an undo for the undo.
			options.undoable = false;
      // Replay the undo.
      return this.play_action(a.undo, options);
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
		 * @param {object} options control options
     * @param {boolean} [options.undoable=true] when true, an action that
     * undos this action will be added to the undo
     * history. Default is true.
		 * @param {boolean} [options.autocreate=false] controls whether missing
		 * nodes are reported as errors, or are automatically created.
		 * @param {Hoard.UIPlayer=} options.uiPlayer called to play
		 * actions into a UI.
     * @return {Promise} Promise that will resolve to undefined
     */
    play_action(action, options) {
      Serror.assert(action.path && action.path.length > 0);
      Serror.assert(action instanceof Action);

      options = options || {};

			if (typeof options.undoable !== 'boolean')
				options.undoable = true;
			if (typeof options.autocreate !== 'boolean')
				options.autocreate = false;

      if (!action.time)
        action.time = Date.now();

      if (this.debug) this.debug("Play", action);

			// Conflict messages are wrapped in an error simply because
			// it's easier to debug them that way.
      const conflict = mess =>
				    Promise.reject(
					    new Error($.i18n("act_failed", action.verbose(), mess)));

			// Make nodes on the path (including the end), adding history
			// as necessary.
			// path to the node
			// forceMake - forces creation of the node.
			// Return Promise to create node path
			const mkNode = (path, forceMake) => {
				const node = this.tree.getNodeAt(path);
				if (!node && (options.autocreate || forceMake)) {
					Serror.assert(path.length > 0);
					return mkNode(path.slice(0, -1), forceMake)
					.then(parent => {
						let act = new Action({
							type: 'N',
							time: action.time,
							path: path
						});
						if (action.type === 'N'
							  && path.length === action.path.length)
							act = action;
						if (options.undoable)
							// It was just created, and we want an undo
							this._record_event(act, 'D', path, parent.time);
						const nn = new Node({ time: action.time });
						//if (this.debug) this.debug(`making ${path} at `,new Date(nn.time));
						parent.addChild(path[path.length - 1], nn);
						parent.time = action.time;
						if (options.uiPlayer) {
							return options.uiPlayer(act)
							.then(() => nn);
						}
						else
							return nn;
					});
				} else if (node)
					return Promise.resolve(node);
				else
					return conflict($.i18n("not_exist", path.join(Action.PATH_SEPARATOR)));
			};

			let promise;

      switch (action.type) {

      case 'N': { // New
				// return because mkNode handles calling the uiPlayer
				return mkNode(action.path, true)
				.then(node => {
					if (typeof action.data === 'string') {
						// STEAL the action data
						node.setValue(action.data);
						node.time = action.time;
					}
				});
			}

			case 'I': { // Insert
        if (options.undoable)
          this._record_event(action, 'D', action.path, action.time);
        
				const node = this.tree.getNodeAt(action.path);
				if (node)
					return conflict($.i18n("already_exists"));

				const json = JSON.parse(action.data);
				promise = mkNode(action.path.slice(0, -1), false)
				.then(parent => {
					parent.time = action.time; // collection is being modified
					const name = action.path[action.path.length - 1];
					parent.addChild(name, new Node(json));
					// collection is being modified
					parent.time = action.time;
				});
				break;
      }
        
      case 'A': { // Alarm
				promise = (action.data ? mkNode(action.path, false)
						       : Promise.resolve(this.tree.getNodeAt(action.path)))
				.then(node => {
					if (!node && action.data)
						return conflict($.i18n("not_exist", action.path.join(Action.PATH_SEPARATOR)));
					if (options.undoable) {
						if (typeof node.alarm === 'undefined')
							// Undo by cancelling the new alarm
							this._record_event(action, 'C', action.path,
											           node.time);
						else
							this._record_event(
								action, 'A', action.path,
								node.time, { alarm: node.alarm });
					}
					
					if (node) {
						if (action.data)
							node.alarm = action.data;
						else
							delete node.alarm;
						node.time = action.time;
					}
          return undefined;
				});
        break;
			}

      case 'C': {
				// Compatibility, replaced by 'A' with undefined data
				const node = this.tree.getNodeAt(action.path);
				if (!node)
					return conflict($.i18n("not_exist", action.path.join(Action.PATH_SEPARATOR)));
				// Cancel alarm
        if (options.undoable)
          this._record_event(action, 'A', action.path,
                             node.time, { alarm: node.alarm });
        delete node.alarm;
        node.time = action.time;
        break;
			}

      case 'D': { // Delete
				const node = this.tree.getNodeAt(action.path);
				if (!node)
					return conflict($.i18n("not_exist", action.path.join(Action.PATH_SEPARATOR)));

				const parent = this.tree.getNodeAt(
					action.path.slice(0, -1));
				if (options.undoable) {
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
				promise = mkNode(action.path, false)
				.then(node => {
					if (options.undoable)
						this._record_event(action, 'E', action.path,
										           node.time, { data: node.value });
					node.setValue(action.data);
					node.time = action.time;
				});
        break;
			}

      case 'M': {
				// Move to another parent
        // action.data is the path of the new parent
 				const node = this.tree.getNodeAt(action.path);
				if (!node)
					return conflict($.i18n("not_exist", action.path.join(Action.PATH_SEPARATOR)));
				promise = mkNode(action.data, false)
				.then(new_parent => {
					const name = action.path.slice(-1)[0];
					if (new_parent.getChild(name))
						return conflict($.i18n("already_exists"));
          
					const parent = this.tree.getNodeAt(
						action.path.slice(0, -1));
					if (options.undoable) {
						const from_parent = action.path.slice();
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
					return Promise.resolve();
				});
        break;
			}

      case 'R': {
				// Rename
 				const node = this.tree.getNodeAt(action.path);
				if (!node)
					return conflict($.i18n("not_exist", action.path.join(Action.PATH_SEPARATOR)));

				const parent = this.tree.getNodeAt(
					action.path.slice(0, -1));
				if (parent.getChild(action.data))
					return conflict($.i18n("already_exists"));
				const name = action.path.slice(-1)[0];
				if (options.undoable) {
					const p = action.path.slice();
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
				// Constrain.
				promise = (action.data ?
						       mkNode(action.path, false)
						       : Promise.resolve(this.tree.getNodeAt(action.path)))
				.then(node => {

					if (node) {
						if (options.undoable) {
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
					}
				});
        break;
			}

      default:
        // Version incompatibility?
        Serror.assert(false, "Unrecognised action type");
      }

			if (!promise)
				promise = Promise.resolve();
			
			return promise
			.then(() => (options.uiPlayer
						       ? options.uiPlayer(action)
						       : Promise.resolve()));
    }

		/**
		 * Play a list of actions into the hoard in order.
     * @param {Array.<Action>} actions - actions to play
     * into the hoard.
		 * @param {object=} options options passed to play_action
		 */
		async play_actions(actions, options) {
      options = options || {};

			const conflicts = [];
			for (let act of actions) {
				await this.play_action(act, options)
				.catch(e => conflicts.push(e));
			}
			return conflicts;
		}

    /**
     * Reconstruct the minimal action stream required to recreate
     * the data.  Actions will be 'N', 'A' and 'X'.
		 * @param {boolean} [includeRoot=false] normally the root node
		 * of the hoard is not included in the actions list. Set this
		 * to make it included.
     * @return {Action[]} an action stream
     */
    actions_to_recreate(includeRoot) {

      const actions = [];
      
      function _visit(node, path) {
        let time = node.time;

        if (typeof time === 'undefined')
          time = Date.now();

        if (includeRoot || path.length > 0) {
          const action = new Action({
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

      const checkAlarms = [{
        path: [],
        node: this.tree
      }];

      let promise = Promise.resolve();
      let changes = 0;
      
      while (checkAlarms.length > 0) {
        const item = checkAlarms.pop();
        const node = item.node;
				node.eachChild((name, snode) => checkAlarms.push({
          node: snode,
          path: item.path.slice().concat([name])
        }));

        if (typeof node.alarm !== 'undefined'                   
            && node.alarm.due > 0
					  && Date.now() >= node.alarm.due) {
          const ding = new Date(node.alarm.due);
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
