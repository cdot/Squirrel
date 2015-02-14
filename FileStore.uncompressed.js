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

FileStore.prototype._read = function(ok, fail) {
    "use strict";

    var self = this,
    reader = new FileReader();

    reader.onload = function(/*evt*/) {
        // There may be a number of onload events queued. Only
        // load the cache from the first one.
        if (self.data === null) {
            var data = JSON.parse(reader.result);
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
