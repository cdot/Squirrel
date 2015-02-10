/**
 * A store engine using HTML5 localStorage.
 * @implements AbstractStore
 */
function LocalStorageStore() {
    AbstractStore.call(this);
    this.isReadOnly = false;
}

LocalStorageStore.prototype = Object.create(AbstractStore.prototype);

LocalStorageStore.prototype._write = function(key, data, ok, fail) {
    try {
        localStorage.setItem(key, data);
        ok.call(this);
    } catch (e) {
        fail.call(this, e);
    }
};

LocalStorageStore.prototype._read = function(key, ok, fail) {
    var r;
    try {
        r = localStorage.getItem(key);
    } catch (e) {
        fail.call(this, e);
        return;
    };
    if (typeof(r) !== 'undefined' && r !== null)
        ok.call(this, r);
    else
        fail.call(this, "No such item '" + key + "'");
};
