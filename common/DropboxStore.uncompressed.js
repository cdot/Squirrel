/* Copyright (C) 2015 Crawford Currie http://c-dot.co.uk / MIT */

/**
 * A store using Dropbox
 * @implements AbstractStore
 */
const APP_KEY = "37tzcd7ezkaqovy";

function DropboxStore(params) {
    "use strict";

    var self = this;
    new Dropbox.Client({
        key: APP_KEY
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
                        if (DEBUG) console.debug(
                            "Dropbox getAccountInfo failed " + err);
                        params.fail.call(self, err);
                    } else {
                        if (DEBUG) console.debug(
                            "Dropbox username " + accountInfo.name);
                        self.db_client = client;
                        self.user(accountInfo.name);
                        AbstractStore.call(self, params);
                    }
                });
        }
    });
}

const SQUIRREL_STORE = DropboxStore;

DropboxStore.prototype = Object.create(AbstractStore.prototype);

DropboxStore.prototype.options = function() {
    "use strict";
    return $.extend(AbstractStore.prototype.options(), {
        needs_path: true,
        identifier: "Dropbox"
    });
};

DropboxStore.prototype.write = function(path, data, ok, fail) {
    "use strict";

    var self = this;

    this.db_client.writeFile(
        path,
        data,
        function(error/*, stat*/) {
            if (error) {
                if (DEBUG) console.debug(
                    "Dropbox write failed " + error.responseText);
                fail.call(self, error.responseText || error.status);
            } else {
                ok.call(self, self.data);
            }
        });
};

DropboxStore.prototype.read = function(path, ok, fail) {
    "use strict";

    var self = this;

    this.db_client.readFile(
        path, 
        { arrayBuffer: true },
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
               ok.call(self, data);
            }
        });
};
