/*@preserve Copyright (C) 2015-2019 Crawford Currie http://c-dot.co.uk license MIT*/
/*eslint-env node, mocha */

import { assert } from "chai";
import { Utils } from "../src/Utils.js";
import { Cryptographer } from "../src/Cryptographer.js";

if (typeof crypto === 'undefined' && typeof global !== "undefined")
	import("crypto").then(mod => global.crypto = mod.webcrypto); // node.js

describe("Cryptographer", () => {

  it('should encrypt / decrypt 256 bytes', function() {
		const sz = 256;
		let ab = new Uint8Array(sz);
    for (let i = 0; i < sz; i++)
      ab[i] = i;
		return Cryptographer.encrypt(ab, "$ecret")
		.then(cipher => {
			//console.log(btoa(cipher));
			return Cryptographer.decrypt(cipher, "$ecret");
		})
		.then(ba => {
			assert.equal(ab.length, ba.length);
			for (let i = 0; i < ab.length; i++)
				assert.equal(ab[i], ba[i]);
		});
  });
	
  it('should encrypt / decrypt lots of bytes quickly', function() {
		// 2^20 should be plenty
		const sz = Math.pow(2,20);
		let ab = new Uint8Array(sz);
    for (let i = 0; i < sz; i++)
      ab[i] = i;
		return Cryptographer.encrypt(ab, "$ecret")
		.then(cipher => Cryptographer.decrypt(cipher, "$ecret"))
		.then(ba => {
			assert.equal(ab.length, ba.length);
			for (let i = 0; i < ab.length; i++)
				assert.equal(ab[i], ba[i]);
		});
  });
	
  it('should handle empty bytes', function() {
		let ab = new Uint8Array();
		return Cryptographer.encrypt(ab, "$ecret")
		.then(cipher => Cryptographer.decrypt(cipher, "$ecret"))
		.then(ab => {
			assert.equal(ab.length, 0);
		});
  });
});
