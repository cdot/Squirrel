/**
 * A store engine using HTML5 localStorage.
 * @implements AbstractStore
 */
function LocalStorageStore(params) {
    "use strict";

    params.uReq = true;
    AbstractStore.call(this, params);
}

LocalStorageStore.prototype = Object.create(AbstractStore.prototype);

LocalStorageStore.prototype.read = function(ok, fail) {
    "use strict";

    try {
        var data = localStorage.getItem(this.dataset + "." + this.user);
        if (data === null) {
            fail.call(this, AbstractStore.NODATA);
        } else {
            ok.call(this, data);
        }
    } catch (e) {
        fail.call(this, e);
    }
};

LocalStorageStore.prototype.write = function(data, ok, fail) {
    "use strict";

    try {
        localStorage.setItem(this.dataset + "." + this.user, data);
        ok.call(this);
    } catch (e) {
        fail.call(this, e);
    }
};
