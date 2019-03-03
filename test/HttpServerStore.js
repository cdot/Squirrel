/*@preserve Copyright (C) 2019 Crawford Currie http://c-dot.co.uk license MIT*/
/*eslint-env node, mocha */

if (typeof module !== "undefined") {
    requirejs = require('requirejs');
    requirejs.config({
        baseUrl: "..",
        paths: {
            js: "src",
            jsjq: "src/jquery",
            test: "test"
        }
    });
}

var server;
var datastore = {};

it("Setup", function(done) {
    const DEBUG = false;//console.debug;

    let self = this;
    
    let deps = ["test/StoreTester"];
    if (typeof module !== "undefined") {
        deps.push("express");
        deps.push("express-basic-auth");
    }

    config = Promise.resolve();

    requirejs(deps, function(StoreTester, express, basicAuth) {
        let p;
        if (express) { // node.js, express is available, make a simple server
            // Express server for use with node.js
            let app = express();
            let users = {};
            console.log(StoreTester);
            users[StoreTester.user().user] = StoreTester.user().pass;
            app.use(basicAuth({
                users: users
            }));
            app.use(function(req, res, next) {
                let chunks = [];
                req.on('data', function(chunk) {
                    chunks.push(chunk);
                });

                req.on('end', function() {
                    req.body = Buffer.concat(chunks);
                    next();
                });
            });
            app.put('/*', (req, res) => {
                datastore[req.path] = req.body;
                res.sendStatus(200);
            });
            app.get('/*', (req, res) => {
                if (typeof datastore[req.path] !== "undefined") {
                    res.send(datastore[req.path]);
                    return;
                }
                res.sendStatus(404);
            });
            config = new Promise((resolve, reject) => {
                server = app.listen(function() {
                    let url = "http://localhost:" + server.address().port;
                    if (DEBUG) DEBUG("Express server listening on " + url);
                    resolve({ url: url });
                });
            });
        }
        
        config.then((cfg) => {
            requirejs(["test/StoreTester"], function(StoreTester) {
                if (DEBUG) DEBUG("Using HTTP server at ", cfg);
                let tester = new StoreTester(["HttpServerStore"], DEBUG);
                tester.init(cfg)
                .then(() => {
                    tester.makeTests(describe, it);
                    done();
                });
            });
        });
    });
});

after(function() {
    if (server) {
        server.close();
    }
});
