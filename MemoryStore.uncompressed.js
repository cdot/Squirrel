// AbstractStore implementation loading data from JSON.
// For testing
// @param {string} pass the password
// @param {Object} data the data
function MemoryStore(data) {
    "use strict";

    AbstractStore.call(this);

    this.user = data.user;
    this.pass = data.pass;
    this.data = data.data;
}

MemoryStore.prototype = Object.create(AbstractStore.prototype);

MemoryStore.prototype._exists = function(user, ok, fail) {
    "use strict";

    ok.call(this);
};

MemoryStore.prototype._read = function(ok, fail) {
    "use strict";

    ok.call(this);
};

MemoryStore.prototype.save = function(ok/*, fail*/) {
    "use strict";

    ok.call(this);
};
