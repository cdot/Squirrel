function DropboxStore(client) {
    AbstractStore.call(this);
    this.client = client;
}

DropboxStore.prototype = Object.create(AbstractStore.prototype);

DropboxStore.prototype.save = function(ok, fail) {
    "use strict";

    var self = this;

    this.client.writeFile(this.user, JSON.stringify({
        pass: this.pass,
        data: this.data }), function(error, stat) {
            if (error) {
                console.log("Dropbox write failed " + error);
                fail.call(self, error);
            } else {
                ok.call(self, self.data);
            }
        });
};

DropboxStore.prototype._read = function(ok, fail) {
    "use strict";

    var self = this;

    this.client.readFile(this.user, function(error, data) {
        if (error) {
            console.log("Dropbox _read failed " + error.responseText);
            if (error.status === Dropbox.ApiError.NOT_FOUND) {
                fail.call(self, self.NOT_FOUND);
            } else {
                fail.call(self, error.responseText);
            }
        } else {
            data = JSON.parse(data);
            self.pass = data.pass;
            self.data = data.data;
            ok.call(self, self.data);
        }
    })
};

DropboxStore.prototype._exists = function(user, ok, fail) {
    "use strict";

    var self = this;

    this.client.stat(user, function(error, stat) {
        if (error) {
            if (error.status === Dropbox.ApiError.NOT_FOUND) {
                fail.call(self, self.NOT_FOUND);
            } else {
                console.log("Dropbox _exists failed " + error);
                fail.call(self, error);
            }
        } else if (stat.isRemoved) {
            console.log("Hoard has been removed from dropbox");
            fail.call(self, self.NOT_FOUND);
        } else {
            ok.call(self);
        }
    })
};

(function ($) {
    $(document).ready(function() {
        new Dropbox.Client({
            key: "37tzcd7ezkaqovy"
        }).authenticate(function(error, client) {
            if (error) {
                console.log("Dropbox auth failed: " + error);
            } else {
                console.log("Dropbox auth OK");
                $(document).trigger("cloud_store_ready", new DropboxStore(client));
        }
        });
    });
})(jQuery);
