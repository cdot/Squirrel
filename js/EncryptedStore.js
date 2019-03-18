/*@preserve Copyright (C) 2015-2019 Crawford Currie http://c-dot.co.uk license MIT*/

define(["js/LayeredStore", "js/Utils", "js/AES"], function (LayeredStore, Utils, AES) {

    const SIGNATURE = 0x53;
    const VERSION = 1;

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
            let self = this;
            if (this.debug) this.debug("read", path);
            return super.read(path)
            .then((a8) => {
                if (self.debug) self.debug("decrypting", path);

                let data;
                try {
                    data = AES.decrypt(a8, self.option("pass"), 256);
                } catch (e) {
                    // Decryption failure, assume wrong credentials
                    throw self.error(path, 400, "Decryption failure " + e);
                }

                // Check signature and checksum
                let cs = data.length % 255;
                if (data[0] === SIGNATURE &&
                    ((data[2] << 8) | data[3]) === cs) {
                    if (self.debug) self.debug("data version", data[1]);
                    data = new Uint8Array(data.buffer, 4);
                }
                else if ((data.length & 1) === 0 && self.option("v1")) {
                    // If self is old format, the file contains a
                    // 16-bit-per-character string and therefore
                    // must be an even length
                    let s = String.fromCharCode.apply(
                        null, new Uint16Array(data.buffer));
                    data = Utils.StringToUint8Array(s);
                }
                else {
                    throw self.error(path, 400, "Decryption failed");
                }

                return Promise.resolve(data);
            });
        }

        // @Override
        write(path, a8) {
            if (this.debug) this.debug("write", path);
            // Add signature and checksum
            let a = new Uint8Array(a8.length + 4);
            let cs = a.length % 255;
            a[0] = SIGNATURE;
            a[1] = VERSION;
            a[2] = (cs & 0xFF00) >> 8;
            a[3] = (cs & 0xFF);
            a.set(a8, 4);
            a8 = a;
            // And write
            return super.write(
                path, AES.encrypt(a8, this.option("pass"), 256));
        }
    }

    return EncryptedStore;
});
