/*@preserve Copyright (C) 2016-2018 Crawford Currie http://c-dot.co.uk license MIT*/
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

// Was using chai-http, but couldn't work out how to test the body
// of a response :-( So use "Request" instead, as described in
// https://davidbeath.com/posts/testing-http-responses-in-nodejs.html
requirejs(["js/Utils", "js/AES", "js/Server", "fs", "request-promise-any", "test/TestRunner"], function(Utils, AES, Server, Fs, request, TestRunner) { 

    let tr = new TestRunner("Server");
    let assert = tr.assert;
    const workingLocation = "working";
    const workingDir = __dirname + '/' + workingLocation;

    // The server will start in the directory where the test lives
    let server_config = {
        //debug: console.debug,
        //log: console.log,
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

    tr.addTest("no-auth-get", () => {
        return new Promise((resolve) => {
            request.get(serverUrl + '/')
            .then((r) => {
                console.log(r);
                assert(false, "Unexpected");
            })
            .catch((e) => {
                assert.equal(e.statusCode, 401);
                resolve();
            });
        });
    });

    tr.addTest("bad-auth-get", () => {
        return new Promise((resolve) => {
        request.get(workingUrl, {
            auth: { user: "plum", pass: "fairy" }
        })
        .then(() => {
            assert("Unexpected");
        })
        .catch((e) => {
            assert.equal(e.statusCode, 401);
            resolve();
        });
        });
    });
                
    tr.addTest("bad-root-get", (resolve) => {
        return new Promise((resolve) => {
            request.get(serverUrl + '/', {
                auth: {
                    user: server_config.auth.user,
                    pass: server_config.auth.pass
                }
            })
            .then(() => {
                assert("Unexpected");
            })
            .catch((err) => {
                assert.equal(err.statusCode, 500);
                assert.equal(err.response.body, "Error: EISDIR: illegal operation on a directory, readError: EISDIR: illegal operation on a directory, read");
                resolve();
            });
        });
    });

    tr.addTest("doesnt_support_post", () => {
        return new Promise((resolve) => {
            request.post(serverUrl + '/', {
                auth: {
                    user: server_config.auth.user,
                    pass: server_config.auth.pass
                }
            })
            .then(() => {
                assert("Unexpected");
            })
            .catch((e) => {
                assert.equal(e.statusCode, 405);
                assert.equal(e.response.body, "No support for POST");
                resolve();
            });
        });
    });

    tr.addTest("text-file-get-8bit", () => {
        return request.get(serverUrl + '/testData.8', {
            auth: { user: server_config.auth.user,
                    pass: server_config.auth.pass },
            encoding: null
        })
        .then((body) => {
            body = Utils.Uint8ArrayToString(new Uint8Array(body));
            assert.equal(body, "Some 8 bit text");
        });
    });

    tr.addTest("text-file-get-16bit", () => {
        return request.get(serverUrl + '/testData.16', {
            auth: { user: server_config.auth.user,
                    pass: server_config.auth.pass },
            encoding: null
        },  function(err, res, body) {
            assert.equal(res.statusCode, 200);
            assert.equal(res.headers['content-type'],
                         "application/octet-stream");
            assert.equal(body,
                         "\0" + "Some 16 bit text".split('').join("\0") + "\n");
        });
    });
                
    tr.addTest("text-file-post-8bit", () => {
        var ef = workingDir + "/transitory8";
        try {
            Fs.unlinkSync(ef);
        } catch (e) {};
                    
        return request.put(workingUrl + '/transitory8', {
            auth: { user: server_config.auth.user,
                    pass: server_config.auth.pass },
            encoding: null,
            body: "Some 8 bit text",
        })
        .then(() => {
            assert(Fs.existsSync(ef));
            return request.get(workingUrl + '/transitory8', {
                auth: { user: server_config.auth.user,
                        pass: server_config.auth.pass },
                encoding: null,
            })
            .then((body) => {
                assert.equal(body, "Some 8 bit text");
                Fs.unlinkSync(ef);
            });
        });
    });

    tr.addTest("text-file-post-16bit", () => {
        var ef = workingDir + "/transitory16";
        try {
            Fs.unlinkSync(ef);
        } catch (e) {}
        var text = "\0S\0o\0m\0e\0 \0" + "1\0" + "6\0 \0b\0i\0t\0 \0t\0e\0x\0t";
                    
        return request.put(workingUrl + '/transitory16', {
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
            });
        });
    });

    tr.addTest("bad-post", () => {
        return new Promise((resolve) => {
            request.put(serverUrl + '/banished', {
                auth: { user: server_config.auth.user,
                        pass: server_config.auth.pass },
                encoding: null,
                body: "Delete this file",
            })
            .then(() => {
                assert(false, "Unexpected");
            })
            .catch((err) => {
                assert.equal(err.statusCode, 403);
                assert(!Fs.existsSync(__dirname + "/banished"));
                resolve();
            })
        });
    });

    // Make sure a loop through encryption works
    tr.addTest("encrypt-decrypt", () => {
        var ef = workingDir + "/encrypted";
        try {
            Fs.unlinkSync(ef);
        } catch (e) {}
        var text = "Alice, Bob, Charlie, and Doug";
        var pass = "password";
        var xa = AES.encrypt(Utils.StringToUint8Array(text), pass, 256);
                    
        return request.put(workingUrl + '/encrypted', {
            auth: { user: server_config.auth.user,
                    pass: server_config.auth.pass },
            encoding: null,
            body: xa,
        })
        .then(() => {
            assert(Fs.existsSync(ef));
        })
        .then(() => {
            return request.get(workingUrl + '/encrypted', {
                auth: { user: server_config.auth.user,
                        pass: server_config.auth.pass },
                encoding: null,
            });
        })
        .then((body) => {
            var s = Utils.Uint8ArrayToString(AES.decrypt(body, pass, 256));
            assert.equal(s, text);
            Fs.unlinkSync(ef);
        });
    });

    let server = new Server(server_config);
    server.start()
    .then(() => {
        return tr.run();
    })
    .then(() => {
        server.stop();
    });
});

