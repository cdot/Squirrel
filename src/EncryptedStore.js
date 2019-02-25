/*@preserve Copyright (C) 2015 Crawford Currie http://c-dot.co.uk license MIT*/

/* global LayeredStore:true */
/* global AES:true */
if (typeof module !== "undefined") {
    LayeredStore = require("../src/LayeredStore");
    AES = require("../src/AES");
}

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
class EncryptedStore extends LayeredStore {

    constructor(p) {
        super(p);
        this.option("needs_pass", true);
        this.option("type", "Encrypted " + super.option("type"));
    }

    read(path) {
        if (this.debug) this.debug(this.option("type") + ": reading " + path +
                                   " with password " + this.option("pass"));
        return super.read(path)
            .then((ab) => {
                let data;
                if (this.debug) this.debug(
                    "EncryptedStore: decrypting using password " +
                        this.option("pass"));
                return AES.decrypt(ab, this.option("pass"), 256);
            });
    }

    write(path, ab) {
        if (this.debug) this.debug(this.option("type") + ": writing " + path +
                                   " with password " + this.option("pass"));

        return super.write(
            path,
            AES.encrypt(ab, this.option("pass"), 256).buffer);
    }
}

if (typeof module !== "undefined")
    module.exports = EncryptedStore;
