// A store engine using HTML5 localStorage.
// Implements the AbstractStore interface.

function LocalStorageStore(app) /* implements AbstractStore */ {
    this.app = app;
    this.isReadyOnly = false;
}

LocalStorageStore.prototype = Object.create(AbstractStore.prototype);

// Implements: AbstractStore
LocalStorageStore.prototype.setData = function(key, data, ok, fail) {
    try {
        localStorage.setItem(this.app + ':' + key, data);
        ok.call(this);
    } catch (e) {
        fail.call(this, e);
    }
};

// Implements: AbstractStore
LocalStorageStore.prototype.getData = function(key, ok, fail) {
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

