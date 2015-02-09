/**
 * A store engine using HTML5 localStorage.
 * @implements AbstractStore
 */
function LocalStorageStore() {
    this.isReadyOnly = false;
}

LocalStorageStore.prototype = Object.create(AbstractStore.prototype);

LocalStorageStore.prototype.setData = function(key, data, ok, fail) {
    if (!this.user) {
        fail.call(this, "Not logged in");
        return;
    }
    try {
        localStorage.setItem(this.user + ':' + key, data);
        ok.call(this);
    } catch (e) {
        fail.call(this, e);
    }
};

LocalStorageStore.prototype.getData = function(key, ok, fail) {
    if (!this.user) {
        fail.call(this, "Not logged in");
        return;
    }
    try {
        var r = localStorage.getItem(this.user + ':' + key);
        if (typeof(r) !== 'undefined' && r !== null)
            ok.call(this, r);
        else
            fail.call(this, "No such item " + key);
    } catch (e) {
        fail.call(this, e);
    }
};

