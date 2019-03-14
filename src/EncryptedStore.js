/*@preserve Copyright (C) 2015-2019 Crawford Currie http://c-dot.co.uk license MIT*/

define(["js/LayeredStore", "js/AES"], function (LayeredStore, AES) {

    /**
     * Store engine for encrypted data. Uses 256-bit AES and an
     * underlying engine to actually store the encrypted data. The
     * encryption requires a password, but no attempt is made to
     * determine if the password is correct; whatever data is held in
     * the underlying store is simply decrypted using the password
     * provided, it's up to the caller to determine if the decryption
     * worked or not. The option "needs_pass" is set but the store to flag
     * that this store requires option("pass") to be set to an encryption
     * password. If option("pass") is undefined. an optional
     * option("pass_handler") will be called to get a promise to get the
     * encryption password.
     * @param params: Standard for LayeredStore
     * @implements LayeredStore
     */
    class EncryptedStore extends LayeredStore {

        constructor(p) {
            p = p || {};
            p.needs_pass = true;
            p.type = "EncryptedStore";
            super(p);
        }

        read(path) {
            if (this.debug) this.debug("reading", path,this.option("pass"));
            let p = super.read(path)
            .then((ab) => {
                if (this.debug) this.debug("decrypting",this.option("pass"));
                let data;
                try {
                    data = AES.decrypt(ab, this.option("pass"), 256);
                } catch (e) {
                    // Decryption failure, assume wrong credentials
                    // Not sure this can ever happen
                    return Promise.reject(this.error(path, 400, "Decryption failure " + e));
                }
                // Check checksum
                let cs = (data.length - 1) % 255;
                if (data[0] !== cs)
                    return Promise.reject(this.error(path, 400, "Checksum failure " + data[0] + "!=" + cs));
                return Promise.resolve(new Uint8Array(data.buffer, 1));
            });
            return p;
        }

        write(path, a8) {
            if (this.debug) this.debug(this.option("type"), "writing", path);
            // Add checksum
            let a = new Uint8Array(a8.length + 1);
            a[0] = a8.length % 255;
            a.set(a8, 1)
            // And write
            return super.write(
                path, AES.encrypt(a, this.option("pass"), 256));
        }
    }

    return EncryptedStore;
});
