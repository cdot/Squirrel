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
            console.debug("Dropbox auth failed: " + error);
            params.fail(self, error.responseText);
        } else {
            console.debug("Dropbox auth OK");

            client.getAccountInfo(
                null,
                function(erm, accountInfo) {
                    if (erm) {
                        var err = erm.responseText
                            || "Status: " + error.status;
                        console.debug("Dropbox getAccountInfo failed " + err);
                        params.fail.call(self, err);
                    } else {
                        console.debug("Dropbox username " + accountInfo.name);
                        self.client = client;
                        self.user = accountInfo.name;
                        params.uReq = false;
                        AbstractStore.call(self, params);
                    }
                });
        }
    });
}

DropboxStore.prototype = Object.create(AbstractStore.prototype);

DropboxStore.prototype.identifier = function() {
    "use strict";

    return "Dropbox";
};

DropboxStore.prototype.write = function(data, ok, fail) {
    "use strict";

    var self = this;

    this.client.writeFile(
        this.dataset + "." + this.user,
        data,
        function(error/*, stat*/) {
            if (error) {
                console.debug("Dropbox write failed " + error.responseText);
                fail.call(self, error.responseText || error.status);
            } else {
                ok.call(self, self.data);
            }
        });
};

DropboxStore.prototype.read = function(ok, fail) {
    "use strict";

    var self = this;

    this.client.readFile(
        this.dataset + "." + this.user,
        function(error, data) {
            if (error) {
                console.debug("Dropbox read failed " + error.responseText);
                if (error.status === Dropbox.ApiError.NOT_FOUND)
                    fail.call(self, AbstractStore.NODATA);
                else
                    fail.call(self, error.responseText);
            } else {
                ok.call(self, data);
            }
        });
};
