/*@preserve Copyright (C) 2015-2019 Crawford Currie http://c-dot.co.uk license MIT*/
/* eslint-env browser,node */

define("js/CryptoLayer", ["js/Serror", "js/LayeredStore", "js/Utils", "js/Cryptographer"], function (Serror, LayeredStore, Utils, Crypto) {

    const SIGNATURE = 0x53;
    const VERSION = 1;
   
    /**
     * Store engine for encrypted data. Uses 256-bit Crypto and an
     * underlying engine to actually store the encrypted data. The
     * encryption requires a password.
     *
     * The option "needs_pass" is set by the store to indicate that
     * this store requires option("pass") to be set to an encryption
     * password.
     *
     * @extends LayeredStore
     */
    class CryptoLayer extends LayeredStore {

		/**
		 * See {@link LayeredStore} for other constructor options.
		 * Sets `options.needs_pass`.
		 */
        constructor(p) {
            super(p);
            this.option("needs_pass", true);
            this.type = `CryptoLayer/${this.understore.type}`;
        }

        /**
		 * @override
		 */
        read(path) {
            let self = this;
            if (this.debug) this.debug("read", path);
            return super.read(path)
            .then(a8 => {
				return Crypto.decryptBytes(a8, self.option("pass"))
				.catch(e => {
					throw new Serror(new Serror(400, "read failed"));
				});
			});
        }

        /**
		 * @override
		 */
        write(path, a8) {
            if (this.debug) this.debug("write", path);
            return Crypto.encryptBytes(a8, this.option("pass"))
			.catch(e => {
				throw new Serror(new Serror(400, "write failed"));
			})
            .then(encrypted => super.write(path, encrypted));
        }

        /**
		 * @override
		 */
        reads(path) {
            let self = this;
            if (this.debug) this.debug("read", path);
            return super.reads(path)
            .then(s => {
				return Crypto.decryptString(s, self.option("pass"))
				.catch(e => {
					throw new Serror(new Serror(400, "reads failed"));
				});
			});
        }

        /**
		 * @override
		 */
        writes(path, s) {
            if (this.debug) this.debug("write", path);
            return Crypto.encryptString(s, this.option("pass"))
			.catch(e => {
				throw new Serror(new Serror(400, "writes failed"));
			})
            .then(encrypted => super.writes(path, encrypted));
        }
    }

    return CryptoLayer;
});
