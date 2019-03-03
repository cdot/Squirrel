/*@preserve Copyright (C) 2019 Crawford Currie http://c-dot.co.uk license MIT*//*eslint-env node, mocha */

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

it("LocalStorageStore", (done) => {
    const DEBUG = false;// console.debug;
    
    requirejs(["test/StoreTester"], function(StoreTester) {
        let tester = new StoreTester(["LocalStorageStore"], DEBUG);
        tester.init({})
        .then(() => {
            tester.makeTests(describe, it);
            done();
        });
    });
});
