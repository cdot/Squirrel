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
 */

function HttpServerStore(params) {
    "use strict";

    var self = this;
    self.url = global.URLPARAMS.url;

    if (!self.url)
        throw "No http_url defined, cannot start HttpServerStore";

    /* NOT NEEDED, browser authentication cache deals with it
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
    */
    AbstractStore.call(self, params);
    /*
                    });
            })
            .squirrelDialog("open");
    */
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

    $.ajax({
            url: self.url + "/" + path + "?t=" + Date.now(),
            cache: false,
            processData: false,

            /* NOT NEEDED, browser authentication cache deals with it
                        beforeSend: function (xhr) {
                            xhr.setRequestHeader(
                                "Authorization",
                                "Basic " + self.basic_auth);
                        },
            */

            success: function (response, status, xhr) {
                var type = xhr.getResponseHeader('Content-Type');
                var blob = new Blob([response], {
                    type: type
                });
                var fileReader = new FileReader();
                fileReader.onload = function (event) {
                    ok.call(self, event.target.result);
                };
                fileReader.readAsArrayBuffer(blob);
            }
        })
        .fail(function (e) {
            fail.call(self, e);
        });
};

HttpServerStore.prototype.write = function (path, data, ok, fail) {
    "use strict";

    var self = this;

    $.ajax({
            url: self.url + "/" + path,
            data: data,
            processData: false,

            /* NOT NEEDED, browser authentication cache deals with it
                        beforeSend: function (xhr) {
                            xhr.setRequestHeader(
                                "Authorization",
                                "Basic " + self.basic_auth);
                        },
            */

            type: "POST"
        })
        .done(function (d) {
            ok.call(self, d);
        })
        .fail(function (e) {
            fail.call(self, e);
        });
};

if (typeof module !== "undefined")
    module.exports = HttpServerStore;