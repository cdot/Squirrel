/*@preserve Copyright (C) 2019 Crawford Currie http://c-dot.co.uk license MIT*/
/* eslint-env browser,node */

define("test/MemoryStore", ["js/Utils", "js/Serror", "js/AbstractStore"], function(Utils, Serror, AbstractStore, Storage) {

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
            return Promise.resolve(this.data[path]);
        }

        write(path, a8) {
            this.data[path] = a8;
            return Promise.resolve(true);
        }
    }
    return MemoryStore;
});
