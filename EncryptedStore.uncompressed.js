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

EncryptedStore.prototype.read = function(path, ok, fail) {
    "use strict";

    var self = this;

    this.engine.read(
        path,
        function(ab) {
            var data;
            // SMELL: convert AES to work on ArrayBuffers
            var xstr = Utils.ArrayBufferToBase64(ab);
            var str;
            try {
                str = Aes.Ctr.decrypt(xstr, self.engine.pass(), 256);
            } catch (e) {
                fail.call(self, e);
                return;
            }
            ab = Utils.Base64ToArrayBuffer(str);
            ok.call(self, ab);
        },
        fail);
};

EncryptedStore.prototype.write = function(path, ab, ok, fail) {
    "use strict";

    var self = this;

    var str = Utils.ArrayBufferToBase64(ab);
    var xstr;

    try {
        // SMELL: convert AES to work on ArrayBuffers
        xstr = Aes.Ctr.encrypt(str, this.engine.pass(), 256);
    } catch (e) {
        fail.call(this, e);
        return;
    }

    ab = Utils.Base64ToArrayBuffer(xstr);
    this.engine.write(
        path,
        ab,
        function() {
            ok.call(self);
        },
        fail);
};
