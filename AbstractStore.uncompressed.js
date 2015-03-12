/**
 * Pure virtual base class of store providers.
 *
 * Store providers provide a simple file system interface to data in the
 * store.
 *
 * @callback ok
 * Called with this set to the store
 *
 * @callback fail
 * Called with this set to the store
 * @param {string} message
 *
 * @callback identify
 * Called to identify what user is trying to use this store. Only stores
 * that require a username will use this. It's a hook for a login
 * prompt.
 * @param {ok} Called this set to the store and with the username as parameter
 * @param {fail} Called with this set to the store and a message
 * @param {uReq} true if the store requires a user
 * @param {pReq} true if the store requires a password
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
 *    * dataset name of the unique data set this store holds
 *    * ok, called on success
 *    * fail, called on failure
 *    * identify, called to identify the user of the store,
 *      if needed
 */
function AbstractStore(params) {
    "use strict";

    var self = this;

    this.dataset = params.dataset;

    var uReq = (params.uReq && typeof this.user === "undefined");
    var pReq = (params.pReq && typeof this.pass === "undefined");
    if (uReq || pReq) {
        params.identify.call(
            this,
            function(user, pass) {
                if (typeof this.user === "undefined")
                    this.user = user;
                if (typeof this.pass === "undefined")
                    this.pass = pass;
                params.ok.call(self);
            },
            params.fail, uReq, pReq);
    } else
        params.ok.call(this);
}

// Special error message, must be used when a store is otherwise OK but
// data being read is missing.
AbstractStore.NODATA = "not found";

// Return an textual identifier for the store that will be meaningful to the
// end user
AbstractStore.prototype.identifier = function() {
    "use strict";

    throw "Pure virtual method 'identifier'";
};

/**
 * Write data. Subclasses must implement.
 * @param {string} data to write
 * @param {ok} called on success
 * @param {fail} called on failure
 */
AbstractStore.prototype.write = function(/*data, ok, fail*/) {
    "use strict";

    throw "Pure virtual method 'write'";
};

/**
 * Read data. Subclasses must implement.
 * @param {ok} called on success
 * @param {fail} called on failure
 */
AbstractStore.prototype.read = function(/*ok, fail*/) {
    "use strict";

    throw "Pure virtual method 'read'";
};
