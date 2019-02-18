/*@preserve Copyright (C) 2018-2019 Crawford Currie http://c-dot.co.uk license MIT*/

if (typeof AbstractStore === "undefined")
    AbstractStore = require("./AbstractStore");

/**
 * 'cloud' store using ajax to communicate with a remote file server e.g.
 * the node.js.server store included in the Squirrel distribution. Or
 * node simple-server
 * python -m SimpleHTTPServer 3000
 * lighttpd
 * nginx
 * apache server
 * etc.
 */

/*
if the code is served from the same server as the content then the basic
auth negotiation has already happened by the time the first store request is
made, and we don't need to prompt for auth. But if it's one a different
server then we have to be able to handle a 401.

// Cannot use the store pass because any layered encryption store
// will use the same pass, so have to prompt for BasicAuth separately.
// Do that as early as possible.
$('#http_login_dlg')
.on('dlg-open', function (e, options) {
var $dlg = $(this);
var $user = $dlg.squirrel_dialog("control", "user");
var $pass = $dlg.squirrel_dialog("control", "pass");
var $signin = $dlg.squirrel_dialog("control", "signin");
$user
.attr("autofocus", "autofocus")
.off("change")
.on("change", function () {
$pass.focus();
})
$pass
.off("change")
.on("change", function () {
$signin.focus();
})
$signin
.off($.getTapEvent())
.on($.getTapEvent(), function () {
$dlg.squirrel_dialog("close");
self.basic_auth = btoa($user.val() + ":" + $pass.data("hidden_pass"));
AbstractStore.call(self, params);
});
})
.squirrel_dialog("open");

In GET and PUT:
beforeSend: function (xhr) {
xhr.setRequestHeader(
"Authorization",
"Basic " + self.basic_auth);
},
*/

class HttpServerStore extends AbstractStore {
    constructor(p) {
        super(p);
    }

    option(k, v) {
        if (k === "needs_url")
            return true;
        return super.option(k, v);
    }

    read(path) {
        // We want to use the features of jQuery.ajax, but by default
        // it doesn't handle binary files. We could add a jQuery transport,
        // as described in
        // https://stackoverflow.com/questions/33902299/using-jquery-ajax-to-download-a-binary-file
        // but it feels like overkill when we can simply use a XmlHttpRequest.

        var xhr = new XMLHttpRequest();
        xhr.withCredentials = true;
        xhr.timeout = 5000; // 5 second timeout
        xhr.responseType = "arraybuffer";

        xhr.open("GET", this.option("url") + "/" + path + "?_=" + Date.now());
        xhr.send();
        return new Promise((resolve, reject) => {
            xhr.onreadystatechange = function (e) {
                if (xhr.readyState != 4)
                    return;

                if (xhr.status !== 200)
                    reject(new Error(e));
            };

            xhr.ontimeout = function() {
                reject(new Error('Timeout exceeded'));
            };            
            xhr.onload = function ( /*e*/ ) {
                resolve(xhr.response);
            };
        });
    }

    write(path, data) {
        var xhr = new XMLHttpRequest();
        xhr.withCredentials = true;
        xhr.timeout = 5000; // 5 second timeout

        xhr.open("PUT", this.option("url") + "/" + path + "?_=" + Date.now());
        xhr.send(data);
    
        return new Promise((resolve, reject) => {
            xhr.ontimeout = function (e) {
                reject(new Error(e));
            };

            xhr.onreadystatechange = function (e) {
                if (xhr.readyState === 4 && xhr.status !== 200)
                    reject(new Error(e));
            };

            xhr.onload = function ( /*e*/ ) {
                resolve();
            };
        });
    }
}

if (typeof module !== "undefined")
    module.exports = HttpServerStore;
