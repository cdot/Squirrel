/*@preserve Copyright (C) 2015-2019 Crawford Currie http://c-dot.co.uk license MIT*/

let lss_deps = ["js/Utils", "js/Serror", "js/AbstractStore"];
if (typeof localStorage === "undefined") {
    // Use dom-storage to simulate localStorage with node.js
    lss_deps.push('dom-storage');
}

define(lss_deps, function(Utils, Serror, AbstractStore, Storage) {

    if (typeof localStorage === "undefined") {
        // Use dom-storage to simulate localStorage with node.js
        localStorage = new Storage('./scratch.json');
    }

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
            if (typeof this.option("user") === "undefined") {
                // See if we can spot a possible user, identified by a personal
                // identifier.
                let i = 0;
                let key;
                let poss_user = null;
                let re = new RegExp("^(.*)\\.SquirrelStore");
                while ((key = localStorage.key(i)) != null) {
                    let m = re.exec(key);
                    if (m) {
                        if (poss_user) {
                            poss_user = null;
                            break;
                        } else
                            poss_user = m[1];
                    }
                    i++;
                }
                if (poss_user !== null) {
                    if (this.debug) this.debug("LocalStorageStore: Identified possible user " + poss_user);
                    this.option("user", poss_user);
                }
            }

            return super.init();
        }

        read(item) {
            let path = "";
            if (this.option("user"))
                path += this.option("user") + ".";
            path += "SquirrelStore." + item;
            this.status = 200;
            let str = localStorage.getItem(path);
            // https://html.spec.whatwg.org/multipage/webstorage.html#storage-2
            if (str === null)
                return Promise.reject(this.error(path, 404, "Nothing to read"));
            if (this.debug) this.debug("LocalStorageStore: Reading " + path);
            return Promise.resolve(Utils.PackedStringToUint8Array(str));
        }

        write(item, ab) {
            let path = "";
            if (this.option("user"))
                path += this.option("user") + ".";
            path += "SquirrelStore." + item;
            if (this.debug) this.debug("LocalStorageStore: Writing " + path);
            let str = Utils.Uint8ArrayToPackedString(ab);
            localStorage.setItem(path, str);
            return Promise.resolve();
        }
    }

    return LocalStorageStore;
});
    
