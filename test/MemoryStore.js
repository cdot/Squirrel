/*@preserve Copyright (C) 2019 Crawford Currie http://c-dot.co.uk license MIT*/
/* eslint-env browser,node */

define("test/MemoryStore", ["js/Utils", "js/Serror", "js/AbstractStore"], function(Utils, Serror, AbstractStore, Storage) {

    let data = {};

    /**
     * A store engine using memory. Used for testing only.
     * @implements AbstractStore
     */
    class MemoryStore extends AbstractStore {

        constructor(p) {
            super(p);
            this.type = "MemoryStore";
        }

        read(path) {
            if (this.debug) this.debug("read", path);
            return Promise.resolve(data[path]);
        }

        write(path, a8) {
            data[path] = a8;
            return Promise.resolve(true);
        }
    }
    return MemoryStore;
});
