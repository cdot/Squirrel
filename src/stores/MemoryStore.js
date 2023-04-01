/*@preserve Copyright (C) 2019-2023 Crawford Currie http://c-dot.co.uk license MIT*/
/* eslint-env browser,node */

import { Utils } from "../common/Utils.js";
import { Serror } from "../common/Serror.js";
import { AbstractStore } from "../stores/AbstractStore.js";

  /**
   * A store engine using memory. Used for testing only.
   * @extends AbstractStore
   */
  class MemoryStore extends AbstractStore {

    constructor(p) {
      super(p);
      this.type = "MemoryStore";
      this.data = {};
    }

		/**
		 * @override
		 */
    read(path) {
      if (!(path in this.data))
        return Promise.reject(new Serror(400, `${path} is not in store`));
      return Promise.resolve(this.data[path]);
    }

		/**
		 * @override
		 */
		reads(path) {
			return this.read(path);
		}

		/**
		 * @override
		 */
    write(path, a8) {
      this.data[path] = a8;
      return Promise.resolve();
    }

		/**
		 * @override
		 */
		writes(path, data) {
			return this.write(path, data);
		}

		/**
		 * @override
		 */
    dump(path) {
      console.log(Utils.Uint8ArrayToString(this.data[path]));
    }
  }

export { MemoryStore }
