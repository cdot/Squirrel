/**
 * Pure virtual base class of password-protected stores. A store presents
 * an interface that supports the setting and getting of data on a
 * per-user basis.
 * User support includes login, logout, registration.
 * 
 * @callback ok
 *
 * @callback fail
 * @param {string} message
 *
 * @callback check_pass
 * @param {string} stored password for the user
 */

/**
 * Create a new store. Subclasses must call this constructor.
 * @class
 */
function AbstractStore() {
    /** @member {string} currently logged-in user */
    this.user = null;
    /** @member {string} logged-in users' password */
    this.pass = null;
}

const PASSWORDS_KEY = '::passwords::';

/**
 * Check if a user is known and (if pass is not null) check their password.
 * Default implementation retrieves a JSON-encoded plain text "passwords"
 * hash using this._read. Subclasses may override to be more defensive
 * e.g. encrypt.
 * @param {string} user username
 * @param {string} password or {check_pass} callback, or null to just check
 * if the user exists
 * @param {ok} called on success
 * @param {fail} called on failure
 */
AbstractStore.prototype.check_user = function(user, pass, ok, fail) {
    this._read(
        PASSWORDS_KEY,
        function(data) {
            var passes, success = false;
            if (typeof(data) !== 'undefined') {
                passes = JSON.parse(data);
                if (pass !== null) {
                    // Check if the password is correct
                    if (typeof(pass) === 'string')
                        success = (passes[user] === pass);
                    else if (typeof(passes[user]) !== 'undefined')
                        // invoke the checker callback to check
                        success = pass(passes[user]);
                }
                else
                    success = (typeof(passes[user]) !== 'undefined');
            }
            if (success)
                ok.call(this);
            else
                fail.call(this, "Unknown '" + user + "'");
        },
        function(e) {
            // passwords hash may not exist
            fail.call(this, "DB read failed: " + e);
        });
};

/**
 * Add a new user with the given username and password. Default
 * implementation uses setData, which assumes the user is logged in.
 * @param {string} user username
 * @param {string} pass password
 * @param {ok} called on success
 * @param {fail} called on failure
 */
AbstractStore.prototype.add_user = function(user, pass, ok, fail) {
    this._read(
        PASSWORDS_KEY,
        function(data) {
            var passes;
            if (typeof(data) === 'undefined')
                passes = {};
            else
                passes = JSON.parse(data);

            passes[user] = pass;
            var json = JSON.stringify(passes);
            this._write(PASSWORDS_KEY, json, ok, fail);
        },
        fail);
};

/**
* @protected
 * Override in subclasses. Clients must not call.
 */
AbstractStore.prototype._write = function(key, data, ok, fail) {
    fail.call(this, "writing is not supported by this store");
};

/**
 * @protected
 * Override in subclasses. Clients must not call. ok(data) will
 * be called even if the key is not present (in which case it will
 * be passed undefined)
 */
AbstractStore.prototype._read = function(key, ok, fail) {
    fail.call('reading is not supported by this store');
};

/**
 * Register a new user of this storage. If successful,
 * the registered user must be left logged in.
 * Default behaviour is a NOP (registration always succeeds).
 *
 * @param {string} user string identifying the user
 * @param {string} pass user password
 * @param {ok} called on success
 * @param {fail} called on failure
 */
AbstractStore.prototype.register = function(user, pass, ok, fail) {
    if (this.user !== null) {
        fail.call(this, "Internal error: already logged in");
        return;
    }
    // Could cache the passwords hash but really very little point.
    // Logging in and out is an infrequent operation.
    this.check_user(
        user, null,
        function() {
            fail.call(this, "User already registered");
        },
        function(e) {
            this.add_user(
                user, pass,
                function() {
                    this.user = user;
                    this.pass = pass;
                    ok.call(this);
                },
                fail);
        });
};

/**
 * Log in the user. Default behaviour is for login to always succeed.
 *
 * @param {string} user string identifying the user
 * @param {string} pass user password, or (protected use only) a
 * {check_pass} function that will check the pass
 * @param {ok} called on success
 * @param {fail} called on failure
 */
AbstractStore.prototype.log_in = function(user, pass, ok, fail) {
    if (this.user !== null) {
        fail.call(this, "Internal error: already logged in");
        return;
    }
    this.check_user(
        user,
        pass,
        function() {
            this.user = user;
            this.pass = pass;
            ok.call(this);
        },
        fail);
}

/**
 * Log the current user out. Always succeeds.
 */
AbstractStore.prototype.log_out = function() {
    this.user = null;
    this.pass = null;
};

/**
 * Get the data stored for a key. It is an error to
 * call this method if no-one is logged in.
 *
 * @param {string} key index key
 * @param {ok} success function, passed data, this = the engine
 * @param {fail} error function, passed a reason, this = the engine
 * @return the data if the item exists. If the item does not exist, null
 */
AbstractStore.prototype.getData = function(key, ok, fail) {
    if (!this.user) {
        fail.call(this, "Internal error: not logged in");
        return;
    }
    this._read(
        this.user + ':' + key,
        function(data) {
            ok.call(this, JSON.parse(data));
        }, fail);
};

/**
 * Check if an item exists for the logged-in user. It is an error to
 * call this method if no-one is logged in.
 *
 * @param {string} key key to look up
 * @param {ok} (exists) this = the engine
 * @param {fail} (does not exist) this = the engine
 */
AbstractStore.prototype.exists = function(key, ok, fail) {
    if (!this.user) {
        fail.call(this, "Internal error: not logged in");
        return;
    }
    this._read(this.user + ':' + key, ok, fail);
};

/**
 * Save the given data for the given key. It is an error to
 * call this method if no-one is logged in.
 * The store does not have to implement saving. If it does not, this
 * method must call fail(message)
 *
 * @param {string} key index key
 * @param data the data to be stored
 * @param {ok} this = the engine
 * @param {fail} passed a reason, this = the engine
 */
AbstractStore.prototype.setData = function(key, data, ok, fail) {
    if (!this.user)
        fail.call(this, "Internal error: not logged in");
    else
        this._write(this.user + ':' + key, JSON.stringify(data), ok, fail);
};

