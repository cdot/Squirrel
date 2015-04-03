/* Copyright (C) 2015 Crawford Currie http://c-dot.co.uk / MIT */

/**
 * A store using Dropbox
 * @implements AbstractStore
 */
function DropboxStore(params) {
    "use strict";

    var self = this;
    new Dropbox.Client({
        key: "37tzcd7ezkaqovy"
    }).authenticate(function(error, client) {
        if (error) {
            if (DEBUG) console.debug("Dropbox auth failed: " + error);
            params.fail(self, error.responseText);
        } else {
            if (DEBUG) console.debug("Dropbox auth OK");

            client.getAccountInfo(
                null,
                function(erm, accountInfo) {
                    if (erm) {
                        var err = erm.responseText
                            || "Status: " + error.status;
                        if (DEBUG) console.debug("Dropbox getAccountInfo failed " + err);
                        params.fail.call(self, err);
                    } else {
                        if (DEBUG) console.debug("Dropbox username " + accountInfo.name);
                        self.db_client = client;
                        self.user(accountInfo.name);
                        params.uReq = false;
                        AbstractStore.call(self, params);
                    }
                });
        }
    });
}

const SQUIRREL_STORE = DropboxStore;

DropboxStore.prototype = Object.create(AbstractStore.prototype);

DropboxStore.prototype.identifier = function() {
    "use strict";

    return "Dropbox";
};

DropboxStore.prototype.write = function(data, ok, fail) {
    "use strict";

    var self = this;

    // writeFile supports a Blob, so this is OK
    this.db_client.writeFile(
        this.dataset,
        data,
        function(error/*, stat*/) {
            if (error) {
                if (DEBUG) console.debug("Dropbox write failed " + error.responseText);
                fail.call(self, error.responseText || error.status);
            } else {
                ok.call(self, self.data);
            }
        });
};

DropboxStore.prototype.read = function(ok, fail, options) {
    "use strict";

    var self = this;

    this.db_client.readFile(
        this.dataset,
        { arrayBuffer: options && options.base64 },
        function(error, data) {
            if (error) {
                if (DEBUG) console.debug(
                    "Dropbox read failed "
                        + error.responseText);
                if (error.status === Dropbox.ApiError.NOT_FOUND)
                    fail.call(self, AbstractStore.NODATA);
                else
                    fail.call(self, error.responseText);
            } else {
                if (options && options.base64) // data is an ArrayBuffer
                    data = Utils.ArrayBufferTo64(data);
               ok.call(self, data);
            }
        });
};
