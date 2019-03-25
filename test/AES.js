/*@preserve Copyright (C) 2015-2019 Crawford Currie http://c-dot.co.uk license MIT*/
/*eslint-env node, mocha */

if (typeof module !== "undefined") {
    requirejs = require('requirejs');
    requirejs.config({
        baseUrl: "../src",
        paths: {
            test: "../test"
        }
    });
}

requirejs(["js/Utils", "js/AES", "test/TestRunner"], function(Utils, AES, TestRunner) {

    let tr = new TestRunner("AES");
    let assert = tr.assert;

    let plain = "This is test string";

    tr.addTest('should ab/s', function() {
	let ab = Utils.StringToUint8Array(plain);
	// ab is a byte-buffer containing 16-bit chars
	let s = Utils.Uint8ArrayToString(ab);
	assert.equal(s, plain);
    });

    tr.addTest('should encrypt / decrypt strings', function() {
	let ab = Utils.StringToUint8Array(plain);
	let cipher = AES.encrypt(ab, "Secret", 128);
	let decipher = AES.decrypt(cipher, "Secret", 128);
	let s = Utils.Uint8ArrayToString(decipher);
	assert.equal(s, plain);
    });

    tr.addTest('should encrypt / decrypt bytes', function() {
	let ab = new Uint8Array(256);
        for (let i = 0; i < 256; i++)
            ab[i] = i;
	let cipher = AES.encrypt(ab, "$ecret", 256);
	let ba = AES.decrypt(cipher, "$ecret", 256);
	assert.deepEqual(ba, ab);
    });

    tr.run();
});
