// @param identify not used for this store; there's no way to log in
// using this API
function DropboxStore(params) {
    "use strict";

    var self = this,
    dbcl = new Dropbox.Client({
        key: "37tzcd7ezkaqovy"
    }).authenticate(function(error, client) {
        if (error) {
            console.log("Dropbox auth failed: " + error);
            params.fail(self, error.responseText);
        } else {
            console.log("Dropbox auth OK");

            client.getAccountInfo(
                null,
                function(erm, accountInfo) {
                    if (erm) {
                        var err = error.responseText
                            || "Status: " + error.status;
                        console.log("Dropbox write failed " + err);
                        params.fail.call(self, err);
                    } else {
                        console.log("Dropbox got username " + accountInfo.name);
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

DropboxStore.prototype.write = function(data, ok, fail) {
    "use strict";

    var self = this;

    this.client.writeFile(
        this.dataset + "." + this.user,
        data,
        function(error, stat) {
            if (error) {
                console.log("Dropbox write failed " + error.responseText);
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
                console.log("Dropbox read failed " + error.responseText);
                if (error.status === Dropbox.ApiError.NOT_FOUND)
                    fail.call(self, AbstractStore.NODATA);
                else
                    fail.call(self, error.responseText);
            } else {
                ok.call(self, data);
            }
        });
};
