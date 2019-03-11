/*@preserve Copyright (C) 2019 Crawford Currie http://c-dot.co.uk license MIT*//*eslint-env node, mocha */

if (typeof module !== "undefined")
    throw new Error("This test is not runnable from node.js");

requirejs.config({
    baseUrl: "..",
    paths: {
        js: "src",
        test: "test"
    }
});

requirejs(["test/TestRunner", "js/Steganographer", "js/Utils", "jquery"], function(TestRunner, Steganographer, Utils) {
    let tr = new TestRunner("Pseudoword");
    let assert = tr.assert;
    const TESTR = "1234567普通话/普通話العَرَبِيَّة";

    tr.addTest("insert.extract small", function() {
        let steg = new Steganographer({ debug: console.debug });
        let a = Utils.StringToUint8Array(TESTR);
        let id = steg.insert(a, $("#source")[0]);

        // Write the image to the canvas
        let canvas = $("#dest")[0];
        canvas.width = id.width;
        canvas.height = id.height;
        let cxt = canvas.getContext("2d");
        cxt.putImageData(id, 0, 0);

        let gets = new Steganographer({ debug: console.debug });
        console.log("Extracting");
        let b = gets.extract(id);
        assert.deepEqual(b, a);
    });

    tr.addTest("insert.extract large", function() {
        let steg = new Steganographer({ debug: console.debug });
        let a = new Uint8Array(100000);
        for (let i = 0; i < 100000; i++
             a[i] = i;
        let id = steg.insert(a, $("#source")[0]);

        // Write the image to the canvas
        let canvas = $("#dest")[0];
        canvas.width = id.width;
        canvas.height = id.height;
        let cxt = canvas.getContext("2d");
        cxt.putImageData(id, 0, 0);

        let gets = new Steganographer({ debug: console.debug });
        console.log("Extracting");
        let b = gets.extract(id);
        for (let i = 0; i < 100000; i++
             assert.equal(b[i], i);
    });

    tr.run();
});
