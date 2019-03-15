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
            p = p || {};
            p.type = "LocalStorageStore";
            super(p);
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

        read(item) {
            return this.reads(item)
            .then((str) => {
                return Utils.PackedStringToUint8Array(str);
            });
        }

        write(item, ab) {
            return this.writes(item, Utils.Uint8ArrayToPackedString(ab));
        }

        _makeKey(item) {
            let path = this.option("role") + ":" + item + KEY_COMMA;
            if (typeof this.option("user") !== "undefined")
                path = path + this.option("user");
            if (typeof this.option("path") !== "undefined")
                path = path + this.option("path");
            return path;
        }

        reads(item) {
            let path = this._makeKey(item);
            if (this.debug) this.debug("ReadingS " + path);
            let str = localStorage.getItem(path);
            if (str === null) {
                if (this.debug) this.debug(path + " does not exist");
                return Promise.reject(this.error(path, 404, path + " does not exist"));
            }

            return Promise.resolve(str);
        }

        writes(item, str) {
            let path = this._makeKey(item);
            if (this.debug) this.debug("Writing", path, str);
            localStorage.setItem(path, str);
            return Promise.resolve();
        }
    }

    return LocalStorageStore;
});
