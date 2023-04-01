/*@preserve Copyright (C) 2015-2023 Crawford Currie http://c-dot.co.uk license MIT*/
/* eslint-env browser,node */

import { Utils } from "../common/Utils.js";
import { Serror } from "../common/Serror.js";
import { AbstractStore } from "./AbstractStore.js";

// Unique (hopefully!) string used to identify the boundary between
// path and username in keys
const ROOT_PATH = "50C1BBE1";

/**
 * A store engine using browser localStorage.
 * @extends AbstractStore
 */
class LocalStorageStore extends AbstractStore {

	/**
	 * See {@link AbstractStore} for other constructor options.
	 */
  constructor(p) {
    super(p);
    this.type = "LocalStorageStore";
  }

	/**
	 * @override
	 */
  init() {

    // See if we can spot a possible user, identified by a personal
    // identifier. Note that if this is a client store and cloud
    // initialisation worked, then the user should already be set.
    if (typeof this.option("user") === 'undefined') {
      let i = 0;
      let key;
      let poss_user = null;
      const re = new RegExp(`^(.*)\\.${ROOT_PATH}`);
      while ((key = localStorage.key(i)) != null) {
        const m = re.exec(key);
        if (m) {
          if (poss_user) {
            if (this.debug) this.debug(
              "No unique user", poss_user, m[1]);
            poss_user = null;
            break;
          } else {
            poss_user = m[1];
            if (this.debug) this.debug(
              "Possible user", poss_user);
          }
        }
        i++;
      }
      if (poss_user !== null) {
        this.option("user", poss_user);
      } else if (this.debug)
        this.debug("Could not identify a unique user");
    }

    return super.init();
  }

	/**
	 * Make a key that uniquely identifies the given path and the
	 * current user (if any).
	 * @private
	 */
  _makeKey(path) {
    const key = [];
    if (typeof this.option("user") !== 'undefined')
      key.push(this.option("user"));
    key.push(ROOT_PATH);
    key.push(path);
    return key.join(".");
  }

	/**
	 * @override
	 */
  reads(path) {
    const str = localStorage.getItem(this._makeKey(path));
    if (str === null)
      return Promise.reject(new Serror(
        404, `${path} does not exist in LocalStorageStore`));
    return Promise.resolve(str);
  }

	/**
	 * @override
	 */
  writes(path, str) {
    localStorage.setItem(this._makeKey(path), str);
    return Promise.resolve();
  }

	/**
	 * @override
	 */
  read(path) {
    return this.reads(path)
    .then(str => {
			const u8 = Utils.PackedStringToUint8Array(str);
			return Promise.resolve(u8);
		});
  }

	/**
	 * @override
	 */
  write(path, a8) {
    const str = Utils.Uint8ArrayToPackedString(a8);
    return this.writes(path, str);
  }
}

export { LocalStorageStore }
