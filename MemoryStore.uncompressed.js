// AbstractStore implementation loading data from JSON.
// For testing
// @param {string} pass the password
// @param {Object} data the data
function MemoryStore(pass, data) {
    "use strict";

    AbstractStore.call(this);

    this.pass = pass;
    this.data = data;
}

MemoryStore.prototype = Object.create(AbstractStore.prototype);

MemoryStore.prototype._read = function(ok, fail) {
    "use strict";

    ok.call(this);
};

MemoryStore.prototype.save = function(ok/*, fail*/) {
    "use strict";

    ok.call(this);
};
