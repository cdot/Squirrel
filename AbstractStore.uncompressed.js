/**
 * Pure virtual base class of storage engines.
 *
 * isReadOnly: true if the store is read-only
 */

function AbstractStore() {
    this.isReadOnly = true;
}

/**
 * getData(key, ok, fail)
 * @param key index key
 * @param ok success function, passed data, this = the engine
 * @param fail error function, passed a reason, this = the engine
 * If the item does not exist, must return null
 */
AbstractStore.prototype.getData = function(key, ok, fail) {
    fail.call('getData is not supported by this AbstractStore');
};

/**
 * exists(key, ok, fail)
 * @param key key to look up
 * @param ok item exists, this = the engine
 * @param fail does not exist, this = the engine
 */
AbstractStore.prototype.exists = function(key, ok, fail) {
    this.getData(key, ok, fail);
};

/**
 * setData(key, data, ok, fail)
 * @param key index key
 * @param data the data to be stored
 * @param ok success function, this = the engine
 * @param fail error function, passed a reason, this = the engine
 * The engine does not have to implement saving. If it does not, this
 * method must call fail(message)
 */
AbstractStore.prototype.setData = function(key, data, ok, fail) {
    fail.call(this, "setData is not supported by this store");
};

