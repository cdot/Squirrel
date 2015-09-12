/* Copyright (C) 2015 Crawford Currie http://c-dot.co.uk / MIT */

/**
 * A store engine using HTML5 localStorage.
 * @implements AbstractStore
 */
function TestStore(params) {
    "use strict";
    params.user = "TEST";
    params.ok = function() {
        params.fail.call(this, "Fuck off");
    };
    LocalStorageStore.call(this, params);
}

const SQUIRREL_STORE = TestStore;

TestStore.prototype = Object.create(LocalStorageStore.prototype);

TestStore.prototype.options = function() {
    "use strict";

    return $.extend(LocalStorageStore.prototype.options(), {
        identifier: "Local Test",
        needs_path: true
    });
};

TestStore.prototype.read = function(path, ok, fail) {
    "use strict";
    LocalStorageStore.prototype.read.call(this, "TEST" + path, ok, fail);
};

TestStore.prototype.write = function(path, data, ok, fail) {
    "use strict";

   LocalStorageStore.prototype.write.call(this, "TEST" + path, data, ok, fail);
};
