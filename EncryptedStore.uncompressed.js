/**
 * @class
 * Store engine for encrypted data. Uses an underlying engine to actually
 * store the encrypted data.
 * The encryption requires a password, but no attempt is made to determine
 * if the password is correct. Whatever data is held in the underlying
 * store is simply decrypted, it's up to the caller to determine if it's
 * valid or not.
 * @param {object} params: Standard for AbstractStore, plus:
 *   * engine Class of storage engine to use under
 *     this encryption layer
 */
function EncryptedStore(params) {
    "use strict";

    var self = this, pok = params.ok;

    params.pReq = true; // Tell identify() we need a password
    // Override the OK function (SMELL: should really use extend)
    params.ok = function() {
        // Don't call AbstractStore(), it doesn't do anything useful
        // for us. The identity prompt has already been issued by the
        // engine constructor.
        self.engine = this;
        // Need the user so callers see this as a normal store.
        // Don't copy the pass, it's ok where it is
        self.user = this.user;
        pok.call(self);
    };
    
    new params.engine(params);
}

EncryptedStore.prototype = Object.create(AbstractStore.prototype);

EncryptedStore.prototype.read = function(ok, fail) {
    "use strict";

    var self = this;

    this.engine.read(
        function(xdata) {
            var data;
            try {
                data = Aes.Ctr.decrypt(xdata, self.engine.pass, 256);
            } catch (e) {
                fail.call(self, e);
                return;
            }
            ok.call(self, data);
        },
        fail);
};

EncryptedStore.prototype.write = function(data, ok, fail) {
    "use strict";

    var self = this,
    xdata;

    try {
        xdata = Aes.Ctr.encrypt(data, this.engine.pass, 256);
    } catch (e) {
        fail.call(this, e);
        return;
    };

    this.engine.write(
        xdata,
        function() {
            ok.call(self);
        },
        fail);
};
