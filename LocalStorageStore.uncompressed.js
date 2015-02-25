/**
 * A store engine using HTML5 localStorage.
 * @implements AbstractStore
 */
function LocalStorageStore(prefix) {
    "use strict";

    AbstractStore.call(this);
    if (typeof prefix === 'string') {
        this.prefix = prefix;
    } else {
        this.prefix = "";
    }
}

LocalStorageStore.prototype = Object.create(AbstractStore.prototype);

LocalStorageStore.prototype.save = function(ok, fail) {
    "use strict";

    try {
        localStorage.setItem(this.prefix + this.user + "/pass", this.pass);
        localStorage.setItem(this.prefix + this.user + "/data",
                             JSON.stringify(this.data));
        ok.call(this);
    } catch (e) {
        fail.call(this, e);
    }
};

LocalStorageStore.prototype._read = function(ok, fail) {
    "use strict";

    try {
        this.pass = localStorage.getItem(this.prefix + this.user + "/pass");
        this.data = JSON.parse(localStorage.getItem(this.prefix + this.user + "/data"));
        ok.call(this);
    } catch (e) {
        fail.call(this, e);
    }
};

LocalStorageStore.prototype._exists = function(user, ok, fail) {
    "use strict";

    try {
        var x = localStorage.getItem(this.prefix + user + "/pass");
        if (typeof x !== 'undefined' && x !== null) {
            ok.call(this);
        } else {
            fail.call(this, this.UDNE);
        }
    } catch (e) {
        fail.call(this, e);
    }
};
