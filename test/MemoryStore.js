/*@preserve Copyright (C) 2019 Crawford Currie http://c-dot.co.uk license MIT*/
/* eslint-env browser,node */

define("test/MemoryStore", ["js/Utils", "js/Serror", "js/AbstractStore"], function(Utils, Serror, AbstractStore) {

    /**
     * A store engine using memory. Used for testing only.
     * @implements AbstractStore
     */
    class MemoryStore extends AbstractStore {

        constructor(p) {
            super(p);
            this.type = "MemoryStore";
            this.data = {};
        }

        read(path) {
            if (!(path in this.data))
                return Promise.reject(new Serror(400, path + " is not in store"));
            return Promise.resolve(this.data[path]);
        }

		reads(path) {
			return this.read(path);
		}

        write(path, a8) {
            this.data[path] = a8;
            return Promise.resolve();
        }

		writes(path, data) {
			return this.write(path, data);
		}

        dump(path) {
            console.log(Utils.Uint8ArrayToString(this.data[path]));
        }
    }
    return MemoryStore;
});
