/*@preserve Copyright (C) 2015-2019 Crawford Currie http://c-dot.co.uk license MIT*/

if (typeof Utils === "undefined")
    Utils = require("./Utils");
if (typeof AbstractStore === "undefined")
    AbstractStore = require("./AbstractStore");
if (typeof localStorage === "undefined") {
    let Storage = require('dom-storage');
    localStorage = new Storage('./scratch.json');
}

/**
 * A store engine using HTML5 localStorage.
 * @implements AbstractStore
 */
class LocalStorageStore extends AbstractStore {

    constructor(p) {
        super(p);
    }

    option(k, v) {
        if (k === "needs_path")
            return true;
        return super.option(k, v);
    }
    
    init() {
        if (typeof this.option("user") === "undefined") {
            // See if we can spot a possible user, identified by a personal
            // identifier prepended to our unique path.
            var i = 0;
            var key;
            var poss_user = null;
            let re = new RegExp("^(.*)\\." + this.option("path") + "\\.");
            while ((key = localStorage.key(i)) != null) {
                var m = re.exec(key);
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
        path += this.option("path") + "." + item;
        if (this.debug) this.debug("LocalStorageStore: Reading " + path);
        var str = localStorage.getItem(path);
        if (str === null)
            throw AbstractStore.NODATA;
        var ab = Utils.PackedStringToArrayBuffer(str);
        return Promise.resolve(ab);
    }

    write(item, ab) {
        let path = "";
        if (this.option("user"))
            path += this.option("user") + ".";
        path += this.option("path") + "." + item;
        if (this.debug) this.debug("LocalStorageStore: Writing " + path);
        var str = Utils.ArrayBufferToPackedString(ab);
        localStorage.setItem(path, str);
        return Promise.resolve();
    }
}

if (typeof module !== "undefined")
    module.exports = LocalStorageStore;
