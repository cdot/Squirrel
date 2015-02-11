// AbstractStore implementation reading data from a JSON file on disk.
// The File object has to be passed to the constructor.
// @param file a javascript File or Blob object
// See https://developer.mozilla.org/en-US/docs/Web/API/FileReader
function FileStore(file) {
    "use strict";

    AbstractStore.call(this);
    this.cache = null;
    this.file = file;
}

FileStore.prototype = Object.create(AbstractStore.prototype);

FileStore.prototype._cache = function(ok, fail) {
    "use strict";

    var self, reader;
    if (this.cache === null) {
        self = this;
        reader = new FileReader();
        reader.onload = function(/*evt*/) {
            // There may be a number of onload events queued. Only
            // load the cache from the first one.
            if (self.cache === null) {
                self.cache = JSON.parse(reader.result);
            }
            ok.call(self);
        };
        reader.onerror = function() {
            fail.call(self, this.file.name + " read failed");
        };
        reader.onabort = reader.onerror;
        reader.readAsBinaryString(this.file);
    } else {
        ok.call(this, this.cache);
    }
};

FileStore.prototype._read = function(key, ok, fail) {
    "use strict";

    this._cache(
        function() {
            ok.call(this, this.cache[key]);
        },
        fail);
};

// Note that this store is not persistent; changes only happen in
// the cache
FileStore.prototype._write = function(key, data, ok/*, fail*/) {
    "use strict";

    this._cache(
        function() {
            this.cache[key] = data;
            ok.call(this);
        },
        function() {
            // Write file will be the result of a read fail (probably)
            // so just create the cache in memory
            if (!this.cache) {
                this.cache = {};
            }
            this.cache[key] = data;
            ok.call(this);
        });
};
