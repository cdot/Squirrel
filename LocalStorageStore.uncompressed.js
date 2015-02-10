/**
 * A store engine using HTML5 localStorage.
 * @implements AbstractStore
 */
function LocalStorageStore(prefix) {
    AbstractStore.call(this);
    this.prefix = prefix;
}

LocalStorageStore.prototype = Object.create(AbstractStore.prototype);

LocalStorageStore.prototype._write = function(key, data, ok, fail) {
    try {
        localStorage.setItem(this.prefix + '/' + key, data);
        ok.call(this);
    } catch (e) {
        fail.call(this, e);
    }
};

LocalStorageStore.prototype._read = function(key, ok, fail) {
    var r;
    try {
        r = localStorage.getItem(this.prefix + '/' + key);
    } catch (e) {
        fail.call(this, e);
        return;
    };
    if (r === null)
        // localStorage.getItem returns null if the key was not found :-(
        ok.call(this);
    else
        ok.call(this, r);
};
