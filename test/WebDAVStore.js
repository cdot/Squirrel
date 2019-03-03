/*@preserve Copyright (C) 2019 Crawford Currie http://c-dot.co.uk license MIT*//*eslint-env node, mocha */

if (typeof module !== "undefined") {
    requirejs = require('requirejs');
}

requirejs.config({
    baseUrl: "..",
    nodeRequire: require,
    paths: {
        js: "src",
        jsjq: "src/jquery",
        test: "test",
        jquery: "libs/test/jquery-3.3.1"
    }
});

/**
 * When run from the command line, requires $STORE_URL to be set up to point to
 * a webdav server.
 *
 * Requires the user RIGHT_USER:RIGHT_PASSWORD to be set up in the webdav store
 * (see StoreTester). This can be overridden by setting $STORE_USER and/or
 * $STORE_PASS.
 */
it("WebDAVStore", function(done) {
    let DEBUG = console.debug;
    let self = this;
    this.timeout(600000);
    requirejs(["js/Utils", "test/StoreTester"], function(Utils, StoreTester) {
        let tester = new StoreTester(["WebDAVStore"], DEBUG);      
        tester.init({})
        .then(() => {
            tester.makeTests(describe, it);
            done();
        });
    });
});
