/*@preserve Copyright (C) 2019 Crawford Currie http://c-dot.co.uk license MIT*//*eslint-env node, mocha */

if (typeof requirejs === "undefined")
    requirejs = require('requirejs');

requirejs.config({
    baseUrl: ".."
});

/**
 * When run from the command line, requires $T_url to be set up to point to
 * a webdav server.
 *
 * Requires the user RIGHT_USER:RIGHT_PASSWORD to be set up in the webdav store
 * (see StoreTester). This can be overridden by setting $T_user and/or
 * $T_pass.
 */
requirejs(["test/StoreTester"], function(StoreTester) {
    new StoreTester(["WebDAVStore"]).run();
});

