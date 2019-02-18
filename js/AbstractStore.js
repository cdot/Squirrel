/*@preserve Copyright (C) 2015-2018 Crawford Currie http://c-dot.co.uk license MIT*/

if (typeof Utils === "undefined")
    Utils = require("./Utils");

/**
 * Pure virtual base class of store providers.
 *
 * Store providers provide a simple file system interface to data in the
 * store. Data is passed back and forth in ArrayBuffer.
 *
 * This module provides two store provider virtual base classes,
 * AbstractStore (which is the base class of all stores) and LayeredStore
 * (which is an AbstractStore in which an underlying "engine" store provides
 * the actual storage services)
 */

class AbstractStore {
    /**
     * @param params parameter block, may contain
     * debug: debug function, same signature as console.debug
     */
    constructor(params) {
        this.options = {};
        if (params && typeof params.debug === "function")
            this.debug = params.debug;
    }

    /**
     * Return a promise to initialise the store with the given parameters.
     * @param params default fields (some stores may require more)
     */
    init() {
        return Promise.resolve();
    }

    // Special error message, must be used when a store is otherwise OK but
    // data being read is missing.

    /**
     * Get/set options. Set to null to delete an option.
     */
    option(k, v) {
        if (typeof v !== "undefined") {
            if (v === null)
                delete this.options[v];
            else
                this.options[k] = v;
        }
        return this.options[k];
    }

    /**
     * Write data. Pure virtual.
     * @param path pathname to store the data under, a / separated path string
     * @param data an ArrayBuffer (or ArrayBufferView, so it can be a TypedArray)
     * @param ok called on success with this=self, no parameters
     * @param fail called on failure with this=self
     */
    write(path, data) {
        return Promise.reject(new Error("Store has no write method"));
    }

    /**
     * Write a string.
     * @param path pathname the data is stored under, a / separated path string
     * @param str the data String
     * @param ok called on success with this=self
     * @param fail called on failure
     */
    writes(path, str) {
        return this.write(path, Utils.StringToArrayBuffer(str));
    }

    /**
     * Read an ArrayBuffer. Pure virtual.
     * @param path pathname the data is stored under, a / separated path string
     * @param ok called on success with this=self, passed ArrayBuffer
     * @param fail called on failure
     */
    read(path) {
        return Promise.reject(new Error("Store has no read method"));
    }

    /**
     * Promise to read a string.
     * @param path pathname the data is stored under, a / separated path string
     */
    reads(path) {
        return this.read(path)
            .then((ab) => {
                return Utils.ArrayBufferToString(ab);
            });
    }
}

AbstractStore.NODATA = new Error("No data");

if (typeof module !== "undefined")
    module.exports = AbstractStore;
