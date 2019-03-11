/*@preserve Copyright (C) 2017-2019 Crawford Currie http://c-dot.co.uk license MIT*/
/* eslint-env node */

define(["fs-extra", "js/AbstractStore"], function(fs, AbstractStore) {

    /**
     * A store engine using file store, used with node.js
     * @implements AbstractStore
     */
    class FileStore extends AbstractStore {

        constructor(p) {
            p = p || {};
            p.type = "FileStore";
            super(p);
        }

        read(path) {
            return fs.readFile(path);
        }

        write(path, data) {
            // data is an Uint8Array so is already bytes
            return fs.writeFile(path, data);
        }
    }

    return FileStore;
});
