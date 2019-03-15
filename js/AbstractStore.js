/*@preserve Copyright (C) 2015-2018 Crawford Currie http://c-dot.co.uk license MIT*/

define(["js/Utils", "js/Serror"], function(Utils, Serror) {

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
            for (let k in options)
                if (options.hasOwnProperty(k))
                    this.options[k] = options[k];
            let self = this;
            if (typeof this.options.debug === "function") {
                this.debug = function() {
                    let a = Array.from(arguments);
                    a.unshift(self.options.type);
                    options.debug.apply(null, a);
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
         * @param k the key
         * @param v the new value, undefined to simply retireve the value, or
         * null to delete the option (make it undefined), anything else will
         * set the value of the option.
         */
        option(k, v) {
            if (typeof v !== "undefined") {
                if (v === null)
                    delete this.options[k];
                else
                    this.options[k] = v;
            }
            return this.options[k];
        }

        /**
         * Generate an exception object
         */
        error(path, status, message) {
            if (this.debug) this.debug(this.option("type"), "error:",
                                       path, status, message);
            return new Serror(path, status, message);
        }

        /**
         * Write data. Pure virtual.
         * @param path pathname to store the data under, a / separated path string
         * @param data a Uint8Array
         * @return a Promise that resolves to boolean true if the write
         * succeeded.
         * @throws Serror if anything goes wrong
         */
        write(path, data) {
            throw new this.error(path, 500, "Store has no write method");
        }

        /**
         * Write a string.
         * @param path pathname the data is stored under, a / separated path string
         * @param str the data String
         * @param ok called on success with this=self
         * @param fail called on failure
         * @throws Serror if anything goes wrong
         */
        writes(path, str) {
            return this.write(path, Utils.StringToUint8Array(str));
        }

        /**
         * Read from the store. Pure virtual.
         * @param path pathname the data is stored under, a / separated path string
         * @return a Promise that resolves to the content of the path
         * as a Uint8Array. If the path is not found, return
         * undefined, and store.status() will return an appropriate
         * HTTP status code. If the resource exists but is empty (has
         * no content) return an zero-sized Unit8Array.
         * @throws Serror if anything goes wrong
         */
        read(path) {
            throw this.error(path, 500, "Store has no read method");
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
                .then((ab) => {
                    if (typeof ab === "undefined")
                        return ab;
                    try {
                        return Utils.Uint8ArrayToString(ab);
                    } catch (e) {
                        // UTF-8 decode error, most likely
                        throw this.error(path, 400, e);
                    }
                });
        }
    }

    return AbstractStore;
});
