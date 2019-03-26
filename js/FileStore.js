/*@preserve Copyright (C) 2017-2019 Crawford Currie http://c-dot.co.uk license MIT*/
/* eslint-env node */

define("js/FileStore", ["fs-extra", "js/AbstractStore", "js/Serror"], function(fs, AbstractStore, Serror) {

    /**
     * A store engine using file store, used with node.js
     * Uses 'url' to set the base path
     * @implements AbstractStore
     */
    class FileStore extends AbstractStore {

        constructor(p) {
            super(p);
            this.option("type", "FileStore");
            this.option("needs_path", true);
        }

        read(path) {
            if (this.debug) this.debug("read", path);
            return fs.readFile(this.option("path") + "/" + path)
            .catch((e) => {
                if (/ENOENT/.test(e.message))
                    throw this.error(path, 404, e.message);
                throw e;
            });
        }

        write(path, data) {
            if (this.debug) this.debug("write", path);
            // data is an Uint8Array so is already bytes
            return fs.writeFile(this.option("path") + "/" + path, data);
        }
    }

    return FileStore;
});
