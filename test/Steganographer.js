/*@preserve Copyright (C) 2019 Crawford Currie http://c-dot.co.uk license MIT*//*eslint-env node, mocha */

if (typeof module !== "undefined") {
/*    requirejs = require('requirejs');
    // node.js
    const { JSDOM } = require('jsdom');
    document = new JSDOM('<!doctype html><html><body id="working"></body></html>');
    const { window } = document;
    global.window = window;
    global.document = window.document;
    global.navigator = { userAgent: "node.js" };
    let jQuery = require('jquery');
    global.jQuery = jQuery;
    global.$ = jQuery;
*/
    throw new Error("This test is not runnable from node.js");
}

requirejs.config({
    baseUrl: ".."
});

requirejs(["test/TestRunner", "js/Steganographer", "js/Utils", "jquery"], function(TestRunner, Steganographer, Utils) {
    let tr = new TestRunner("Pseudoword");
    let assert = tr.assert;
    const TESTR = "1234567普通话/普通話العَرَبِيَّة";

    tr.addTest("insert.extract small", function() {
        let steg = new Steganographer({ debug: console.debug });
        let a = Utils.StringToUint8Array(TESTR);
        let id = steg.insert(a, $("#source")[0]);

        let gets = new Steganographer({ debug: console.debug });
        console.log("Extracting");
        let b = gets.extract(id);
        assert.deepEqual(b, a);
    });

    tr.addTest("insert.extract large", function() {
        let steg = new Steganographer({ debug: console.debug });
        const len = 14760; // bytes
        let a = new Uint8Array(len);
        for (let i = 0; i < len; i++)
            a[i] = (i & 0xFF);
        let id = steg.insert(a, $("#source")[0]);

        let gets = new Steganographer({ debug: console.debug });
        console.log("Extracting");
        let b = gets.extract(id);
        for (let i = 0; i < len; i++)
            assert.equal(b[i], (i & 0xFF));
    });

    tr.run();
});
