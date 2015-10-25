/* Copyright (C) 2015 Crawford Currie http://c-dot.co.uk / MIT */

/**
 * A store engine using HTML5 localStorage.
 * @implements AbstractStore
 */
function LocalStorageStore(params) {
    "use strict";

    if (params.user) {
        this.user(params.user);
    } else {
        // See if we can spot a possible user. Specific to Squirrel.
        var i = 0;
        var key;
        var poss_user = null;
        while ((key = localStorage.key(i)) != null) {
            var m = /^Squirrel\.(.*)$/.exec(key);
            if (m) {
                if (poss_user) {
                    poss_user = null;
                    break;
                } else
                    poss_user = m[1];
            }
            i++;
        }
        if (poss_user) {
            if (DEBUG) console.debug("LocalStorageStore: Identified possible user " + poss_user);
            this.user(poss_user);
        }
    }

    AbstractStore.call(this, params);
}

LocalStorageStore.prototype = Object.create(AbstractStore.prototype);

LocalStorageStore.prototype.options = function() {
    "use strict";

    return $.extend(AbstractStore.prototype.options(), {
        needs_path: true,
        identifier: "browser"
    });
};

LocalStorageStore.prototype.read = function(path, ok, fail) {
    "use strict";

    var str;

    if (DEBUG) console.debug("LocalStorageStore: Reading " + path);
    try {
        str = localStorage.getItem(path);
    } catch (e) {
        if (DEBUG) console.debug("Caught " + e);
        fail.call(this, e);
        return;
    }
    if (str === null) {
        fail.call(this, AbstractStore.NODATA);
    } else {
        var data = Utils.PackedStringToArrayBuffer(str);
        ok.call(this, data);
    }
};

// data is a String or a Blob
LocalStorageStore.prototype.write = function(path, data, ok, fail) {
    "use strict";

    if (DEBUG) console.debug("LocalStorageStore: Writing " + path);
    try {
        var str = Utils.ArrayBufferToPackedString(data);
        localStorage.setItem(path, str);
    } catch (e) {
        if (DEBUG) console.debug("Caught " + e);
        fail.call(this, e);
        return;
    }
    ok.call(this);
};
