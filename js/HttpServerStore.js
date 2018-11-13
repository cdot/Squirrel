/*@preserve Copyright (C) 2018 Crawford Currie http://c-dot.co.uk license MIT*/

/* global global:true */
/* global AbstractStore */
/* global HttpServerStore */

/**
 * 'cloud' store using ajax to communicate with a remote file server e.g.
 * the node.js.server store included in the Squirrel distribution. Or
 * node simple-server
 * python -m SimpleHTTPServer 3000
 * lighttpd
 * nginx
 * apache server
 * etc.

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
                var $user = $dlg.squirrelDialog("control", "user");
                var $pass = $dlg.squirrelDialog("control", "pass");
                var $signin = $dlg.squirrelDialog("control", "signin");
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
                        $dlg.squirrelDialog("close");
                        self.basic_auth = btoa($user.val() + ":" + $pass.data("hidden_pass"));
                        AbstractStore.call(self, params);
                    });
            })
            .squirrelDialog("open");

In GET and PUT:
                        beforeSend: function (xhr) {
                            xhr.setRequestHeader(
                                "Authorization",
                                "Basic " + self.basic_auth);
                        },
*/

function HttpServerStore(params) {
    "use strict";

    var self = this;
    self.url = global.URLPARAMS.url;

    if (!self.url)
        throw "No http_url defined, cannot start HttpServerStore";

    AbstractStore.call(self, params);
}

global.CLOUD_STORE = HttpServerStore;

HttpServerStore.prototype = Object.create(AbstractStore.prototype);

HttpServerStore.prototype.options = function () {
    "use strict";

    return $.extend(AbstractStore.prototype.options(), {
        identifier: "HTTP Server Store",
        needs_path: true
    });
};

HttpServerStore.prototype.read = function (path, ok, fail) {
    "use strict";

    var self = this;

    // We want to use the features of jQuery.ajax, but by default
    // it doesn't handle binary files. We could add a jQuery transport,
    // as described in
    // https://stackoverflow.com/questions/33902299/using-jquery-ajax-to-download-a-binary-file
    // but it feels like overkill when we can simply use a XmlHttpRequest.

    var xhr = new XMLHttpRequest();
    xhr.withCredentials = true;
    xhr.timeout = 5000; // 5 second timeout
    xhr.responseType = "arraybuffer";

    xhr.open("GET", self.url + "/" + path + "?_=" + Date.now());

    xhr.onreadystatechange = function (e) {
        if (xhr.readyState === 4 && xhr.status !== 200)
            fail.call(self, e);
    };

    xhr.onload = function ( /*e*/ ) {
        ok.call(self, xhr.response);
    };

    xhr.send();
};

HttpServerStore.prototype.write = function (path, data, ok, fail) {
    "use strict";

    var self = this;

    var xhr = new XMLHttpRequest();
    xhr.withCredentials = true;
    xhr.timeout = 5000; // 5 second timeout

    xhr.open("PUT", self.url + "/" + path + "?_=" + Date.now());

    xhr.ontimeout = function (e) {
        fail.call(self, e);
    };

    xhr.onreadystatechange = function (e) {
        if (xhr.readyState === 4 && xhr.status !== 200)
            fail.call(self, e);
    };

    xhr.onload = function ( /*e*/ ) {
        ok.call(self);
    };

    xhr.send(data);
};

if (typeof module !== "undefined")
    module.exports = HttpServerStore;