/*@preserve Copyright (C) 2015-2018 Crawford Currie http://c-dot.co.uk license MIT*/
/* eslint-env browser,node */

define("js/AbstractStore", ["js/Utils", "js/Serror"], function(Utils, Serror) {

    /**
     * Pure virtual base class of store providers.
     *
     * Store providers provide a simple file system interface to data in the
     * store. Data is passed back and forth in Uint8Array.
     *
     * This module provides two store provider virtual base classes,
     * AbstractStore (which is the base class of all stores) and LayeredStore
     * (which is an AbstractStore in which an underlying "engine" store provides
     * the actual storage services)
     */
    class AbstractStore {
        /**
         * @param options parameter block, may contain
         * debug: debug function, same signature as console.debug
         * Subclasses are expected to define 'type'
         */
        constructor(options) {
            this.options = { type: "AbstractStore" };
            if (options)
                for (let k in options)
                    if (options.hasOwnProperty(k))
                        this.options[k] = options[k];
            if (typeof this.options.debug === "function") {
                let self = this;
                this.debug = function() {
                    let a = Array.from(arguments);
                    a.unshift(self.type);
                    self.options.debug.apply(null, a);
                };
            }
        }

        /**
         * Return a promise to initialise the store
         */
        init() {
            return Promise.resolve();
        }

        /**
         * Get/set options.
         * @param k the key. If undefined, will return the entire options map
         * @param v the new value, undefined to simply retrieve the value, or
         * null to delete the option (make it undefined), anything else will
         * set the value of the option.
         */
        option(k, v) {
            if (typeof k === "undefined")
                return this.options;

            if (typeof v !== "undefined") {
                if (v === null)
                    delete this.options[k];
                else
                    this.options[k] = v;
            }
            return this.options[k];
        }

        /**
         * Write data. Pure virtual.
         * @param path pathname to store the data under, a / separated
         * path string
         * @param data a Uint8Array
         * @return a Promise that resolves to boolean true if the write
         * succeeded.
         * @throws Serror if anything goes wrong
         */
        write(path, data) {
            Serror.assert(false, "Store has no write method");
        }

        /**
         * Promise to write a string.
         * @param path pathname the data is stored under, a /
         * separated path string
         * @param str the data String
         * @return a Promise that resolves to boolean true if the write
         * succeeded.
         * @throws Serror if anything goes wrong
         */
        writes(path, str) {
            return this.write(path, Utils.StringToUint8Array(str));
        }

        /**
         * Read from the store. Pure virtual.
         * @param path pathname the data is stored under, a /
         * separated path string
         * @return a Promise that resolves to the content of the path
         * as a Uint8Array. If the path is not found, reject with an Serror
         * with status 400. Other HTTP status codes may be handled by
         * the implementing store (e.g. 401). If the resource exists
         * but is empty (has no content) resolve to a zero-sized
         * Uint8Array.
         * @throws Serror if anything goes wrong
         */
        read(path) {
            Serror.assert(false, "Store has no read method");
        }

        /**
         * Promise to read a string.
         * @param path pathname the data is stored under, a / separated string
         * @return a promise that will resolve to the String contents of the
         * resource, or undefined if the resource is not found.
         * @throws Serror if anything goes wrong
         */
        reads(path) {
            return this.read(path)
            .then((a8) => {
                try {
                    return Utils.Uint8ArrayToString(a8);
                } catch (e) {
                    // UTF-8 decode error, most likely
                    throw new Serror(400, path + " " + e);
                }
            });
        }
    }

    return AbstractStore;
});
