/*@preserve Copyright (C) 2015-2018 Crawford Currie http://c-dot.co.uk license MIT*/
/* eslint-env browser,node */

define("js/AbstractStore", ["js/Utils", "js/Serror"], (Utils, Serror) => {

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
         * Subclasses are expected to define `options.type`
         * @param {object} options parameters
         * @param {function} options.debug debug function, same signature
		 * as console.debug
         */
        constructor(options) {
            this.type = "AbstractStore";
            this.options = {};
            if (options)
                for (let k in options)
                    if (Object.prototype.hasOwnProperty.call(options, k))
                        this.options[k] = options[k];
            if (typeof this.options.debug === "function") {
                this.debug = () => {
                    const a = Array.from(arguments);
                    a.unshift(self.type);
                    this.options.debug.apply(null, a);
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
		 * @return {object} the (new) value of the option
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
         * Promise to write a string.
         * @param path pathname the data is stored under, a /
         * separated path string
         * @param str the data String
         * @return {Promise} Promise that resolves to boolean true if the write
         * succeeded.
         * @throws Serror if anything goes wrong
         */
        writes(path, str) {
            Serror.assert(false, "Store has no writes method");
        }

        /**
         * Promise to read a string.
         * @param {string} path pathname the data is stored under, a / separated string
         * @return {Promise} Promise that resolves to the String contents of the
         * resource, or undefined if the resource is not found.
         * @throws Serror if anything goes wrong
         */
        reads(path) {
            Serror.assert(false, "Store has no reads method");
        }

        /**
         * Promise to write binary data.
         * @param path pathname the data is stored under, a /
         * separated path string
         * @param {Uint8ARray} data the data String
         * @return {Promise} Promise that resolves to boolean true if the write
         * succeeded.
         * @throws Serror if anything goes wrong
         */
        write(path, data) {
            Serror.assert(false, "Store has no write method");
        }

        /**
         * Promise to read binary data
         * @param {string} path pathname the data is stored under, a / separated string
         * @return {Promise} Promise that resolves to {UintArray} of the
         * resource, or undefined if the resource is not found.
         * @throws Serror if anything goes wrong
         */
        read(path) {
            Serror.assert(false, "Store has no read method");
        }
    }

    return AbstractStore;
});
