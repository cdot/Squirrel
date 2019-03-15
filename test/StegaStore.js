/*@preserve Copyright (C) 2019 Crawford Currie http://c-dot.co.uk license MIT*//*eslint-env node, mocha */

if (typeof module !== "undefined")
    throw new Error("This test is not runnable from node.js");


requirejs.config({
    baseUrl: ".."
});

requirejs(["test/StoreTester"], function(StoreTester) {
    new StoreTester([ "StegaStore", "LocalStorageStore" ], console.debug).run();
});
