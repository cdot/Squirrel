/*@preserve Copyright (C) 2015-2023 Crawford Currie http://c-dot.co.uk license MIT*/
/* eslint-env browser */

import { Serror } from "./Serror.js";
import { LayeredStore } from "./LayeredStore.js";
import { Utils } from "./Utils.js";
import { Cryptographer } from "./Cryptographer.js";

const SIGNATURE = 0x53;
const VERSION = 1;

/**
 * Store engine for encrypted data. Uses Cryptographer and an
 * underlying engine to actually store the encrypted data. The
 * encryption requires a password.
 *
 * The option "needs_pass" is set by the store to indicate that
 * this store requires option("pass") to be set to an encryption
 * password.
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
    //if (this.debug) this.debug("crypto read", path);
    return super.read(path)
    .then(a8 => Cryptographer.decrypt(a8, this.option("pass"))
			    .catch(e => {
            throw new Serror(400, "crypto read failed");
			    }));
  }

  /**
	 * @override
	 */
  write(path, a8) {
    //if (this.debug) this.debug("crypto write", path);
    return Cryptographer.encrypt(a8, this.option("pass"))
		.catch(e => {
			throw new Serror(400, "write failed");
		})
    .then(encrypted => super.write(path, encrypted));
  }

  /**
	 * @override
	 */
  reads(path) {
    //if (this.debug) this.debug("crypto reads", path);
    return super.read(path)
    .then(uint8 => Cryptographer.decrypt(uint8, this.option("pass"))
				  .then(data => new TextDecoder().decode(data))
				  .catch(e => {
					  throw new Serror(new Serror(400, "reads failed"));
				  }));
  }

  /**
	 * @override
	 */
  writes(path, s) {
    //if (this.debug) this.debug("crypto writes", path);
		const uint8 = new TextEncoder().encode(s);
    return Cryptographer.encrypt(uint8, this.option("pass"))
		.catch(e => {
			throw new Serror(new Serror(400, "writes failed"));
		})
    .then(encrypted => super.write(path, encrypted));
  }
}

export { CryptoLayer }
