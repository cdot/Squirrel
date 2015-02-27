// AbstractStore implementation reading data from a JSON-encoded file on disk.
// The JSON must contain:
// {
//     pass: "user password",
//     data: //user data
// }
// @param file a File or Blob object
// See https://developer.mozilla.org/en-US/docs/Web/API/FileReader
function FileStore(file) {
    "use strict";

    AbstractStore.call(this);
    this.file = file;
}

FileStore.prototype = Object.create(AbstractStore.prototype);

FileStore.prototype._exists = function(user, ok, fail) {
    "use strict";

    if (this.data !== null) {
        ok.call(this);
    } else {
        var self = this;
        this._read(
            function() {
                if (self.user === user) {
                    ok.call(self);
                } else {
                    fail.call(self, this.NOT_FOUND);
                }
            },
            fail);
    }
};

FileStore.prototype._read = function(ok, fail) {
    "use strict";

    var self = this,
    reader = new FileReader();

    reader.onload = function(/*evt*/) {
        // There may be a number of onload events queued. Only
        // load the cache from the first one.
        if (self.data === null) {
            var data = JSON.parse(reader.result);
            self.user = data.user;
            self.pass = data.pass;
            self.data = data.data;
        }
        ok.call(self);
    };
    reader.onerror = function() {
        fail.call(self, this.file.name + " read failed");
    };
    reader.onabort = reader.onerror;
    reader.readAsBinaryString(this.file);
};

// Initialise a cloud store using the filestore
(function ($) {
    $(document).on("ready_for_store", function() {
        var $dlg = $('<div class="dialog" title="Init local file store"><input type="file" id="init_store_pick" title="Select file" value="store.test" /></div>');
        $('body').append($dlg);
        $dlg.dialog({
            modal: true,
            width: "500px",
            buttons: {
                "Continue": function() {
                    $dlg.dialog("close");
                    $(document).trigger(
                        "cloud_store_ready",
                        new FileStore($("#init_store_pick")[0].files[0]));
                }
            }
        });
    });
})(jQuery);
