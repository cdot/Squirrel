// Store engine for encrypted data. Uses an underlying engine to actually
// store the encrypted data. Each user's data is encrypted using their unique
// password. Note that keys are *not* encyrpted.

function EncryptedStore(engine) {
    "use strict";

    AbstractStore.call(this);
    this.engine = engine;
}

EncryptedStore.prototype = Object.create(AbstractStore.prototype);

EncryptedStore.prototype.register = function(user, pass, ok, fail) {
    "use strict";

    var self = this,
    xpass = Aes.Ctr.encrypt(pass, pass, 256);
    this.engine.register(
        user,
        xpass,
        function() {
            self.user = user;
            self.pass = xpass;
            ok.call(self);
        }, fail);
};

EncryptedStore.prototype.log_in = function(user, pass, ok, fail) {
    "use strict";

    var self = this;
    this.engine.log_in(
        user,
        // Use a checker callback to decrypt the stored password for comparison
        function(xp) {
            return Aes.Ctr.decrypt(xp, pass, 256) === pass;
        },
        function() {
            self.user = user;
            self.pass = pass;
            ok.call(self);
        },
        fail);
};

EncryptedStore.prototype.log_out = function() {
    "use strict";

    this.engine.log_out();
    this.user = null;
    this.pass = null;
};

// Encryption uses the 256 bit AES engine
EncryptedStore.prototype._encrypt = function(data) {
    "use strict";

    return Aes.Ctr.encrypt(data, this.pass, 256);
};

EncryptedStore.prototype._decrypt = function(data) {
    "use strict";

    return Aes.Ctr.decrypt(data, this.pass, 256);
};

// Load the data from the current users' personal data store
// The data is a character string
// Implements: AbstractStore
EncryptedStore.prototype.getData = function(key, ok, fail) {
    "use strict";

    var self = this;
    if (!this.user) {
        fail.call(this, "Internal error: not logged in");
        return;
    }
    this.engine._read(
        this.user + ":" + key,
        function(data) {
            try {
                ok.call(self, JSON.parse(self._decrypt(data)));
            } catch (e) {
                fail.call(self, "Decryption failure: " + e);
            }
        }, fail);
};

EncryptedStore.prototype.setData = function(key, data, ok, fail) {
    "use strict";

    if (!this.user) {
        fail.call(this, "Internal error: not logged in");
    } else {
        this.engine._write(this.user + ":" + key,
                    this._encrypt(JSON.stringify(data)), ok, fail);
    }
};

EncryptedStore.prototype.exists = function(key, ok, fail) {
    "use strict";

    if (!this.engine.user) {
        fail.call(this, "Not logged in");
    } else {
        this.engine.exists(key, ok, fail);
    }
};
