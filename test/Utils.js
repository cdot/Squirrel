/*@preserve Copyright (C) 2015-2019 Crawford Currie http://c-dot.co.uk license MIT*/

if (typeof module !== "undefined") {
    requirejs = require('requirejs');
}

requirejs.config({
    baseUrl: ".."
});

// Max code point in Unicode is:
const MAX_CHAR = 65535;
const TESTR = "1234567普通话/普通話العَرَبِيَّة" + String.fromCodePoint(MAX_CHAR);

requirejs(["js/Utils", "test/TestRunner"], function(Utils, TestRunner) {

    let tr = new TestRunner("Utils");
    let assert = tr.assert;

    tr.addTest("parseURLParams", function() {
        let spec = {
            strings: { array: true, type: "string" },
            bools: { array: true, type: "boolean" },
            nums: { array: true, type: "number" },
            ints: { array: true, type: "int" },
            string: { type: "string" },
            bool: { type: "bool" },
            num: { type: "float" },
            "int": { type: "integer" }
        };

        assert.deepEqual(Utils.parseURLParams("strings=1,2,3&string=123", spec), {
            string: "123",
            strings: [ "1", "2", "3" ]
        });
        assert.deepEqual(Utils.parseURLParams("nums=1.1,2&num=99", spec), {
            num: 99,
            nums: [ 1.1, 2 ]
        });
        assert.deepEqual(Utils.parseURLParams("bools=true,,1&bool", spec), {
            bool: true,
            bools: [ true, false, true ]});

        spec = {
            str: { type: "string", "default": "DEFAULT" },
            boo: { type: "boolean", "default": true }
        }; 
        assert.deepEqual(Utils.parseURLParams("", spec), {
            str: "DEFAULT", boo: true });
    });
    
    tr.addTest("StringToUint8Array and Uint8ArrayToString", () => {
        let a8 = Utils.StringToUint8Array(TESTR);
        assert.equal(a8.length, 53);
        assert.equal(Utils.Uint8ArrayToString(a8), TESTR);
    });

    tr.addTest("Bad encoding", () => {
        let ab = new Uint8Array(512);
        for (let i = 0; i < ab.length; i++)
            ab[i] = i;
        try {
            Utils.Uint8ArrayToString(ab);
            assert(false, "Expected decode error");
        } catch (e) {
            //console.log(e);
        }
    });

    tr.addTest("Uint16ArrayToPackedString and back", () => {
        let ab = new Uint8Array(65536);
        let i;
        for (i = 0; i < ab.length; i++)
            ab[i] = i;
        let ps = Utils.Uint16ArrayToPackedString(ab);
        let ba = Utils.PackedStringToUint16Array(ps);
        assert.equal(ba.length, ab.length);
        for (i = 0; i < ab.length; i++)
            assert.equal(ba[i], ab[i]);
    });
    
    tr.addTest("Uint8ArrayToPackedString 8 bit and back", () => {
        let ab = new Uint8Array(513);
        let i = 0;
        ab[i++] = 0xFF; // msb of first 16-bit word is used for flag
        // High surrogate code points to try and force an error
        ab[i++] = 0xD8;
        ab[i++] = 0x00;
        ab[i++] = 0xDB;
        ab[i++] = 0x54;
        ab[i++] = 0x80;
        ab[i++] = 0x00;
        while (i < ab.length)
            ab[i++] = i;
        let ps = Utils.Uint8ArrayToPackedString(ab);
        assert.equal(ps.codePointAt(0), 0x1ff);
        
        let ba = Utils.PackedStringToUint8Array(ps);
        assert.equal(ba.length, ab.length);
        for (i = 0; i < ab.length; i++)
            assert.equal(ba[i], ab[i], "at " + i + " " + ba[i] + "!= " + ab[i]);
    });

    tr.addTest("Uint8ArrayToBase64", () => {
        let ab = new Uint8Array(256);
        for (let i = 0; i < 256; i++)
            ab[i] = i;
        let ps = Utils.Uint8ArrayToBase64(ab);
        assert.equal(ps, "AAECAwQFBgcICQoLDA0ODxAREhMUFRYXGBkaGxwdHh8gISIjJCUmJygpKissLS4vMDEyMzQ1Njc4OTo7PD0+P0BBQkNERUZHSElKS0xNTk9QUVJTVFVWV1hZWltcXV5fYGFiY2RlZmdoaWprbG1ub3BxcnN0dXZ3eHl6e3x9fn+AgYKDhIWGh4iJiouMjY6PkJGSk5SVlpeYmZqbnJ2en6ChoqOkpaanqKmqq6ytrq+wsbKztLW2t7i5uru8vb6/wMHCw8TFxsfIycrLzM3Oz9DR0tPU1dbX2Nna29zd3t/g4eLj5OXm5+jp6uvs7e7v8PHy8/T19vf4+fr7/P3+/w==");
        let ba = new Uint8Array(Utils.Base64ToUint8Array(ps));
        assert.deepEqual(ba, ab);
    });

    tr.run();
});

