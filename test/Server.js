/*@preserve Copyright (C) 2016-2018 Crawford Currie http://c-dot.co.uk license MIT*/

/*eslint-env node */

/**
 * Simple test for node.js HTTP server
 */
const Server = require("../src/Server.js");
const Fs = require("fs");

const chai = require("chai");
const assert = chai.assert;

// Stuff for encryption/decryption test
const AES = require("../src/AES.js");
const Utils = require("../src/Utils.js");

// Was using chai-http, but couldn't work out how to test the body
// of a response :-( So use "Request" instead, as described in
// https://davidbeath.com/posts/testing-http-responses-in-nodejs.html
const request = require('request')

const workingLocation = "working";
const workingDir = __dirname + '/' + workingLocation;

// The server will start in the directory where the test lives
var server_config = {
    port: 13198,
    docroot: __dirname,
    writable: workingLocation,
    //debug: true, log_requests: true,
    auth: {
        user: "test",
        pass: "x",
        realm: "Test Server"}
};

const serverUrl = "http://localhost:" + server_config.port;
const workingUrl = serverUrl + '/' + workingLocation;

describe("server/Server", function() {

    var server;

    before(function() {
        server = new Server(server_config);
        server.start().then(function() {
            return server;
        });
    });

    after(function() {
        server.stop();
    });
    
    it("no-auth-get", function(done) {
        request.get(serverUrl + '/', function(err, res, body) {
            assert.equal(res.statusCode, 401);
            done();
        });
    });

    it("bad-auth-get", function(done) {
        request.get('http://localhost:13198/', {
            auth: { user: "plum", pass: "fairy" }
        }, function(err, res, body) {
            assert.equal(res.statusCode, 401);
            done();
        });
    });
   
    it("bad-root-get", function(done) {
        request.get(serverUrl + '/', {
            auth: {
                user: server_config.auth.user,
                pass: server_config.auth.pass
            }
        }, function(err, res, body) {
            assert.equal(res.statusCode, 500);
            assert.equal(body, "Error: EISDIR: illegal operation on a directory, readError: EISDIR: illegal operation on a directory, read");
            done();
        });
    });

    it("doesnt_support_post", function(done) {
        request.post(serverUrl + '/', {
            auth: {
                user: server_config.auth.user,
                pass: server_config.auth.pass
            }
        }, function(err, res, body) {
            assert.equal(res.statusCode, 405);
            assert.equal(body, "No support for POST");
            done();
        });
    });

    it("text-file-get-8bit", function(done) {
        request.get(serverUrl + '/testData.8', {
            auth: { user: server_config.auth.user,
                    pass: server_config.auth.pass },
            encoding: null
        },  function(err, res, body) {
            assert.equal(res.statusCode, 200);
            assert.equal(res.headers['content-type'], "application/octet-stream");
            assert.equal(body, "Some 8 bit text");
            done();
        });
    });
    
    it("text-file-get-16bit", function(done) {
        request.get(serverUrl + '/testData.16', {
            auth: { user: server_config.auth.user,
                    pass: server_config.auth.pass },
            encoding: null
        },  function(err, res, body) {
            assert.equal(res.statusCode, 200);
            assert.equal(res.headers['content-type'],
                         "application/octet-stream");
            assert.equal(body,
                         "\0" + "Some 16 bit text".split('').join("\0") + "\n");
            done();
        });
    });
    
    it("text-file-post-8bit", function(done) {
        var ef = workingDir + "/transitory8";
        try {
            Fs.unlinkSync(ef);
        } catch (e) {};
        
        request.put(workingUrl + '/transitory8', {
            auth: { user: server_config.auth.user,
                    pass: server_config.auth.pass },
            encoding: null,
            body: "Some 8 bit text",
        },  function(err, res, body) {
            assert.equal(res.statusCode, 200);
            assert(Fs.existsSync(ef));
            request.get(workingUrl + '/transitory8', {
                auth: { user: server_config.auth.user,
                        pass: server_config.auth.pass },
                encoding: null,
            },  function(err, res, body) {
                assert.equal(res.statusCode, 200);
                assert.equal(res.headers['content-type'], "application/octet-stream");
                assert.equal(body, "Some 8 bit text");
                Fs.unlinkSync(ef);
                done();
            });
        });
    });

    it("text-file-post-16bit", function(done) {
        var ef = workingDir + "/transitory16";
        try {
            Fs.unlinkSync(ef);
        } catch (e) {}
        var text = "\0S\0o\0m\0e\0 \0" + "1\0" + "6\0 \0b\0i\0t\0 \0t\0e\0x\0t";
        
        request.put(workingUrl + '/transitory16', {
            auth: { user: server_config.auth.user,
                    pass: server_config.auth.pass },
            encoding: null,
            body: text,
        },  function(err, res, body) {
            assert.equal(res.statusCode, 200);
            assert(Fs.existsSync(ef));
            request.get(workingUrl + '/transitory16', {
                auth: { user: server_config.auth.user,
                        pass: server_config.auth.pass },
                encoding: null,
            },  function(err, res, body) {
                assert.equal(res.statusCode, 200);
                assert.equal(res.headers['content-type'], "application/octet-stream");
                assert.equal(body, text);
                Fs.unlinkSync(ef);
                done();
            });
        });
    });

    it("bad-post", function(done) {
        request.put(serverUrl + '/banished', {
            auth: { user: server_config.auth.user,
                    pass: server_config.auth.pass },
            encoding: null,
            body: "Delete this file",
        },  function(err, res, body) {
            assert.equal(res.statusCode, 403);
            assert(!Fs.existsSync(__dirname + "/banished"));
            done();
        });
    });

    // Make sure a loop through encryption works
    it("encrypt-decrypt", function(done) {
        var ef = workingDir + "/encrypted";
        try {
            Fs.unlinkSync(ef);
        } catch (e) {}
        var text = "Alice, Bob, Charlie, and Doug";
        var pass = "password";
        var xa = AES.encrypt(Utils.StringToArrayBuffer(text), pass, 256);
   
        request.put(workingUrl + '/encrypted', {
            auth: { user: server_config.auth.user,
                    pass: server_config.auth.pass },
            encoding: null,
            body: xa,
        },  function(err, res, body) {
            assert.equal(res.statusCode, 200);
            assert(Fs.existsSync(ef));
            
            request.get(workingUrl + '/encrypted', {
                auth: { user: server_config.auth.user,
                        pass: server_config.auth.pass },
                encoding: null,
            },  function(err, res, body) {
                assert.equal(res.statusCode, 200);
                assert.equal(res.headers['content-type'], "application/octet-stream");
                var s = Utils.ArrayBufferToString(AES.decrypt(body, pass, 256));
                assert.equal(s, text);
                Fs.unlinkSync(ef);
                done();
            });
        });
    }); 
});
