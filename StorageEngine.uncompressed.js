/**
 * Pure virtual base class of storage engines.
 *
 * isReadOnly: true if the store is read-only
 */

function StorageEngine() {
    this.isReadOnly = true;
}

/**
 * getData(key, ok, fail)
 * @param key index key
 * @param ok success function, passed data, this = the engine
 * @param fail error function, passed a reason, this = the engine
 * If the item does not exist, must return null
 */
StorageEngine.prototype.getData = function(key, ok, fail) {
    fail.call('getData is not supported by this StorageEngine');
};

/**
 * exists(key, ok, fail)
 * @param key key to look up
 * @param ok item exists, this = the engine
 * @param fail does not exist, this = the engine
 */
StorageEngine.prototype.exists = function(key, ok, fail) {
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
StorageEngine.prototype.setData = function(key, data, ok, fail) {
    fail.call(this, "setData is not supported by this StorageEngine");
};

