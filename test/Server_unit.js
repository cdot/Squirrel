/*@preserve Copyright (C) 2016-2023 Crawford Currie http://c-dot.co.uk license MIT*/
/*eslint-env node, mocha */

import chai from "chai";
const assert = chai.assert;
import http from "chai-http";
chai.use(http);
import Url from "url";
import Path from "path";
const __dirname = Path.dirname(Url.fileURLToPath(import.meta.url));

import { Utils } from "../src/Utils.js";
import { Cryptographer } from "../src/Cryptographer.js";
import { Server } from "../src/Server.js";
import { promises as Fs } from "fs";
import tmp from "tmp-promise";

describe("Server", () => {

  const workingLocation = "working";
  const workingDir = __dirname + "/" + workingLocation;

  // The server will start in the directory where the test lives
  let server_config = {
    //debug: console.debug,
    port: 13198,
    writable: workingLocation,
    //debug: true, log_requests: true,
    auth: {
      user: "test",
      pass: "x",
      realm: "Test Server"
    }
  };

  const serverUrl = `http://localhost:${server_config.port}/`;

  let tmpdir;
  const fixtures = [ "testData.8", "testData.16" ];
  const fixtureDir = `${__dirname}/fixtures`;

  before(
    () => tmp.dir({ unsafeCleanup: true })
    .then(p => tmpdir = p.path));
  
  function UNit() {}

  it("no-auth-get", () => {
    const config = {
      port: 13198,
      docroot: fixtureDir
    };
    delete config.auth;
    const server = new Server(config);
    return chai.request(server.express)
    .get("/testData.8")
    .then(r => {
      assert.equal(r.status, 200);
    })
    .catch(e => {
      assert.fail("Unexpected " + e);
    });
  });

  it("bad-auth-get", () => {
    const server = new Server(server_config);
    return chai.request(server.express)
    .get(serverUrl, {
      auth: { username: "plum", password: "fairy" }
    })
    .then(() => {
      assert("Unexpected");
    })
    .catch(e => {
      assert.equal(e.response.status, 401);
    });
  });

  it("bad-root-get", () => {
    const server = new Server(server_config);
    return chai.request(server.express)
    .get(serverUrl, {
      auth: {
        username: server_config.auth.user,
        password: server_config.auth.pass
      }
    })
    .then(() => {
      assert("Unexpected");
    })
    .catch(err => {
      assert.equal(err.response.status, 500);
      assert.equal(err.response.data, "Error: EISDIR: illegal operation on a directory, readError: EISDIR: illegal operation on a directory, read");
    });
  });

  const binaryParser = function (res, cb) {
    res.setEncoding('binary');
    res.data = '';
    res.on("data", function (chunk) {
        res.data += chunk;
    });
    res.on('end', function () {
        cb(null, new Buffer(res.data, 'binary'));
    });
  };

  it("text-file-get-8bit", async () => {
    server_config.docroot = fixtureDir;
    const server = new Server(server_config);
    return server.start()
    .then(
      () => chai.request(server.express)
      .get("/testData.8")
      .auth(server_config.auth.user, server_config.auth.pass)
      .buffer()
      .parse(binaryParser))
    .then(res => {
      assert.equal(res.status, 200);
      assert.equal(res.headers['content-type'],
                   "application/octet-stream");
      assert.equal(res.body.toString(), "Some 8 bit text");
      server.stop();
    });
  });

  it("text-file-get-16bit", () => {
    server_config.docroot = fixtureDir;
    const server = new Server(server_config);
    return server.start()
    .then(
      () => chai.request(server.express)
      .get("/testData.16")
      .auth(server_config.auth.user, server_config.auth.pass)
      .buffer()
      .parse(binaryParser))
		.then(res => {
      assert.equal(res.status, 200);
      assert.equal(res.headers['content-type'],
                   "application/octet-stream");
      assert.equal(res.body.toString(),
                   '\0' + "Some 16 bit text".split("").join("\0") + "\n");
      server.stop();
    });
  });

  it("text-file-put-get-8bit", () => {
    server_config.docroot = tmpdir;
    const server = new Server(server_config);
    let testData;
    return Fs.readFile(`${fixtureDir}/testData.8`)
    .then(td => testData = td)
    .then(() => server.start())
    .then(
      () => chai.request(server.express)
      .put("/transitory8")
      .set('content-type', 'application/octet-stream')
      .send(testData)
      .auth(server_config.auth.user, server_config.auth.pass))
    .then(res => {
      assert.equal(res.status, 200);
      return chai.request(server.express)
      .get("/transitory8")
      .auth(server_config.auth.user, server_config.auth.pass)
      .buffer()
      .parse(binaryParser);
    })
    .then(res => {
      assert.deepEqual(res.body, testData);
      server.stop();
    });
  });

  it("text-file-put-get-16bit", () => {
    server_config.docroot = tmpdir;
    const server = new Server(server_config);
    let testData;
    return Fs.readFile(`${fixtureDir}/testData.16`)
    .then(td => testData = td)
    .then(() => server.start())
    .then(
      () => chai.request(server.express)
      .put("/transitory16")
      .set('content-type', 'application/octet-stream')
      .send(testData)
      .auth(server_config.auth.user, server_config.auth.pass))
    .then(res => {
      assert.equal(res.status, 200);
      return chai.request(server.express)
      .get("/transitory16")
      .auth(server_config.auth.user, server_config.auth.pass)
      .buffer()
      .parse(binaryParser);
    })
    .then(res => {
      assert.deepEqual(res.body, testData);
      server.stop();
    });
  });

  // Make sure encrypted data works
  it("encrypted-data", () => {
    server_config.docroot = tmpdir;
    const server = new Server(server_config);
    const text = "Alice, Beatrice, Caroline, and Daphne";
    const pass = "$ecret";
    let cipherData;
    return Cryptographer.encrypt(Utils.StringToUint8Array(text), pass)
    .then(cd => cipherData = Buffer.from(cd))
    .then(() => chai.request(server.express)
          .put('/encrypted')
          .set('content-type', 'application/octet-stream')
          .send(cipherData)
          .auth(server_config.auth.user, server_config.auth.pass))
    .then(
      () => chai.request(server.express)
      .get('/encrypted')
      .auth(server_config.auth.user, server_config.auth.pass)
      .buffer()
      .parse(binaryParser))
		.then(res => {
      assert.deepEqual(cipherData, res.body);
			const data = Uint8Array.from(res.body);
			return Cryptographer.decrypt(data, pass);
		})
		.then(ab => {
			const plaintext = Utils.Uint8ArrayToString(ab);
      assert.equal(plaintext, text);
    });
  });
});
