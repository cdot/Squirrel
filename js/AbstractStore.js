/*@preserve Copyright (C) 2015 Crawford Currie http://c-dot.co.uk license MIT*/

/* global DEBUG:true */
/* global Utils:true */

if (typeof module !== "undefined")
    Utils = require('Utils');

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

/**
 * The standard pattern is for the constructor to take a callback as
 * parameter to the create and invoke that callback when the store
 * is ready for use.
 *
 * @class
 * @param params default fields (some stores may require more)
 *    * ok, called on success
 *    * fail, called on failure
 */
function AbstractStore(params) {
    "use strict";
    params.ok.call(this);
}

// Special error message, must be used when a store is otherwise OK but
// data being read is missing.
AbstractStore.NODATA = "not found";

/**
 * Return a hash of static options. This is never written, entries are
 * constants.
 */
AbstractStore.prototype.options = function () {
    "use strict";

    return {
        identifier: "Unknown"
    };
};

/**
 * Set/get the user on the store. Only relevant on stores that are
 * protected by passwords.
 * @param pass the new password
 */
AbstractStore.prototype.user = function (user) {
    "use strict";

    if (typeof user !== "undefined")
        // .suser to avoid name conflict with .user()
        this.suser = user;
    return this.suser;
};

/**
 * Set/get the password on the store. Only relevant on stores that are
 * protected by passwords.
 * @param pass the new password
 */
AbstractStore.prototype.pass = function (pass) {
    "use strict";

    if (arguments.length === 1 && typeof pass !== "undefined")
        // .spass to avoid name conflict with .pass()
        this.spass = pass;
    return this.spass;
};

/**
 * Write data. Pure virtual.
 * @param path pathname to store the data under, a / separated path string
 * @param data an ArrayBuffer (or ArrayBufferView, so it can be a TypedArray)
 * @param ok called on success with this=self
 * @param fail called on failure with this=self
 */
AbstractStore.prototype.write = function (path, data, ok, fail) {
    "use strict";

    fail.call(this, "Store has no write method");
};

/**
 * Write a string.
 * @param path pathname the data is stored under, a / separated path string
 * @param str the data String
 * @param ok called on success with this=self
 * @param fail called on failure
 */
AbstractStore.prototype.writes = function (path, str, ok, fail) {
    "use strict";

    this.write(
        path,
        Utils.StringToArrayBuffer(str),
        ok,
        fail);
};

/**
 * Read an ArrayBuffer. Pure virtual.
 * @param path pathname the data is stored under, a / separated path string
 * @param ok called on success with this=self, passed ArrayBuffer
 * @param fail called on failure
 */
AbstractStore.prototype.read = function (path, ok, fail) {
    "use strict";

    fail.call(this, "Store has no read method");
};

/**
 * Read a string.
 * @param path pathname the data is stored under, a / separated path string
 * @param ok called on success with this=self, passed String
 * @param fail called on failure
 */
AbstractStore.prototype.reads = function (path, ok, fail) {
    "use strict";

    var self = this;

    this.read(
        path,
        function (ab) {
            var data;
            try {
                data = Utils.ArrayBufferToString(ab);
            } catch (e) {
                if (DEBUG) console.debug("Caught " + e);
                fail.call(self, e);
                return;
            }
            ok.call(self, data);
        },
        fail);
};

if (typeof module !== "undefined")
    module.exports = AbstractStore;