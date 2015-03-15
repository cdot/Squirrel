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

LocalStorageStore.prototype.identifier = function() {
    "use strict";

    return "browser";
};

LocalStorageStore.prototype.read = function(ok, fail) {
    "use strict";

    var data;

    try {
        data = localStorage.getItem(this.dataset + "." + this.user());
    } catch (e) {
        fail.call(this, e);
        return;
    }
    if (data === null) {
        //console.debug(this.dataset + "." + this.user() + " is null");
        fail.call(this, AbstractStore.NODATA);
    } else {
        ok.call(this, data);
    }
};

LocalStorageStore.prototype.write = function(data, ok, fail) {
    "use strict";

    try {
        localStorage.setItem(this.dataset + "." + this.user(), data);
    } catch (e) {
        fail.call(this, e);
        return;
    }
    ok.call(this);
};
