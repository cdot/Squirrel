/**
 * A store engine using HTML5 localStorage.
 * @implements AbstractStore
 */
function LocalStorageStore() {
    "use strict";

    AbstractStore.call(this);
}

LocalStorageStore.prototype = Object.create(AbstractStore.prototype);

LocalStorageStore.prototype.save = function(ok, fail) {
    "use strict";

    try {
        localStorage.setItem(this.user + "/pass", this.pass);
        localStorage.setItem(this.user + "/data",
                             JSON.stringify(this.data));
        ok.call(this);
    } catch (e) {
        fail.call(this, e);
    }
};

LocalStorageStore.prototype._read = function(key, ok, fail) {
    "use strict";

    try {
        this.pass = localStorage.getItem(this.user + "/pass");
        this.data = JSON.parse(localStorage.getItem(this.user + "/data"));
        ok.call(this);
    } catch (e) {
        fail.call(this, e);
    }
};

LocalStorageStore.prototype._exists = function(user, ok, fail) {
    "use strict";

    try {
        var x = localStorage.getItem(user + "/pass");
        if (typeof x !== 'undefined' && x !== null) {
            ok.call(this);
        } else {
            fail.call(this, "User does not exist");
        }
    } catch (e) {
        fail.call(this, e);
    }
};
