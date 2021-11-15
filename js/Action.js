/*@preserve Copyright (C) 2015-2021 Crawford Currie http://c-dot.co.uk license MIT*/
/* eslint-env browser,node */

define("js/Action", ["js/Translator", "js/Serror"], function(Translator, Serror) {

    const MSPERDAY = 24 * 60 * 60 * 1000;
    const TX = Translator.instance();

	/**
	 * An action performed on a Hoard
	 */
    class Action {
        
        /**
         * Construct a new action object.
         * @param {(Action|object)} proto an Action to clone, or a
         * simple object with type, path, time and data fields.
		 * Note that actions on the root (empty path) are not supported.
         */
        constructor(proto) {
			/**
			 * Action type - a single character identifying code
			 * * 'N' with no data - create collection
			 * * 'N' with data:string - create leaf
			 * * 'D' delete node, no data. Will delete the entire node tree.
			 * * 'I' insert node, data:Node, insert an entire node tree
			 * at a named node.
			 * * 'E' edit node, data:string, modify the leaf data in a node
			 * * 'R' rename node, data:string contains new name
			 * * 'A' add alarm, data:{due:number, repeat:number}
			 * Old format had data:number, number of days from last node
			 * change, will be automatically updated when played.
			 * * 'C' cancel alarm on node, no data
			 * * 'X' with data, add value constraints
			 * * 'X' with no data, remove value constraints
             * @member {string}
			 */
			this.type = proto.type;

			/**
			 * Path to node the action applies to
			 * @member {string}
			 */
			this.path = undefined;
			if (typeof proto.path === 'string')
				this.path = proto.path.split(Action.PATH_SEPARATOR);
            else if (typeof proto.path !== "undefined")
                this.path = proto.path.slice();

			Serror.assert(this.path && this.path.length > 0);

			/**
			 * Time of action, defaults to `now`, epoch s
			 * @member {number}
			 */
            this.time = proto.time ? proto.time : Date.now();

			/**
			 * Data associated with the action. The interpretation
			 * depends on the type of the action.
			 * @member {string|object}
			 */
            if (typeof proto.data !== "undefined") {
				// Compatibility with old formats
				if (this.type === 'A') {
					if (typeof proto.data === 'string') {
						const mid = proto.data.indexOf(';');
						if (mid > 0) {
							this.data = {
								due: Number.parseInt(proto.data.substr(0, mid)),
								repeat: Number.parseInt(proto.data.substr(mid + 1))
							};
						} else {
							const t = Number.parseInt(proto.data);
							this.data = {
								due: this.time + (t * MSPERDAY),
								repeat: t * MSPERDAY
							};
						}
					}
					else if (typeof proto.data === 'number') {
						this.data = {
							due: this.time + (proto.data * MSPERDAY),
							repeat: proto.data * MSPERDAY
						};
					}
					else if (typeof proto.data === 'object'
							 && typeof proto.data.time === 'number') {
						this.data = {
							due: proto.data.time,
							repeat: 0
						};
					} else {
						Serror.assert(typeof proto.data.due === 'number');
						Serror.assert(typeof proto.data.repeat === 'number');
						this.data = proto.data;
					}
				}
				else if (this.type === 'X'
						   && typeof proto.data === 'string') {
					const mid = proto.data.indexOf(';');
					this.data = {
						size: Number.parseInt(proto.data.substr(0, mid)),
						chars: proto.data.substr(mid + 1)
					};
				}
				else
					this.data = proto.data;
			}
        }

        /**
         * Generate a path string from an array of path elements
         * @param terminate boolean true to append separator to end of path
		 * @return {string} path string
         */
        static pathS(p, terminate) {
            return p.join(Action.PATH_SEPARATOR)
			+ (terminate ? Action.PATH_SEPARATOR : "");
        }
        
        /**
         * Generate a florid description of the action for using in dialogs
         * @return {string} human readable description of action
         */
        verbose() {
            const p = Action.pathS(this.path);
            let s;
            switch (this.type) {
            case 'A':
                s = TX.tx("Add reminder on $1$2 to $3",
                          new Date(this.data.due).toLocaleString(),
                          (this.data.repeat === 0)
                              ? ""
                              : TX.tx(" (repeat every $1)",
                                  TX.deltaTimeString(0, this.data.repeat)),
                          p);
                break;
            case 'C':
                s = TX.tx("Cancel reminder on $1", p);
                break;
            case 'D':
                s = TX.tx("Delete $1", p);
                break;
            case 'E':
                s = TX.tx("Change value of $1 to '$2'", p, this.data);
                break;
            case 'I':
                s = TX.tx("Insert $1 = $2", p, this.data);
                break;
            case 'M':
                s = TX.tx("Move $1 to $2", p, Action.pathS(this.data));
                break;
            case 'N':
                s = TX.tx("Create $1", p);
                break;
            case 'R':
                s = TX.tx("Rename $1 to '$2'", p, this.data);
                break;
            case 'X':
                if (this.data)
                    s = TX.tx("Constrain $1 to $2 character$?($2!=1,s,) from $3",
                              p, this.data.size, this.data.chars);
                else
                    s = TX.tx("Clear constraints");
                break;
            }
            return s;
        }

        /**
         * Generate a terse string version of the action for reporting
         * @return {string} human readable description of action
         */
        toString() {
            return `${this.type}:${Action.pathS(this.path)}`
            + (this.data ? ` '${this.data}'` : "")
            + ` @${new Date(this.time).toLocaleString()}`;
        }

        /**
         * Merge two action streams in time order. Duplicate actions
         * are merged. The input action streams will be irretrievably damaged.
         * @param {Action[]} a the first action stream to merge
         * @param {Action[]} b the second action stream to merge
         * @return {Action[]} the merged action stream, sorted in time
         * order. Note that the action objects in a and b are
         * preserved for use here
         */
        static mergeStreams(a, b) {

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
            const c = [];
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
    }

    Action.PATH_SEPARATOR = '↘';

    return Action;
});

