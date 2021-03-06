/*@preserve Copyright (C) 2019 Crawford Currie http://c-dot.co.uk license MIT*/
/*eslint-env node, mocha */

if (typeof requirejs === "undefined")
    requirejs = require('requirejs');

requirejs.config({
    baseUrl: ".."
});

var server;
var datastore = {};

let deps = ["test/StoreTester"];
if (typeof module !== "undefined") {
    deps.push("express");
    deps.push("express-basic-auth");
}

requirejs(deps, function(StoreTester, express, basicAuth) {
    let config = Promise.resolve();

    if (express) {
        // node.js, express is available, make a simple server
        let app = express();

        let express_user = "u" + Date.now();
        let express_pass = "p" + express_user;

        let users = {};
        users[express_user] = express_pass;
        console.log("Server users:",users);
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

        config = new Promise((resolve) => {
            server = app.listen(function() {
                let url = "http://localhost:" + server.address().port;
                console.debug("Express server listening on " + url);
                resolve({ url: url, net_user: express_user, net_pass: express_pass });
            });
        });
    }

    config.then((cfg) => {
        new StoreTester(["HttpServerStore"])
		.run(cfg)
        .then(() => {
                server.close();
        })
		.catch((e) => { console.log("Run failed", e); });
    });
});

