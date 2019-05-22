/*@preserve Copyright (C) 2015-2019 Crawford Currie http://c-dot.co.uk license MIT*/
/* eslint-env browser,node */

define("js/EncryptedStore", ["js/Serror", "js/LayeredStore", "js/Utils", "js/AES"], function (Serror, LayeredStore, Utils, AES) {

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
     * @param params: Standard for LayeredStore
     * @implements LayeredStore
     */
    class EncryptedStore extends LayeredStore {

        constructor(p) {
            super(p);
            this.option("needs_pass", true);
            this.type = "EncryptedStore/" + this.understore.type;
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
                    // Decryption failure
                    throw new Serror(400, path + " decryption failure " + e);
                }

                // Check signature and checksum
                let cs = data.length % 255;
                if (data[0] === SIGNATURE &&
                    ((data[2] << 8) | data[3]) === cs) {
                    if (self.debug) self.debug("data version", data[1]);
                    return Promise.resolve(new Uint8Array(data.buffer, 4));
                }
                if ((data.length & 1) === 0) {
                    // If self is old format, the file contains a
                    // 16-bit-per-character string and therefore
                    // must be an even length. Further it must be parseable
                    // JSON - an expensive check, but no big deal.
                    let s = String.fromCharCode.apply(
                        null, new Uint16Array(data.buffer));
                    try {
                        JSON.parse(s);
                        return Promise.resolve(Utils.StringToUint8Array(s));
                    } catch (e) {
                        if (this.debug) this.debug("Invalid JSON " + e);
                    }
                }
                return Promise.reject(new Serror(400, path + " decryption failed"));
            });
        }

        // @Override
        write(path, a8) {
            if (this.debug) this.debug("write", path);
            // Add signature and checksum
            let signed = new Uint8Array(a8.length + 4);
            let cs = signed.length % 255;
            signed[0] = SIGNATURE;
            signed[1] = VERSION;
            signed[2] = (cs & 0xFF00) >> 8;
            signed[3] = (cs & 0xFF);
            signed.set(a8, 4);
            
            let encrypted = AES.encrypt(signed, this.option("pass"), 256);

            // Encoding check. If this lot passes but the read still fails,
            // there's something wrong on the read side.
            return super.write(path, encrypted);
        }
    }

    return EncryptedStore;
});
