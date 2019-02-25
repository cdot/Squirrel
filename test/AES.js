/*@preserve Copyright (C) 2015-2019 Crawford Currie http://c-dot.co.uk license MIT*/

/*eslint-env node, mocha */
if (typeof assert === "undefined")
    assert = require('chai').assert;
if (typeof AES === "undefined")
    AES = require("../src/AES");
if (typeof Utils === "undefined")
    Utils = require("../src/Utils");

describe('AES', function() {
    let plain = "This is test string";

    it('should ab/s', function() {
	let ab = Utils.StringToArrayBuffer(plain);
	// ab is a byte-buffer containing 16-bit chars
	let s = Utils.ArrayBufferToString(ab);
	assert.equal(s, plain);
    });

    it('should encrypt / decrypt strings', function() {
	let ab = Utils.StringToArrayBuffer(plain);
	let cipher = AES.encrypt(ab, "Secret", 128);
	let decipher = AES.decrypt(cipher, "Secret", 128);
	let s = Utils.ArrayBufferToString(decipher);
	assert.equal(s, plain);
    });
    
    it('should encrypt / decrypt bytes', function() {
	let ab = new Uint8Array(256);
        for (let i = 0; i < 256; i++)
            ab[i] = i;
	let cipher = AES.encrypt(ab, "$ecret", 256);
	let decipher = AES.decrypt(cipher, "$ecret", 256);
        let ba = new Uint8Array(decipher);
	assert.deepEqual(ba, ab);
    });
});
