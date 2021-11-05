/*@preserve Copyright (C) 2021 Crawford Currie http://c-dot.co.uk license MIT*/
/* eslint-env browser,node */

//if (typeof crypto === 'undefined')
//	crypto = require('crypto').webcrypto; // node.js

define("js/Cryptographer", () => {

	const IV_LENGTH = 12;
	const SHA = 'SHA-256';
	const ALGORITHM = 'AES-GCM';

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
		static encryptBytes(uint8, password) {
            // encode password as UTF-8
			const pwUtf8 = new TextEncoder().encode(password);
			// get 96-bit random iv
			const iv = crypto.getRandomValues(new Uint8Array(IV_LENGTH));
			// specify algorithm to use
			const alg = { name: ALGORITHM, iv: iv };
			return crypto.subtle.digest(SHA, pwUtf8)
			.then(pwHash => {
				  // generate key from pw
				return crypto.subtle.importKey(
					'raw', pwHash, alg, false, ['encrypt']);
			})
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
		static decryptBytes(cipherData, password) {
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
			.then(pwHash => {
				  // generate key from pw
				return crypto.subtle.importKey(
					'raw', pwHash, alg, false, ['decrypt']);
			})
			.then(key => crypto.subtle.decrypt(alg, key, uint8))
			.then(buffer => new Uint8Array(buffer));
		}

		/**
		 * Encrypts string using supplied password
		 * @param   {string} unit8 bytes to be encrypted.
		 * @param   {string} password - Password to use to encrypt plaintext.
		 * @returns {Promise} Promise that resolves to a ciphertext string.
		 */
		static encryptString(plaintext, password) {
			// encode plaintext as UTF-8 bytes
			const uint8 = new TextEncoder().encode(plaintext);
			// encrypt plaintext using key
			return Cryptographer.encryptBytes(uint8, password)
			.then(bytes => {
				// iv+ciphertext as string
				let chars = "";
				bytes.forEach(byte => chars += String.fromCharCode(byte));
				return chars;
			});
		}

		/**
		 * Decrypts ciphertext using supplied password.
		 * based on (c) Chris Veness MIT Licence
		 *
		 * @param   {string} ciphertext base64 encoded ciphertext to be decrypted.
		 * @param   {string} password - Password to use to decrypt ciphertext.
		 * @returns {Promise} Promise resolves to decrypted plaintext
		 */
		static decryptString(ciphertext, password) {
			// ciphertext as Uint8Array
			const bytes = new Uint8Array(
				Array.from(ciphertext).map(ch => ch.charCodeAt(0)));
			return Cryptographer.decryptBytes(bytes, password)
			.then(data => {
                // plaintext from Uint8Array
				const plaintext = new TextDecoder().decode(data);
				return plaintext;
			});
		}
	}

	return Cryptographer;
});

	   
