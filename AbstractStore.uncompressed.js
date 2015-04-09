/* Copyright (C) 2015 Crawford Currie http://c-dot.co.uk / MIT */

/**
 * Pure virtual base class of store providers.
 *
 * Store providers provide a simple file system interface to data in the
 * store. Data is passed back and forth in ArrayBuffer.
 */

/**
 * Create a new store. Subclasses must call this constructor.
 * The standard pattern is for the constructor to take a callback as
 * parameter to the create and invoke that callback when the store
 * is ready for use.
 *
 * If params.uReq of params.pReq are set true, then the store will
 * call the params.identify method in order to find out the username
 * and/or password. Either or both of these may be populated from another
 * source before this base class constructor is called - for example, if
 * the user is already logged in to a cloud data service, then it's
 * redundant to ask them their username again. However if the store
 * is encrypted, then there may need to be a password prompt.
 *
 * @class
 * @param {object} params
  *    * ok, called on success
 *    * fail, called on failure
 *    * identify, called to identify the user of the store,
 *      if needed
 */
function AbstractStore(params) {
    "use strict";

    var self = this;

    var uReq = (params.uReq && typeof this.user() === "undefined");
    var pReq = (params.pReq && typeof this.pass() === "undefined");
    if (uReq || pReq) {
        params.identify.call(
            this,
            function(user, pass) {
                if (typeof this.suser === "undefined")
                    this.suser = user;
                if (typeof this.spass === "undefined")
                    this.spass = pass;
                params.ok.call(self);
            },
            params.fail, uReq, pReq);
    } else
        params.ok.call(this);
}

// Special error message, must be used when a store is otherwise OK but
// data being read is missing.
AbstractStore.NODATA = "not found";

/**
 * Return an textual identifier for the store that will be meaningful to the
 * end user
 */
AbstractStore.prototype.identifier = function() {
    "use strict";

    return "abstract";
};

/**
 * Set/get the user on the store. Only relevant on stores that are
 * protected by passwords.
 * @param pass the new password
 */
AbstractStore.prototype.user = function(user) {
    "use strict";

    if (typeof user !== "undefined")
        this.suser = user;
    return this.suser;
};

/**
 * Set/get the password on the store. Only relevant on stores that are
 * protected by passwords.
 * @param pass the new password
 */
AbstractStore.prototype.pass = function(pass) {
    "use strict";

    if (arguments.length === 1 && typeof pass !== "undefined")
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
AbstractStore.prototype.write = function(/*path, data, ok, fail*/) {
    "use strict";

    if (DEBUG) debugger;
};

/**
 * Write a string.
 * @param path pathname the data is stored under, a / separated path string
 * @param str the data String
 * @param ok called on success with this=self
 * @param fail called on failure
 */
AbstractStore.prototype.writes = function(path, str, ok, fail) {
    var self = this;

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
AbstractStore.prototype.read = function(/*path, ok, fail*/) {
    "use strict";

    if (DEBUG) debugger;
};

/**
 * Read a string.
 * @param path pathname the data is stored under, a / separated path string
 * @param ok called on success with this=self, passed String
 * @param fail called on failure
 */
AbstractStore.prototype.reads = function(path, ok, fail) {
    var self = this;

    this.read(
        path,
        function(ab) {
            var data = Utils.ArrayBufferToString(ab);
            ok.call(self, data);
        },
        fail);
};
