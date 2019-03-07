/*@preserve Copyright (C) 2019 Crawford Currie http://c-dot.co.uk license MIT*//*eslint-env node, mocha */

if (typeof requirejs === "undefined")
    requirejs = require('requirejs');

requirejs.config({
    baseUrl: "..",
    paths: {
        js: "src",
        jsjq: "src/jquery",
        test: "test"
    }
});

requirejs(["test/StoreTester"], function(StoreTester) {
    new StoreTester([ "EncryptedStore", "LocalStorageStore" ]).run();
});
