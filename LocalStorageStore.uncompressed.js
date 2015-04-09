/* Copyright (C) 2015 Crawford Currie http://c-dot.co.uk / MIT */

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

LocalStorageStore.prototype.read = function(path, ok, fail) {
    "use strict";

    var data;

    try {
        data = Utils.StringToArrayBuffer(localStorage.getItem(path));
    } catch (e) {
        fail.call(this, e);
        return;
    }
    if (data === null) {
        fail.call(this, AbstractStore.NODATA);
    } else {
        ok.call(this, data);
    }
};

// data is a String or a Blob
LocalStorageStore.prototype.write = function(path, data, ok, fail) {
    "use strict";

    try {
        localStorage.setItem(path, Utils.ArrayBufferToString(data));
    } catch (e) {
        fail.call(this, e);
        return;
    }
    ok.call(this);
};
