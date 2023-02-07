/*@preserve Copyright (C) 2015-2023 Crawford Currie http://c-dot.co.uk license MIT*/
/* eslint-env browser */

import { Serror} from "./Serror.js";

const MSPERDAY = 24 * 60 * 60 * 1000;

function deltaTimeString(from, to, hms) {
  const deltaDate = new Date(to - from);
  const s = [];

  let delta = deltaDate.getUTCFullYear() - 1970;
  if (delta > 0)
    s.push($.i18n("numyears", delta));

  // Normalise to year zero
  deltaDate.setUTCFullYear(1970);

  delta = deltaDate.getUTCMonth();
  if (delta > 0)
    s.push($.i18n("nummonths", delta));

  // Normalise to the same month (January)
  deltaDate.setUTCMonth(0);

  delta = deltaDate.getUTCDate();
  if (delta > 0 || s.length === 0)
    s.push($.i18n("numdays", delta));

  if (hms)
    s.push(`00${deltaDate.getUTCHours()}`.slice(-2)
           + ":" + `00${deltaDate.getUTCMinutes()}`.slice(-2)
           + ":" + `00${deltaDate.getUTCSeconds()}`.slice(-2));
	
  return s.join(" ");
}

/**
 * An action performed on a Hoard
 */
class Action {
  
  static PATH_SEPARATOR = "↘";

  /**
   * Construct a new action object.
   * @param {(Action|object)} proto an Action to clone, or a
   * simple object with type, path, time and data fields.
	 * Note that actions on the root (empty path) are not supported.
   */
  constructor({ type, path, time = Date.now(), data } = {}) {
		/**
		 * Action type - a single character identifying code
		 * * "N" with no data - create collection
		 * * "N" with data:string - create leaf
		 * * "D" delete node, no data. Will delete the entire node tree.
		 * * "I" insert node, data:Node, insert an entire node tree
		 * at a named node.
		 * * "E" edit node, data:string, modify the leaf data in a node
		 * * "R" rename node, data:string contains new name
		 * * "A" add alarm, data:{due:number, repeat:number}
		 *   Old format had data:number, number of days from last node
		 *   change, will be automatically updated when played. Undefined data
     *   will cancel the alarm.
		 * * "C" cancel alarm on node, no data (retained for compatibility,
     *   replaced by "A" with no data
		 * * "X" with data, add value constraints
		 * * "X" with no data, remove value constraints
     * @member {string}
		 */
		this.type = type;

		/**
		 * Path to node the action applies to
		 * @member {string}
		 */
		this.path = undefined;
		if (typeof path === 'string')
			this.path = path.split(Action.PATH_SEPARATOR);
    else if (typeof path !== 'undefined')
      this.path = path.slice();

		Serror.assert(this.path/* && this.path.length > 0*/);

		/**
		 * Time of action, defaults to `now`, epoch s
		 * @member {number}
		 */
    this.time = time;

		/**
		 * Data associated with the action. The interpretation
		 * depends on the type of the action.
		 * @member {string|object}
		 */
    if (typeof data !== 'undefined') {
			// Compatibility with old formats
			if (this.type === "A") {
				if (typeof data === 'string') {
					const mid = data.indexOf(";");
					if (mid > 0) {
						this.data = {
							due: Number.parseInt(data.substr(0, mid)),
							repeat: Number.parseInt(data.substr(mid + 1))
						};
					} else {
						const t = Number.parseInt(data);
						this.data = {
							due: this.time + (t * MSPERDAY),
							repeat: t * MSPERDAY
						};
					}
				}
				else if (typeof data === 'number') {
					this.data = {
						due: this.time + (data * MSPERDAY),
						repeat: data * MSPERDAY
					};
				}
				else if (typeof data === 'object'
							   && typeof data.time === 'number') {
					this.data = {
						due: data.time,
						repeat: 0
					};
				} else {
					Serror.assert(typeof data.due === 'number');
					Serror.assert(typeof data.repeat === 'number');
					this.data = data;
				}
			}
			else if (this.type === "X"
						   && typeof data === 'string') {
				const mid = data.indexOf(";");
				this.data = {
					size: Number.parseInt(data.substr(0, mid)),
					chars: data.substr(mid + 1)
				};
			}
			else
				this.data = data;
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
    case "A":
			if (this.data) {
				s = $.i18n("add_reminder",
							     new Date(this.data.due).toLocaleString(),
							     (this.data.repeat === 0)
                   ? ""
                   : " " +
							     $.i18n("repeat_every",
                          deltaTimeString(0, this.data.repeat)),
							     p);
			} else
				s = $.i18n("cancel_reminder", p);
      break;
    case "C": // retained for compatibility
      s = $.i18n("cancel_reminder", p);
      break;
    case "D":
      s = $.i18n("Delete $1", p);
      break;
    case "E":
      s = $.i18n("change_val", p, this.data);
      break;
    case "I":
      s = $.i18n("Insert $1 = $2", p, this.data);
      break;
    case "M":
      s = $.i18n("Move $1 to $2", p, Action.pathS(this.data));
      break;
    case "N":
      s = $.i18n("Create $1", p);
      break;
    case "R":
      s = $.i18n("rename_x_y", p, this.data);
      break;
    case "X":
      if (this.data)
        s = $.i18n("constrain_chars",
                   p, this.data.size, this.data.chars);
      else
        s = $.i18n("clear-cons", p);
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
            aact.path.join("/") === bact.path.join("/") &&
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

export { Action }
