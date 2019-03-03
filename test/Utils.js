/*@preserve Copyright (C) 2015-2019 Crawford Currie http://c-dot.co.uk license MIT*/

if (typeof module !== "undefined") {
    requirejs = require('requirejs');
}

requirejs.config({
    baseUrl: "..",
    paths: {
        js: "src",
        jsjq: "src/jquery",
        test: "test"
    }
});

// Max code point in Unicode is:
const MAX_CHAR = 65535;
const TESTR = "1234567普通话/普通話العَرَبِيَّة" + String.fromCodePoint(MAX_CHAR);

it("Utils", function(done) {
    return requirejs(["js/Utils", "chai"], function(Utils, chai) {
        let assert = chai.assert;
        describe("Tests", function() {
            it("StringToUint8Array and Uint8ArrayToString", function() {
                let a8 = Utils.StringToUint8Array(TESTR);
                assert.equal(a8.length, 53);
                assert.equal(Utils.Uint8ArrayToString(a8), TESTR);
            });

            it("Bad encoding", function() {
                let ab = new Uint8Array(512);
                for (let i = 0; i < 512; i++)
                    ab[i] = i;
                try {
                    Utils.Uint8ArrayToString(ab);
                    assert(false, "Expected decode error");
                } catch (e) {
                    //console.log(e);
                }
            });

            it("Uint8ArrayToPackedString 8 bit", function() {
                let ab = new Uint8Array(256);
                for (let i = 0; i < 256; i++)
                    ab[i] = i;
                let ps = Utils.Uint8ArrayToPackedString(ab);
                assert.equal(ps.length, 129);
                let ba = new Uint8Array(Utils.PackedStringToUint8Array(ps));
                assert.deepEqual(ba, ab);
            });
            
            it("Uint8ArrayToPackedString 16 bit", function() {
                let ab = new Uint8Array(65536);
                for (let i = 0; i < 65536; i++)
                    ab[i] = i;
                let ps = Utils.Uint8ArrayToPackedString(ab);
                assert.equal(ps.length, 32769);
                let ba = new Uint8Array(Utils.PackedStringToUint8Array(ps));
                assert.deepEqual(ba, ab);
            });
            
            it("Uint8ArrayToBase64", function() {
                let ab = new Uint8Array(256);
                for (let i = 0; i < 256; i++)
                    ab[i] = i;
                let ps = Utils.Uint8ArrayToBase64(ab);
                assert.equal(ps, "AAECAwQFBgcICQoLDA0ODxAREhMUFRYXGBkaGxwdHh8gISIjJCUmJygpKissLS4vMDEyMzQ1Njc4OTo7PD0+P0BBQkNERUZHSElKS0xNTk9QUVJTVFVWV1hZWltcXV5fYGFiY2RlZmdoaWprbG1ub3BxcnN0dXZ3eHl6e3x9fn+AgYKDhIWGh4iJiouMjY6PkJGSk5SVlpeYmZqbnJ2en6ChoqOkpaanqKmqq6ytrq+wsbKztLW2t7i5uru8vb6/wMHCw8TFxsfIycrLzM3Oz9DR0tPU1dbX2Nna29zd3t/g4eLj5OXm5+jp6uvs7e7v8PHy8/T19vf4+fr7/P3+/w==");
                let ba = new Uint8Array(Utils.Base64ToUint8Array(ps));
                assert.deepEqual(ba, ab);
            });

            it("generatePassword", function() {
                let pw = Utils.generatePassword();
                assert(!/[^A-Za-z0-9]/.test(pw), pw);
                assert.equal(pw.length, 24);
                
                pw = Utils.generatePassword({
                    charset: "ABC\"'",
                    length:80
                });
                assert(!/[^ABC\"\']/.test(pw), pw);
                assert.equal(pw.length, 80);

                try {
                    pw = Utils.generatePassword({
                        charset: "Z-Q9-0"
                    });
                    assert(false, "Unexpected");
                } catch (e) {
                }
            });
        });
        done();
    });
});

