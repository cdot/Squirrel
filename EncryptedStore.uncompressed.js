/**
 * @class
 * Store engine for encrypted data. Uses an underlying engine to actually
 * store the encrypted data.
 * The encryption requires a password, but no attempt is made to determine
 * if the password is correct. Whatever data is held in the underlying
 * store is simply decrypted using the password provided, it's up to the
 * caller to determine if the resulting data is valid or not.
 * @param params: Standard for LayeredStore
 */
function EncryptedStore(params) {
    "use strict";

    // Push the password requirement down onto the embedded store
    params.pReq = true;

    LayeredStore.call(this, params);
}

EncryptedStore.prototype = Object.create(LayeredStore.prototype);

EncryptedStore.prototype.read = function(path, ok, fail) {
    "use strict";

    var self = this;

    this.engine.read(
        path,
        function(ab) {
            var data;
            // TODO: convert AES to work on ArrayBuffers
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
        // TODO: convert AES to work on ArrayBuffers
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
