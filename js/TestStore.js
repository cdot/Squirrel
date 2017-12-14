/*@preserve Copyright (C) 2015 Crawford Currie http://c-dot.co.uk license MIT*/

/* global global:true */
/* global LocalStorageStore */

/**
 * Test ''cloud' store using LocalStorage in the browser
 */
if (typeof module !== "undefined")
    var LocalStorageStore = require("./LocalStorageStore");

/**
 * A test store engine
 * @extends LocalStorageStore
 */
function TestStore(params) {
    "use strict";
    params.user = "TestStore";
    LocalStorageStore.call(this, params);
}

global.CLOUD_STORE = TestStore;

TestStore.prototype = Object.create(LocalStorageStore.prototype);

TestStore.prototype.options = function () {
    "use strict";

    return $.extend(LocalStorageStore.prototype.options(), {
        identifier: "Local Test",
        needs_path: true, // vary this
        needs_image: true // vary this
    });
};

TestStore.prototype.read = function (path, ok, fail) {
    "use strict";
    if (this.pass() !== "x") {
        fail.call(this, "TestStore.read expects password 'x'");
    } else {
        LocalStorageStore.prototype.read.call(this, "TestStore" + path, ok, fail);
    }
};

TestStore.prototype.write = function (path, data, ok, fail) {
    "use strict";

    if (this.pass() !== "x") {
        fail.call(this, "TestStore.write expects password 'x'");
    } else {
        LocalStorageStore.prototype.write.call(this, "TestStore" + path, data, ok, fail);
    }
};

if (typeof module !== "undefined")
    module.exports = TestStore;