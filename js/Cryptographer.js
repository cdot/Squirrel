/*@preserve Copyright (C) 2021 Crawford Currie http://c-dot.co.uk license MIT*/
/* eslint-env browser,node */
/* eslint no-global-assign: [ "error", { "exceptions": ["crypto"]}] */

if (typeof crypto === 'undefined')
	crypto = require('crypto').webcrypto; // node.js

/* dynamic-dependencies ["js/AES"] */

define("js/Cryptographer", ["js/Serror", "js/Utils"], (Serror, Utils) => {

	const IV_LENGTH = 12;
	const SHA = 'SHA-256';
	const ALGORITHM = 'AES-GCM';
  const SIGNATURE = 0x53;

	/**
	 * Thin layer around SubtleCrypto making it easier to use for simple
	 * symmetric encryption.
	 */
	class Cryptographer {

		/**
		 * Encrypts bytes using supplied password
		 * @param   {Uint8Array} unit8 bytes to be encrypted.
		 * @param   {string} password - Password to use to encrypt plaintext.
		 * @returns {Promise} Promise resolves to Uint8Array ciphertext
		 */
		static encrypt(uint8, password) {
      // encode password as UTF-8
			const pwUtf8 = new TextEncoder().encode(password);
			// get 96-bit random iv
			const iv = crypto.getRandomValues(new Uint8Array(IV_LENGTH));
			// specify algorithm to use
			const alg = { name: ALGORITHM, iv: iv };
			return crypto.subtle.digest(SHA, pwUtf8)
			.then(pwHash => 
				    // generate key from pw
				    crypto.subtle.importKey(
					    'raw', pwHash, alg, false, ['encrypt']))
			.then(key => crypto.subtle.encrypt(alg, key, uint8))
			.then(ab => {
				const cipherData = new Uint8Array(
					iv.byteLength + ab.byteLength);
				// Concatenate IV and ciphertext
				cipherData.set(iv, 0);
				cipherData.set(new Uint8Array(ab), iv.byteLength);
				return cipherData;
			});
		}

		/**
		 * Decrypts bytes using supplied password.
		 * @param {Uint8Array} cipherData - Ciphertext to be decrypted.
		 * @param {string} password - Password to use to decrypt cipherData.
		 * @returns {Promise} Promise resolves to Uint8Array decrypted data
		 */
		static decrypt(cipherData, password) {
      // encode password as UTF-8
			const pwUtf8 = new TextEncoder().encode(password);
			// Get iv
			const iv = cipherData.slice(0, IV_LENGTH);
			// get ciphertext
			const uint8 = cipherData.slice(IV_LENGTH);
			// specify algorithm to use
			const alg = { name: ALGORITHM, iv: iv };

      // hash the password
			return crypto.subtle.digest('SHA-256', pwUtf8)
			.then(pwHash =>
				    // generate key from pw
				    crypto.subtle.importKey(
					    'raw', pwHash, alg, false, ['decrypt']))
			.then(key => crypto.subtle.decrypt(alg, key, uint8))
			.then(buffer => new Uint8Array(buffer))
			.catch(e => {
				// Data compatibility.
				// Failover to AES-CTR reference implementation
				// to read "old" format data.
				return Utils.require("js/AES")
				.then(AES => {
					const data = AES.decrypt(cipherData, password, 256);
					// Check signature and checksum
					const cs = data.length % 255;
					if (data[0] === SIGNATURE &&
						  ((data[2] << 8) | data[3]) === cs) {
						return Promise.resolve(new Uint8Array(data.buffer, 4));
					} else if ((data.length & 1) === 0) {
						// If self is old format, the file contains a
						// 16-bit-per-character string and therefore
						// must be an even length. Further it must be
						// parseable JSON - an expensive check, but
						// no big deal.
						const s = String.fromCharCode.apply(
							null, new Uint16Array(data.buffer));
						try {
							JSON.parse(s);
							return Promise.resolve(new TextEncoder().encode(s));
						} catch (e) {
							// Should never happen
							Serror.assert(false, e);
						}
					}
					// Otherwise the signature is wrong and it's
					// odd sized. Wrong password?
					return Promise.reject(new Serror(400, "Decryption failed"));
				});
			});
		}
	}

	return Cryptographer;
});
