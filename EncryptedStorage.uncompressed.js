// Store engine for encrypted data. Uses an underlying engine to actually
// store the encrypted data.
//
// A current user is identified by password, which gives access
// to their personal data block. The details of how the data block is
// stored is up to the underlying engine. This interface simply provides
// an encryption layer.

// app = application name
function EncryptedStorage(engine, app) /* implements StorageEngine */ {
    this.application = app;
    this.pass = null;
    this.user = null;
    this.engine = engine;
}

// Encryption uses the 256 bit AES engine
EncryptedStorage.prototype._encrypt = function(data) {
    return Aes.Ctr.encrypt(data, this.pass, 256);
};

EncryptedStorage.prototype._decrypt = function(data) {
    return Aes.Ctr.decrypt(data, this.pass, 256);
};

// Get the 'users' data block for this application, which is a JSON-encoded
// map of user => encoded password (like passwd)
EncryptedStorage.prototype._get_users = function(ok, fail) {
    var data = this.engine.getData(
        this.application + ':users',
        function(data) {
            ok.call(this, JSON.parse(data));
        },
        fail);
};

// Register a new user of encrypted local storage. Will throw an exception
// if there's a problem (e.g. the user already exists). If successful,
// the registered user will be left logged in, and the registration time will
// be returned (as a JSON date)
EncryptedStorage.prototype.register = function(user, pass, ok, fail) {
    var es = this;
    this.user = user;
    this.pass = pass;
    this._get_users(
        function(known) {
            if (known[user]) {
                fail.call(this, user + " is already registered");
            }
            es._register(known, ok, fail);
        },
        function() {
            es._register({}, ok, fail);
        });
};

EncryptedStorage.prototype._register = function(known, ok, fail) {
    var es = this;
    known[this.user] = this._encrypt(this.pass);
    // set_users
    this.engine.setData(
        this.application + ':users',
        JSON.stringify(known),
        function () {
            ok.call(es)
        },
        function (e) {
            es.pass = null;
            fail.call(es, e);
        })
}

// Return the registration date (as a JSON date) if login was successful
// or undefined otherwise.
EncryptedStorage.prototype.log_in = function(user, pass, ok, fail) {
    var es = this;
    es._get_users(
        function(known) {
            if (known[user]) {
                es.user = user;
                es.pass = pass;
                if (es._decrypt(known[es.user]) === es.pass) {
                    ok.call(es);
                } else {
                    es.user = null;
                    es.pass = null;
                    fail.call(es, user + " is not recognised");
                }
            }
        },
        function() {
            fail.call(es, user + " is not recognised");
        });
};

// log the current user out
EncryptedStorage.prototype.log_out = function(pass) {
    this.user = null;
    this.pass = null;
};

// Load the data from the current users' personal data store
// The data is a character string
// Implements: StorageEngine.getData
EncryptedStorage.prototype.getData = function(key, ok, fail) {
    if (!this.user) {
        fail.call(this, "Not logged in");
        return;
    }
    var es = this;
    this.engine.getData(
        this.application + '/' + this.user + ':' + key,
        function(data) {
            try {
                ok.call(es, es._decrypt(data));
            } catch (e) {
                fail.call(es, key + ": decryption failure: " + e);
            }
        }, fail);
};

// Save the data to the current user's personal data store
// The data is a character string
// Implements: StorageEngine.setData
EncryptedStorage.prototype.setData = function(key, data, ok, fail) {
    if (!this.user) {
        fail.call(this, "Not logged in");
        return;
    }
    this.engine.setData(
        this.application + '/' + this.user + ':' + key,
        this._encrypt(data),
        ok, fail);
};

