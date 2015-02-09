// Store engine for encrypted data. Uses an underlying engine to actually
// store the encrypted data.
//
// A current user is identified by password, which gives access
// to their personal data block. The details of how the data block is
// stored is up to the underlying engine. This interface simply provides
// an encryption layer.

// app = application name
function EncryptedStore(engine) /* implements AbstractStore */ {
    this.engine = engine;
    this.isReadOnly = engine.isReadOnly;
}

EncryptedStore.prototype = Object.create(AbstractStore.prototype);

// Encryption uses the 256 bit AES engine
EncryptedStore.prototype._encrypt = function(data) {
    return Aes.Ctr.encrypt(data, this.pass, 256);
};

EncryptedStore.prototype._decrypt = function(data) {
    return Aes.Ctr.decrypt(data, this.pass, 256);
};

// Get the 'users' data block for this application, which is a JSON-encoded
// map of user => encoded password (like passwd)
EncryptedStore.prototype._get_users = function(ok, fail) {
    this.engine.getData(
        '::users::',
        function(data) {
            ok.call(this, JSON.parse(data));
        },
        fail);
};

// Implements: AbstractStore
EncryptedStore.prototype.register = function(user, pass, ok, fail) {
    var es = this;
    es.engine.register(user, pass);
    this._get_users(
        function(known) {
            if (known[user]) {
                es.engine.log_out();
                fail.call(this, user + " is already registered");
            } else
                es._register(known, ok, fail);
        },
        function() {
            es._register({}, ok, fail);
        });
};

EncryptedStore.prototype._register = function(known, ok, fail) {
    var es = this;
    known[es.engine.user] = this._encrypt(this.pass);
    // set_users
    this.engine.setData(
        '::users::',
        JSON.stringify(known),
        function () {
            ok.call(es);
        },
        function (e) {
            es.engine.log_out();
            fail.call(es, e);
        })
}

// Return the registration date (as a JSON date) if login was successful
// or undefined otherwise.
EncryptedStore.prototype.log_in = function(user, pass, ok, fail) {
    var es = this;
    es.engine.log_in(user, pass);
    es._get_users(
        function(known) {
            if (known[user]) {
                if (es._decrypt(known[es.engine.user]) === es.engine.pass) {
                    es.engine.log_out();
                    ok.call(es);
                } else {
                    fail.call(es, user + " is not recognised");
                }
            }
        },
        function() {
            fail.call(es, user + " is not recognised");
        });
};

// Load the data from the current users' personal data store
// The data is a character string
// Implements: AbstractStore
EncryptedStore.prototype.getData = function(key, ok, fail) {
    if (!this.engine.user) {
        fail.call(this, "Not logged in");
    }
    else {
        var es = this;
        this.engine.getData(
            this._encrypt(key),
            function(data) {
                try {
                    ok.call(es, es._decrypt(data));
                } catch (e) {
                    fail.call(es, "Decryption failure: " + e);
                }
            }, fail);
    }
};

EncryptedStore.prototype.setData = function(key, data, ok, fail) {
    if (this.engine.isReadOnly)
	fail.call(this, "Read only");
    else if (!this.engine.user)
        fail.call(this, "Not logged in");
    else
        this.engine.setData(
            this._encrypt(key), this._encrypt(data), ok, fail);
};

EncryptedStore.prototype.exists = function(key, ok, fail) {
    if (!this.engine.user)
        fail.call(this, "Not logged in");
    else
        this.engine.exists(key, ok, fail);
};
