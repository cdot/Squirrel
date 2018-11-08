/*@preserve Copyright (C) 2018 Crawford Currie http://c-dot.co.uk license MIT*/

/* global global:true */
/* global HttpServerStore */

/**
 * 'cloud' store using ajax to communicate with a remote file server e.g.
 * 
 * npm i -g simple-server
 * simple-server directory_to_server 3000
 *
 * or
 *
 * python -m SimpleHTTPServer 3000
 */

global.CLOUD_STORE = HttpServerStore;

/*
  SMELL: currently the same pass is used for basic auth and for encryption.
  This is bad, because BasicAuth is wide open and the pass could be
  intercepted, leaving the encrypted store exposed. Similarly we don't
  want to put the BasicAuth pass into the URL that starts Squirrel. So we
  should prompt for an "basicauth password". Can do that, it's just a bit
  more work.
*/
function HttpServerStore(params) {
    "use strict";

    var self = this;
    AbstractStore.call(self, params);
    self.url = global.URLPARAMS.url;
    if (!self.url)
        throw "No http_url defined, cannot start HttpServerStore";
}

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
            /*
                        beforeSend: function (xhr) {
                            xhr.setRequestHeader(
                                "Authorization",
                                "Basic " + btoa(self.user() + ":" + self.pass()));
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
            /*
                        beforeSend: function (xhr) {
                            xhr.setRequestHeader(
                                "Authorization",
                                "Basic " + btoa(self.user() + ":" + self.pass()));
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