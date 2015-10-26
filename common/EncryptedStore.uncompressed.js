/*@preserve Copyright (C) 2015 Crawford Currie http://c-dot.co.uk license MIT*/
/**
 * @class
 * Store engine for encrypted data. Uses an underlying engine to actually
 * store the encrypted data.
 * The encryption requires a password, but no attempt is made to determine
 * if the password is correct. Whatever data is held in the underlying
 * store is simply decrypted using the password provided, it's up to the
 * caller to determine if the resulting data is valid or not.
 * @param params: Standard for LayeredStore
 * @implements LayeredStore
 */
function EncryptedStore(params) {
    "use strict";

    LayeredStore.call(this, params);
}

EncryptedStore.prototype = Object.create(LayeredStore.prototype);

EncryptedStore.prototype.options = function() {
    "use strict";
    return $.extend(
        LayeredStore.prototype.options.call(this),
        {
            needs_pass: true
        });
};

EncryptedStore.prototype.read = function(path, ok, fail) {
    "use strict";

    var self = this;

    if (DEBUG) console.debug("EncryptedStore: reading " + path
                      + " with password " + self.engine.pass());
    this.engine.read(
        path,
        function(ab) {
            var data;
            try {
                if (DEBUG) console.debug(
                    "EncryptedStore: decrypting using password "
                        + self.engine.pass());
                data = AES.decrypt(ab, self.engine.pass(), 256);
            } catch (e) {
                if (DEBUG) console.debug("Caught " + e);
                fail.call(self, e);
                return;
            }
            ok.call(self, data.buffer);
        },
        fail);
};

EncryptedStore.prototype.write = function(path, ab, ok, fail) {
    "use strict";

    var self = this;

    if (DEBUG) console.debug("EncryptedStore: writing " + path
                             + " with password " + self.engine.pass());
    var xa;

    try {
        xa = AES.encrypt(ab, this.engine.pass(), 256);
    } catch (e) {
        if (DEBUG) console.debug("Caught " + e);
        fail.call(this, e);
        return;
    }

    this.engine.write(
        path,
        xa.buffer,
        function() {
            ok.call(self);
        },
        fail);
};
