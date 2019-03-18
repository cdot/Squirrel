/*@preserve Copyright (C) 2015-2019 Crawford Currie http://c-dot.co.uk license MIT*/
/* eslint-env browser */

let lss_deps = ["js/Utils", "js/Serror", "js/AbstractStore"];
if (typeof localStorage === "undefined") {
    // Use dom-storage to simulate localStorage with node.js
    lss_deps.push('dom-storage');
}

define(lss_deps, function(Utils, Serror, AbstractStore, Storage) {

    if (typeof localStorage === "undefined") {
        // Use dom-storage to simulate localStorage with node.js
        /* global localStorage: true */
        localStorage = new Storage('./scratch.json');
    }

    // Unique (hopefully!) string used to identify the boundary between
    // path and username in keys
    const KEY_COMMA = ".50C1BBE1.";

    /**
     * A store engine using HTML5 localStorage.
     * @implements AbstractStore
     */
    class LocalStorageStore extends AbstractStore {

        constructor(p) {
            super(p);
            this.option("type", "LocalStorageStore");
        }

        init() {
            // See if we can spot a possible user, identified by a personal
            // identifier. Note that if this is a client store and cloud
            // initialisation worked, then the user should already be set.
            if (typeof this.option("user") === "undefined") {
                let i = 0;
                let key;
                let poss_user = null;
                let re = new RegExp(KEY_COMMA + "(.*)$");
                while ((key = localStorage.key(i)) != null) {
                    let m = re.exec(key);
                    if (m) {
                        if (this.debug) this.debug("Possible user", poss_user);
                        if (poss_user) {
                            poss_user = null;
                            break;
                        } else {
                            poss_user = m[1];
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

        _read(path) {
            let str = localStorage.getItem(this._makeKey(path));
            if (str === null) {
                return Promise.reject(this.error(path, 404, path
                                                 + " does not exist"));
            }

            return Promise.resolve(str);
        }

        _write(path, str) {
            localStorage.setItem(this._makeKey(path), str);
            return Promise.resolve();
        }

        read(path) {
            if (this.debug) this.debug("read", path);
            return this._read(path)
            .then((str) => {
                return Utils.PackedStringToUint8Array(str);
            });
        }

        write(path, a8) {
            if (this.debug) this.debug("write", path);
            return this._write(path, Utils.Uint8ArrayToPackedString(a8));
        }

        _makeKey(path) {
            let key = this.option("role") + ":" + path + KEY_COMMA;
            if (typeof this.option("user") !== "undefined")
                key = key + this.option("user");
            if (typeof this.option("path") !== "undefined")
                key = key + this.option("path");
            return key;
        }
    }
    return LocalStorageStore;
});
