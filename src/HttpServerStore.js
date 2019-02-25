/*@preserve Copyright (C) 2018-2019 Crawford Currie http://c-dot.co.uk license MIT*/

/* global Serror:true */
/* global AbstractStore:true */
if (typeof module !== "undefined") {
    Serror = require("../src/Serror");
    AbstractStore = require("../src/AbstractStore");
}

/**
 * 'cloud' store using ajax to communicate with a remote file server e.g.
 * the node.js.server store included in the Squirrel distribution. Or
 * node simple-server
 * python -m SimpleHTTPServer 3000
 * lighttpd
 * nginx
 * apache server
 * etc.

TODO: If the code is served from the same server as the content then the basic
auth negotiation has already happened by the time the first store request is
made, and we don't need to prompt for auth. But if it's one a different
server then we have to be able to handle a 401.
*/

class HttpServerStore extends AbstractStore {
    constructor(p) {
        super(p);
        this.option("type", "HttpServerStore");
        this.option("needs_url", true);
    }

    read(path) {
        // We want to use the features of jQuery.ajax, but by default
        // it doesn't handle binary files. We could add a jQuery transport,
        // as described in
        // https://stackoverflow.com/questions/33902299/using-jquery-ajax-to-download-a-binary-file
        // but it feels like overkill when we can simply use a XmlHttpRequest.

        let xhr = new XMLHttpRequest();
        xhr.withCredentials = true;
        xhr.timeout = 5000; // 5 second timeout
        xhr.responseType = "arraybuffer";

        xhr.open("GET", this.option("url") + "/" + path + "?_=" + Date.now());
        xhr.send();
        return new Promise((resolve, reject) => {
            xhr.onreadystatechange = function (e) {
                if (xhr.readyState != 4)
                    return;

                if (200 > xhr.status || xhr.status >= 300)
                    reject(new Serror(path, xhr.status, e));
            };

            xhr.ontimeout = function() {
                reject(new Serror(path, 408, 'Timeout exceeded'));
            };

            xhr.onload = function ( /*e*/ ) {
                resolve(xhr.response);
            };
        });
    }

    write(path, data) {
        let xhr = new XMLHttpRequest();
        xhr.withCredentials = true;
        xhr.timeout = 5000; // 5 second timeout

        xhr.open("PUT", this.option("url") + "/" + path + "?_=" + Date.now());
        xhr.send(data);

        return new Promise((resolve, reject) => {
            xhr.ontimeout = function (e) {
                reject(new Serror(path, xhr.status, e));
            };

            xhr.onreadystatechange = function (e) {
                if (xhr.readyState === 4 && xhr.status !== 200)
                    reject(new Serror(path, xhr.status, e));
            };

            xhr.onload = function ( /*e*/ ) {
                resolve();
            };
        });
    }
}

if (typeof module !== "undefined")
    module.exports = HttpServerStore;
