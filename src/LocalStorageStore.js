/*@preserve Copyright (C) 2015-2019 Crawford Currie http://c-dot.co.uk license MIT*/

/* global Utils:true */
/* global Serror:true */
/* global AbstractStore:true */
/* global localStorage:true */

if (typeof module !== "undefined") {
    Utils = require("../src/Utils");
    Serror = require("../src/Serror");
    AbstractStore = require("../src/AbstractStore");
    // Use dom-storage to simulate localStorage with node.js
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
        if (str === null)
            return Promise.reject(new Serror(path, 404));
        if (this.debug) this.debug("LocalStorageStore: Reading " + path);
        let ab = Utils.PackedStringToArrayBuffer(str);
        return Promise.resolve(ab);
    }

    write(item, ab) {
        let path = "";
        if (this.option("user"))
            path += this.option("user") + ".";
        path += "SquirrelStore." + item;
        if (this.debug) this.debug("LocalStorageStore: Writing " + path);
        let str = Utils.ArrayBufferToPackedString(ab);
        localStorage.setItem(path, str);
        return Promise.resolve();
    }
}

if (typeof module !== "undefined")
    module.exports = LocalStorageStore;
