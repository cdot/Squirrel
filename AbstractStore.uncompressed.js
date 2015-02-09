/**
 * Pure virtual base class of storage engines.
 *
 * isReadOnly: true if the store is read-only
 *
 * @callback ok
 *
 * @callback fail
 * @param {string} message
 */

function AbstractStore() {
    this.isReadOnly = true;
    this.user = null;
}

/**
 * Register a new user of this storage. Should throw an exception
 * if there's a problem (e.g. the user already exists). If successful,
 * the registered user must be left logged in.
 * Default behaviour is a NOP (registration always succeeds)
 *
 * @param {string} user string identifying the user
 * @param {string} pass user password
 * @callback {ok} called on success
 * @callback {fail} called on failure
 */
AbstractStore.prototype.register = function(user, pass, ok, fail) {
    this.user = user;
    this.pass = pass;
    ok.call(this);
};

/**
 * Log in the user. Default behaviour is a NOP (login always succeeds)
 *
 * @param {string} user string identifying the user
 * @param {string} pass user password
 * @callback {ok} called on success
 * @callback {fail} called on failure
 */
AbstractStore.prototype.log_in = function(user, pass, ok, fail) {
    this.user = user;
    this.pass = pass;
    ok.call(this);
};

/**
 * Log the current user out
 */
AbstractStore.prototype.log_out = function() {
    this.user = null;
    this.pass = null;
};

/**
 * Get the data stored for a key
 *
 * @param {string} key index key
 * @callback {ok} success function, passed data, this = the engine
 * @callback {fail} error function, passed a reason, this = the engine
 * @return the data if the item exists. If the item does not exist, null
 */
AbstractStore.prototype.getData = function(key, ok, fail) {
    fail.call('getData is not supported by this AbstractStore');
};

/**
 * Check if an item exists
 *
 * @param {string} key key to look up
 * @callback {ok} (exists) this = the engine
 * @callback {fail} (does not exist) this = the engine
 */
AbstractStore.prototype.exists = function(key, ok, fail) {
    this.getData(key, ok, fail);
};

/**
 * Save the given data for the given key
 * The store does not have to implement saving. If it does not, this
 * method must call fail(message)
 *
 * @param {string} key index key
 * @param data the data to be stored
 * @callback {ok} this = the engine
 * @callback {fail} passed a reason, this = the engine
 */
AbstractStore.prototype.setData = function(key, data, ok, fail) {
    fail.call(this, "setData is not supported by this store");
};

