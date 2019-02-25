/*@preserve Copyright (C) 2015-2018 Crawford Currie http://c-dot.co.uk license MIT*/

/* global Utils:true */
if (typeof module !== "undefined")
    Utils = require("../src/Utils");

/* global Serror:true */
if (typeof module !== "undefined")
    Serror = require("../src/Serror");

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
     * @param data an ArrayBuffer (or ArrayBufferView, so it can be a
     * TypedArray)
     * @return a Promise that resolves to boolean true if the write
     * succeeded.
     * @throws Serror
     */
    write(path, data) {
        throw new Serror(path, 500, "Store has no write method");
    }

    /**
     * Write a string.
     * @param path pathname the data is stored under, a / separated path string
     * @param str the data String
     * @param ok called on success with this=self
     * @param fail called on failure
     * @throws Serror
     */
    writes(path, str) {
        return this.write(path, Utils.StringToArrayBuffer(str));
    }

    /**
     * Read an ArrayBuffer. Pure virtual.
     * @param path pathname the data is stored under, a / separated path string
     * @param ok called on success with this=self, passed ArrayBuffer
     * @param fail called on failure
     * @return a Promise that resolves to the content of the path. If the
     * path is not found, return undefined, and store.status() will return
     * an appropriate HTTP status code. If the resource exists but is
     * empty (has no content) return an empty ArrayBuffer.
     * @throws Serror
     */
    read(path) {
        throw new Serror(path, 500, "Store has no read method");
    }

    /**
     * Promise to read a string.
     * @param path pathname the data is stored under, a / separated path string
     * @return a promise that will resolve to the String contents of the
     * resource, or undefined if the resource is not found.
     * @throws Serror
     */
    reads(path) {
        return this.read(path)
            .then((ab) => {
                if (typeof ab === "undefined")
                    return ab;
                return Utils.ArrayBufferToString(ab);
            });
    }
}

if (typeof module !== "undefined")
    module.exports = AbstractStore;
