// A store engine using HTML5 localStorage.
// Implements the StorageEngine interface.

function LocalStorageEngine(app) /* implements StorageEngine */ {
    this.app = app;
    this.isReadyOnly = false;
}

LocalStorageEngine.prototype = Object.create(StorageEngine.prototype);

// Implements: StorageEngine
LocalStorageEngine.prototype.setData = function(key, data, ok, fail) {
    try {
        localStorage.setItem(this.app + ':' + key, data);
        ok.call(this);
    } catch (e) {
        fail.call(this, e);
    }
};

// Implements: StorageEngine
LocalStorageEngine.prototype.getData = function(key, ok, fail) {
    try {
        var r = localStorage.getItem(this.app + ':' + key);
        if (typeof(r) !== 'undefined' && r !== null)
            ok.call(this, r);
        else
            fail.call(this, "No such item " + key);
    } catch (e) {
        fail.call(this, e);
    }
};

