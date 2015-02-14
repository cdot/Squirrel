/**
 * Pure virtual base class of password-protected stores. A store presents
 * an interface that supports the setting and getting of data on a
 * per-user basis.
 * User support includes login, logout, registration.

So, localStore needs to key data per user, and those data blocks need
to be encrypted. So, a data block indexed per-user would work fine.

"user": { pass: "password", data: stored data }

FileStore needs to store the password in a per-user file with the rest of
the file encrytped. A single file need not contain multiple users, and
the filename dictates the username. So the file contains JSON as shown
above.

Same with google drive, the filename is the username.

Memoery store is per user too, but needs to be told the username up front.
The password is again encoded in the store.

 *
 * @callback ok
 * Called with this set to the store
 *
 * @callback fail
 * Called with this set to the store
 * @param {string} message
 *
 * @callback check_pass
 * Called with this set to the store
 * @param {string} stored password for the user
 */

/**
 * Create a new store. Subclasses must call this constructor.
 * @class
 */
function AbstractStore() {
    "use strict";

    /** @member {string} currently logged-in user */
    this.user = null;
    /** @member {string} password for the user */
    this.pass = null;
    /** @member {Object} data for the user */
    this.data = null;
}

/**
 * @protected
 * Check if a user has existing data. Subclasses must implement.
 * @param {string} user username
 * @param {ok} called on success
 * @param {fail} called on failure
 */
AbstractStore.prototype._exists = function(user, ok, fail) {
    "use strict";

    throw "Pure virtual method";
};

/**
 * Write this.data for the current user. Subclasses must implement.
 * @param {ok} called on success
 * @param {fail} called on failure
 */
AbstractStore.prototype.save = function(ok, fail) {
    "use strict";

    fail.call(this, "_write is not supported by this store");
};

/**
 * @protected
 * Subclasses must implement. Populate this from the backing store.
 * Requires the user to be set up, but will populate the pass and
 * data from what it reads from the backing store.
 * Must fill in pass and data fields.
 * @param {ok} called on success
 * @param {fail} called on failure
 */
AbstractStore.prototype._read = function(ok, fail) {
    "use strict";

    throw "Pure virtual method";
};

/**
 * Register a new user.
 *
 * @param {string} user string identifying the user
 * @param {string} pass user password
 * @param {ok} called on success
 * @param {fail} called on failure
 */
AbstractStore.prototype.register = function(user, pass, ok, fail) {
    "use strict";

    this._exists(
        user,
        function() {
            fail.call(this, user + " is already registered");
        },
        function(/*e*/) {
            this.user = user;
            this.pass = pass;
            this.data = null;
            this._write(ok, fail);
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
    "use strict";

    this._exists(
        user,
        function() {
            this.user = user;
            this._read(
                function() {
                    var success = true;
                    if (typeof pass === 'string') {
                        success = (pass === this.pass);
                    } else {
                        success = pass.call(this, this.pass);
                    }
                    if (success) {
                        ok.call(this);
                    } else {
                        this.log_out();
                        fail.call(this, "Password mismatch");
                    }
                },
                fail);
        },
        fail);
};

/**
 * Log the current user out. Always succeeds.
 */
AbstractStore.prototype.log_out = function() {
    "use strict";

    this.user = null;
    this.pass = null;
    this.data = null;
};

