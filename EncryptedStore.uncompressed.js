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

    // Push the password requirement down onto the embedded store
    params.pReq = true;
    params.dataset = "Encrypted " + params.dataset;
    // Override the OK function
    // SMELL: should really use extend
    params.ok = function() {
        // 'this' is the engine.
        // Don't call AbstractStore(), it doesn't do anything useful
        // for us. The identity prompt has already been issued by the
        // engine constructor.
        self.engine = this;
        pok.call(self);
    };
    
    params.engine(params);
}

EncryptedStore.prototype = Object.create(AbstractStore.prototype);

EncryptedStore.prototype.identifier = function() {
    "use strict";

    return /* "encrypted " + */ this.engine.identifier();
};

EncryptedStore.prototype.user = function(u) {
    "use strict";

    return this.engine.user(u);
};

EncryptedStore.prototype.pass = function(pw) {
    "use strict";

    return this.engine.pass(pw);
};

EncryptedStore.prototype.read = function(ok, fail, options) {
    "use strict";

    var self = this;

    this.engine.read(
        function(xdata) {
            var data;
            try {
                data = Aes.Ctr.decrypt(xdata, self.engine.pass(), 256);
            } catch (e) {
                fail.call(self, e);
                return;
            }
            if (options && options.base64)
                data = Utils.StringTo64(data);
            ok.call(self, data);
        },
        fail);
};

EncryptedStore.prototype.write = function(data, ok, fail) {
    "use strict";

    var self = this,
    xdata;

    if (typeof data !== "string")
        throw "EncryptedStore only supports String";

    try {
        xdata = Aes.Ctr.encrypt(data, this.engine.pass(), 256);
    } catch (e) {
        fail.call(this, e);
        return;
    }

    this.engine.write(
        xdata,
        function() {
            ok.call(self);
        },
        fail);
};
