/*@preserve Copyright (C) 2019 Crawford Currie http://c-dot.co.uk license MIT*/
/*eslint-env node, mocha */

import { assert } from "chai";
import { StoreTester } from "./StoreTester.js";
import Express from "express";
import BasicAuth from "express-basic-auth";
import { jsdom } from "./jsdom.js";
import Cors from "cors";

const suite = describe("HttpServerStore", () => {

  let server;
  let datastore = {};

  // node.js, express is available, make a simple server
  let app = new Express();

  let express_user = "u" + Date.now();
  let express_pass = "p" + express_user;

  let users = {};
  users[express_user] = express_pass;

  console.log("Server users:", users);

  app.use(Cors());

  app.use(BasicAuth({
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
    const buf = req.body;
    //console.debug("HSS_unit PUT", req.path);
    datastore[req.path] = req.body;
    res.sendStatus(200);
  });

  app.get('/*', (req, res) => {
    if (typeof datastore[req.path] !== 'undefined') {
      //console.debug("HSS_unit GET", req.path);
      res.end(datastore[req.path], "binary");
      return;
    }
    res.sendStatus(404);
  });

  before(
    () => jsdom()
    .then(() => new Promise(resolve => {
      server = app.listen(function() {
        let url = "http://localhost:" + server.address().port;
        console.debug("Express server listening on " + url);
        resolve({
          url: url,
          net_user: express_user,
          net_pass: express_pass
        });
      });
    }))
    .then(config => {
      //config.debug = console.debug;
      return new StoreTester(["HttpServerStore"]).setup(suite, config);
    }));

  after(() => server.close());

  it("Placeholder", () => {});
});

