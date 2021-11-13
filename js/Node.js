/*@preserve Copyright (C) 2015-2021 Crawford Currie http://c-dot.co.uk license MIT*/
/* eslint-env browser,node */

define("js/Node", [
	"js/Action", "js/Translator", "js/Serror"
], (
	Action, Translator, Serror
) => {

    const MSPERDAY = 24 * 60 * 60 * 1000;

	/**
	 * A node in a hoard tree.
	 */
	class Node {

		/**
		 * Called on differences with the action required to resolve
		 * the difference.
		 * @callback Node.Differ
		 * @param {Action} action
		 */

		/**
		 * Called on each child node by `eachChild`
		 * @callback Node.Each
		 * @param {string} name - child node name
		 * @param {Node} node - child node
		 * @return {object?} anything except undefined will terminate
		 * the iteration.
		 */

		/**
		 * Construct from another node, or a plain object that has the
		 * node member fields. If there are subnodes, will deep copy them.
		 * @param {Node|object} Node or plain object
		 */
		constructor(data) {
			data = data || { time: Date.now() };

			/**
			 * Time of the last modification (epoch ms)
			 * @member {integer}
			 */
            this.time = data.time;
			
            if (typeof data.alarm === "string") {
                // Compatibility
				const mid = data.alarm.indexOf(';');
				if (mid > 0) {
					this.alarm = {
						due: Number.parseInt(data.alarm.substr(0, mid)),
						repeat: Number.parseInt(data.alarm.substr(mid + 1))
					};
				} else {
					this.alarm = {
						due: this.time + (data.alarm * MSPERDAY),
						repeat: data.alarm * MSPERDAY
					};
				}
			}
            else if (typeof data.alarm === "number") {
                // Compatibility
                this.alarm = {
                    due: this.time + (data.alarm * MSPERDAY),
                    repeat: data.alarm * MSPERDAY
                };
            }
			else if (typeof data.alarm !== "undefined") {
				/**
				 * Time of next alarm, `{due:number, repeat:number}`
				 * @member {object}
				 */
                this.alarm = data.alarm;
			}

			if (typeof data.constraints === "string") {
				const mid = data.constraints.indexOf(';');
				this.constraints = {
					size: Number.parseInt(data.constraints.substr(0, mid)),
					chars: data.constraints.substr(mid + 1)
				};
			}
            else if (typeof data.constraints !== "undefined") {
				/**
				 * Constraints, `{size:number, chars:string}`
				 * @member {string} constraints
				 */
                this.constraints = data.constraints;
			}

			/**
			 * Collection of subnodes indexed by subnode name
			 */
            if (data.children) {
				this.children = {};
                for (let sub in data.children)
                    this.children[sub] = new Node(data.children[sub]);
            }

			/**
			 * Leaf (non-object) data
			 * @member {string}
			 */
            if (typeof data.value !== 'undefined')
				this.value = data.value;

			// Compatibility. The dual-use 'data' field has been
			// replaced by ;children' and 'value', but may persist
			// in some hoards.
			else if (typeof data.data === 'string') {
				console.log(`Warning: old format Node leaf data`);
				this.setValue(data.data);
			} else if (typeof data.data === 'object') {
				Serror.assert(!this.children);
				this.children = {};
				console.log(`Warning: old format Node child data`);
                for (let sub in data.data)
                    this.children[sub] = new Node(data.data[sub]);
			}
		}

		/**
		 * Get the named child node
		 * @param {string} name - name of the child node
		 * @return {Node?} the child node, or undefined
		 */
		getChild(name) {
			if (!this.children)
				return undefined;
			return this.children[name];
		}

		/**
		 * Set the named child node.
		 * @param {string} name - name of the child node
		 * @param {Node} name - the child node to add
		 * @throw Error if the child name is already used
		 */
		addChild(name, child) {
			if (!this.children)
				this.children = {};
			if (typeof this.children[name] !== 'undefined')
				throw new Error(`Child ${name} is already there`);
			this.children[name] = child;
		}

		/**
		 * Remove the named child node.
		 * @param {(string|Node)} node - the child node, or it's name
		 * @throw Error if the child name is not there
		 */
		removeChild(node) {
			if (typeof node !== 'string')
				node = this.children.indexOf(node);
			if (!this.children || typeof this.children[node] === 'undefined')
				throw new Error(`Child ${node} is not there`);
			delete this.children[node];
			if (Object.keys(this.children).length === 0)
				delete this.children;
		}

		/**
		 * Visit children. Terminate if cb returns non-undefined.
		 * Note that the visit is unordered.
		 * @param {Node.Each}cb callback
		 * @return {object?} undefined if the visit completed, or
		 * the result of `cb` if it terminated early
		 */
		eachChild(cb) {
			if (!this.children)
				return undefined;
			for (let snn in this.children) {
				const res = cb(snn, this.children[snn]);
				if (typeof res !== 'undefined')
					return res;
			}
			return undefined;
		}

		/**
		 * Get the path of the given node, relative to this
		 */
		getPathTo(node) {
			if (this === node)
				return [];
			if (this.children) {
				for (let snn in this.children) {
					const sr = this.children[snn].getPathTo(node);
					if (sr)
						return [ snn ].concat(sr);
				}
			}
 			return undefined;
		}

		/**
		 * Set the leaf value for this node
		 * @param {string?} value the value
		 */
		setValue(value) {
			if (typeof value !== 'undefined')
				this.value = value;
			else
				delete this.value;
		}

        /**
         * Get the node referenced by the given path relative
		 * to this node.
         * @param {string|string[]} path - path string, or path array
         * @param {number} [offset=0] - offset from the leaf e.g. 1 will
         * find the parent of the node identified by the path
		 * @return {Node?} the node found, or undefined if not found
         */
 		getNodeAt(path, offset) {
            if (typeof path === "string")
                path = path.split(Action.PATH_SEPARATOR);

            offset = offset || 0;

            let node = this;
            offset = offset || 0;

            for (let i = 0; i < path.length - offset; i++) {
                const name = path[i];
                if (node && node.children && node.children[name])
                    node = node.children[name];
				else 
                    return undefined;
            }
            return node;
		}

        /**
		 * Simple search for differences between two node trees.  No
         * attempt is made to resolve complex changes, such as nodes
         * being moved. Each difference detected is reported using:
         * `difference(action, a, b)` where `action` is the action required
         * to transform from `this` to the other tree, and
         * `a` and `b` are the tree nodes being compared. Actions used are
         * `A`, `D`, `E`, `I` and `X`
		 * @param {string[]} path the path to `this` (and `b`)
		 * @param {Node} b the Node to compare
		 * @param {Node.Differ} difference handler function
		 */
		diff(path, b, difference) {
            if (b.alarm && !this.alarm
				|| !b.alarm && this.alarm
				|| this.alarm
				&& (this.alarm.due !== b.alarm.due
					|| this.alarm.repeat != b.alarm.repeat)) {
                difference(new Action({
					type: 'A',
					path: path,
					alarm: b.alarm
				}), this, b);
            }

            if (b.constraints && !this.constraints
				|| !b.constraints && this.constraints
				|| this.constraints
				&& (b.constraints.size !== this.constraints.size
				   || b.constraints.chars !== this.constraints.chars))
                difference(new Action({
					type: 'X',
					path: path,
                    constraints: b.constraints
				}), this, b);

            if (b.value !== this.value)
                difference(new Action({
					type: 'E',
					path: path,
					data: b.value
				}), this, b);

            const matchedChild = {};
			let subnode;
			if (this.children) {
				for (subnode in this.children) {
					let subpath = path.concat([subnode]);
					if (b.children[subnode]) {
						matchedChild[subnode] = true;
						this.children[subnode].diff(
							subpath, b.children[subnode], difference);
					} else {
						// TODO: look for the node elsewhere in b,
						// it might have been moved or renamed
						difference(new Action({
							type: 'D',
							path: subpath
						}), this, b);
					}
				}
			}

            if (b.children) {
				for (subnode in b.children) {
					if (!matchedChild[subnode]) {
						// TODO: look for the node elsewhere in a,
						// it might have been moved or renamed
						difference(new Action({
							type: 'I',
							path: path,
							data: JSON.stringify({
								name: subnode,
								node: b.children[subnode] })
						}), this, b);
					}
				}
            }
        }
	} return Node;
});
