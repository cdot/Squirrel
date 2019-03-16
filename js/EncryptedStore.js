/*@preserve Copyright (C) 2015-2019 Crawford Currie http://c-dot.co.uk license MIT*/

define(["js/LayeredStore", "js/AES"], function (LayeredStore, AES) {

    const CHECKSUMS = false;

    /**
     * Store engine for encrypted data. Uses 256-bit AES and an
     * underlying engine to actually store the encrypted data. The
     * encryption requires a password.
     *
     * The option "needs_pass" is set by the store to indicate that
     * this store requires option("pass") to be set to an encryption
     * password.
     *
     * The option "format" can be set to a sepcific store format
     * version number. At the moment there are two versions; Version 1
     * stores strings as Uint16 character codes, and has no content
     * verification. Version 2 stores them as UTF-8 encoded and adds
     * a check byte to check decryption.
     *
     * @param params: Standard for LayeredStore
     * @implements LayeredStore
     */
    class EncryptedStore extends LayeredStore {

        constructor(p) {
            super(p);
            this.option("needs_pass", true);
            this.option("type", "EncryptedStore/" + this.option("type"));
        }

        // @Override
        read(path) {
            if (this.debug) this.debug("reading", path);
            let p = super.read(path)
            .then((ab) => {
                if (this.debug) this.debug("decrypting");
                let data;
                try {
                    data = AES.decrypt(ab, this.option("pass"), 256);
                } catch (e) {
                    // Decryption failure, assume wrong credentials
                    // Not sure this can ever happen
                    return Promise.reject(this.error(path, 400, "Decryption failure " + e));
                }
                if (this.option("format") > 1) {
                    // Check checksum
                    let cs = (data.length - 1) % 255;
                    if (data[0] !== cs)
                        return Promise.reject(this.error(path, 400, "Checksum failure " + data[0] + "!=" + cs));
                    data = new Uint8Array(data.buffer, 1);
                }
                return Promise.resolve(data);
            });
            return p;
        }

        // @Override
        write(path, a8) {
            if (this.debug) this.debug(this.option("type"), "writing", path);
            if (this.option("format") >= 2) {
                // Add marker and checksum
                let a = new Uint8Array(a8.length + 1);
                a[0] = a8.length % 255;
                a.set(a8, 1)
                a8 = a;
            }
            // And write
            return super.write(
                path, AES.encrypt(a8, this.option("pass"), 256));
        }

        // @Override
        reads(path) {
            if (this.option("format") < 2) {
                return this.read(path)
                .then((ab) => {
                    return String.fromCharCode.apply(null, new Uint16Array(ab.buffer));
                });
            }
            return super.reads(path);
        }
    }

    return EncryptedStore;
});
