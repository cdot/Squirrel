// AbstractStore implementation loading data from JSON.
// Mainly for testing
// @param data the data to be loaded
function MemoryStore(data) {
    "use strict";

    AbstractStore.call(this);
    this.data = data;
}

MemoryStore.prototype = Object.create(AbstractStore.prototype);

MemoryStore.prototype._read = function(key, ok, fail) {
    "use strict";

    ok.call(this, this.data[key]);
};

MemoryStore.prototype._write = function(key, data, ok/*, fail*/) {
    "use strict";

    this.data[key] = data;
    ok.call(this);
};
