/*@preserve Copyright (C) 2015-2019 Crawford Currie http://c-dot.co.uk license MIT*/
/* eslint-env browser,node */

let deps = ["js/Utils", "js/Serror", "js/AbstractStore"];
if (typeof localStorage === "undefined") {
    // Use dom-storage to simulate localStorage with node.js
    deps.push('dom-storage');
}

define("js/LocalStorageStore", deps, function(Utils, Serror, AbstractStore, Storage) {

    if (typeof localStorage === "undefined") {
        // Use dom-storage to simulate localStorage with node.js
        /* global localStorage: true */
        localStorage = new Storage('./scratch.json');
    }

    // Unique (hopefully!) string used to identify the boundary between
    // path and username in keys
    const ROOT_PATH = "50C1BBE1";

    /**
     * A store engine using HTML5 localStorage.
     * @implements AbstractStore
     */
    class LocalStorageStore extends AbstractStore {

        constructor(p) {
            super(p);
            this.type = "LocalStorageStore";
        }

        init() {
            // See if we can spot a possible user, identified by a personal
            // identifier. Note that if this is a client store and cloud
            // initialisation worked, then the user should already be set.
            if (typeof this.option("user") === "undefined") {
                let i = 0;
                let key;
                let poss_user = null;
                let re = new RegExp( "^(.*)\\." + ROOT_PATH);
                while ((key = localStorage.key(i)) != null) {
                    let m = re.exec(key);
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

        _wtf(path) {
            return localStorage.getItem(this._makeKey(path));
        }

        _read(path) {
            let str = localStorage.getItem(this._makeKey(path));
            if (str === null) {
                return Promise.reject(new Serror(
                    404, path + " does not exist"));
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
            let key = [];
            if (typeof this.option("user") !== "undefined")
                key.push(this.option("user"));
            key.push(ROOT_PATH);
            key.push(path);
            return key.join(".");
        }
    }
    return LocalStorageStore;
});
