/*@preserve Copyright (C) 2015-2019 Crawford Currie http://c-dot.co.uk license MIT*/

if (typeof assert === "undefined")
    assert = require('chai').assert;
if (typeof Utils === "undefined")
    Utils = require('../src/Utils');

// Max code point in Unicode is:
const MAX_CHAR = 65535;
const TESTR = "1234567普通话/普通話العَرَبِيَّة" + String.fromCodePoint(MAX_CHAR);

describe("Utils", function() {
    it("StringToArrayBuffer", function() {
        let ab = Utils.StringToArrayBuffer(TESTR);
        let a8 = new Uint8Array(ab);
        assert.equal(a8.length, 53);
        assert.equal(Utils.ArrayBufferToString(ab), TESTR);
    });
    it("ArrayBufferToPackedString 8 bit", function() {
        let ab = new Uint8Array(256);
        for (let i = 0; i < 256; i++)
            ab[i] = i;
        let ps = Utils.ArrayBufferToPackedString(ab);
        assert.equal(ps.length, 129);
        let ba = new Uint8Array(Utils.PackedStringToArrayBuffer(ps));
        assert.deepEqual(ba, ab);
    });
    it("ArrayBufferToPackedString 16 bit", function() {
        let ab = new Uint8Array(65536);
        for (let i = 0; i < 65536; i++)
            ab[i] = i;
        let ps = Utils.ArrayBufferToPackedString(ab);
        assert.equal(ps.length, 32769);
        let ba = new Uint8Array(Utils.PackedStringToArrayBuffer(ps));
        assert.deepEqual(ba, ab);
    });
    it("ArrayBufferToBase64", function() {
        let ab = new Uint8Array(256);
        for (let i = 0; i < 256; i++)
            ab[i] = i;
        let ps = Utils.ArrayBufferToBase64(ab);
        assert.equal(ps, "AAECAwQFBgcICQoLDA0ODxAREhMUFRYXGBkaGxwdHh8gISIjJCUmJygpKissLS4vMDEyMzQ1Njc4OTo7PD0+P0BBQkNERUZHSElKS0xNTk9QUVJTVFVWV1hZWltcXV5fYGFiY2RlZmdoaWprbG1ub3BxcnN0dXZ3eHl6e3x9fn+AgYKDhIWGh4iJiouMjY6PkJGSk5SVlpeYmZqbnJ2en6ChoqOkpaanqKmqq6ytrq+wsbKztLW2t7i5uru8vb6/wMHCw8TFxsfIycrLzM3Oz9DR0tPU1dbX2Nna29zd3t/g4eLj5OXm5+jp6uvs7e7v8PHy8/T19vf4+fr7/P3+/w==");
        let ba = new Uint8Array(Utils.Base64ToArrayBuffer(ps));
        assert.deepEqual(ba, ab);
    });
});

