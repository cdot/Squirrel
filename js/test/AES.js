/*eslint-env node, mocha */
var assert = require('chai').assert;
var AES = require("../AES");
var Utils = require("../Utils");

describe('AES', function() {
    var plain = "This is test string";

    it('should ab/s', function() {
	var ab = Utils.StringToArrayBuffer(plain);
	// ab is a byte-buffer containing 16-bit chars
	var s = Utils.ArrayBufferToString(ab);
	assert.equal(s, plain);
    });

    it('should encrypt / decrypt strings', function() {
	var ab = Utils.StringToArrayBuffer(plain);
	var cipher = AES.encrypt(ab, "Secret", 256);
	var decipher = AES.decrypt(cipher, "Secret", 256);
	var s = Utils.ArrayBufferToString(decipher);
	assert.equal(s, plain);
    });
});
