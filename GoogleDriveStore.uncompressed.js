/* Copyright (C) 2015 Crawford Currie http://c-dot.co.uk / MIT */

/**
 * A store using Google Drive
 * @implements AbstractStore
 */

const CLIENT_ID = "985219699584-mt1do7j28ifm2vt821d498emarmdukbt.apps.googleusercontent.com";
// We do everything in the appfolder
const SCOPE = "https://www.googleapis.com/auth/drive.appfolder";

var gapi_is_loaded = false;
var gapi_loader;

function GoogleDriveStore(params) {
    "use strict";

    if (gapi_is_loaded) {
        if (DEBUG) console.debug("gapi is already loaded");
        this._init(params);
    } else {
        var self= this;
        gapi_loader = function() {
            if (DEBUG) console.debug("Loading GoogleDriveStore");
            self._init(params);
        }
        $.getScript(
            "https://apis.google.com/js/client.js?onload=gapi_on_load")
        .fail(function(jqxhr, settings, exception) {
            params.fail.call(
                self,
                TX.tx("Failed to load Google APIs: $1 $2",
                      exception, jqxhr.status));
        });
    }
}

GoogleDriveStore.prototype = Object.create(AbstractStore.prototype);

const SQUIRREL_STORE = GoogleDriveStore;

function gapi_on_load() {
    "use strict";

    if (DEBUG) console.debug("gapi is loaded");
    gapi_is_loaded = true;
    if (gapi_loader)
        gapi_loader();
};

GoogleDriveStore.prototype._init = function(params) {
    "use strict";

    var self = this;

    // Timeout after 5 seconds of waiting for auth
    var tid = window.setTimeout(function() {
        window.clearTimeout(tid);
        params.fail.call(
            self,
            TX.tx("Timeout trying to authorise access to Google Drive. Are popups blocked in your browser?"));
    }, 5000);

    var handleAboutGetResult = function(result) {
        if (result.status === 200) {
            self.user(result.result.user.displayName);
        } else {
            if (DEBUG) console.debug("gapi: Google Drive about.get failed");
            params.fail.call(self, TX.tx("Google Drive about.get failed"));
        }
        // Finish initialising the store
        AbstractStore.call(self, params);
    };

    var handleClientLoad = function() {
        if (DEBUG) console.debug("gapi: drive/v2 loaded");
        gapi.client.drive.about.get("name")
            .then(handleAboutGetResult,
                  function(e,f, g) {
                      if (e.result.error.message === "Login required")
                          params.fail.call(
                              self,
                              TX.tx("You don't seem to be logged in to Google Drive"));
                      else
                          params.fail.call(
                              self, TX.tx("Google Drive failed: $1",
                                          e.result.error.message))
                  });
    };

    var handleAuthResult = function (authResult) {
        var message;
        window.clearTimeout(tid);
        if (authResult && !authResult.fail) {
            // Access token has been retrieved, requests
            // can be sent to the API.
            if (DEBUG) console.debug("gapi: auth OK");
            gapi.client.load("drive", "v2", handleClientLoad);
        } else {
            if (authResult === null)
                message = TX.tx("Could not authorise access to Google Drive");
            else
                message = authResult.fail;
            params.fail.call(self, message);
        }
    };

    if (DEBUG) console.debug("gapi: authorising");

    gapi.auth.authorize(
        {
            //immediate: true,
            client_id: CLIENT_ID,
            scope: SCOPE
        },
        handleAuthResult);
};

GoogleDriveStore.prototype.identifier = function() {
    "use strict";

    return "Google Drive";
};

/**
 * @private
 * Get a list of resources, call ok passing the list of matching
 * items, or fail with a message
 */
GoogleDriveStore.prototype._search = function(query, ok, fail) {
    "use strict";

    var self = this;

    gapi.client.drive.files.list({
        q: query
    })
        .then(
            function(response) {
                ok.call(self, response.result.items);
            },
            function(reason) {
                fail.call(self, reason);
            });
};

/**
 * @private
 * Insert new file
 * p = { name: data: contentType: ok: fail: };
 */
GoogleDriveStore.prototype._upload = function(p) {
    "use strict";

    var self = this;

    if (p.id)
        this._putfile(p);
    else
        this._search(
            "'appfolder' in parents and title='" + p.name + "'",
            function(items) {
                if (items.length > 0) {
                    p.id = items[0].id;
                    self._putfile(p);
                } else {
                    self._putfile(p);
                }
            });
};

const BOUNDARY = "-------314159265358979323846";
const DELIMITER = "\r\n--" + BOUNDARY + "\r\n";
const RETIMILED = "\r\n--" + BOUNDARY + "--";

GoogleDriveStore.prototype._putfile = function(p) {
    "use strict";

    var url = "/upload/drive/v2/files",
    method = "POST",
    params = {
            "uploadType": "multipart"
    },
    metadata, base64Data, multipartRequestBody,
    self = this;

    if (p.id) {
        // Known fileId, we're updating and existing file
        url += "/" + p.id;
        method = "PUT";
    } else {
        // New upload
        params.visibility = "PRIVATE";
    }

    if (!p.contentType) {
        p.contentType = "application/octet-stream";
    }

    metadata = {
        title: p.name,
        mimeType: p.contentType,
        parents: [{ id: "appfolder" }]
    };

    base64Data = btoa(p.data);
    multipartRequestBody =
        DELIMITER +
        "Content-Type: application/json\r\n\r\n" +
        JSON.stringify(metadata) +
        DELIMITER +
        "Content-Type: " + p.contentType + "\r\n" +
        "Content-Transfer-Encoding: base64\r\n" +
        "\r\n" +
        base64Data +
        RETIMILED;

    gapi.client.request({
        path: url,
        method: method,
        params: params,
        headers: {
            "Content-Type": "multipart/mixed; boundary=\"" + BOUNDARY + "\""
        },
        body: multipartRequestBody})

        .then(
            function(response) {
                p.ok.call(self, response.result);
            },
            function(reason) {
                p.fail.call(self, reason);
            });
};

/**
 * @private
 * Download a resource, call ok or fail
 * p = { (id | name):, ok:, fail: }
 */
GoogleDriveStore.prototype._download = function(p) {
    "use strict";

    var self = this;
    if (p.url) {
        if (DEBUG) console.debug("gapi: download " + p.url);
        this._getfile(p);
    } else if (p.name) {
        if (DEBUG) console.debug("gapi: search for " + p.name);
        this._search(
            "'appfolder' in parents and title='" + p.name + "'",
            function(items) {
                if (items.length > 0) {
                    p.url = items[0].downloadUrl;
                    if (DEBUG) console.debug("gapi: found " + p.name + " at " + p.url);
                    self._download(p);
                } else {
                    if (DEBUG) console.debug("gapi: could not find " + p.name);
                    p.fail.call(self, AbstractStore.NODATA);
                }
            },
            p.fail);
    } else {
        // Must have either name or url
        if (DEBUG) debugger;
    }
};

/**
 * @private
 * @param p = {url: ok: , fail: }
 */
GoogleDriveStore.prototype._getfile = function(p) {
    "use strict";

    var self = this,
    oauthToken = gapi.auth.getToken();

    if (DEBUG) console.debug("gapi: ajax " + p.url);

    // SMELL: no client API to get file content from Drive
    $.ajax(
        {
            url: p.url,
            method: "GET",
            beforeSend: function(jqXHR) {
                jqXHR.setRequestHeader(
                    "Authorization",
                    "Bearer " + oauthToken.access_token);
            },
            success: function(data/*, textStatus, jqXHR*/) {
                if (DEBUG) console.debug("gapi: _getfile OK");
                p.ok.call(self, data);
            },
            error: function(jqXHR, textStatus, errorThrown) {
                var reason = textStatus + " " + errorThrown;
                if (DEBUG) console.debug("gapi: _getfile failed " + reason);
                p.fail.call(self, reason);
            }
        });
};

GoogleDriveStore.prototype.write = function(data, ok, fail) {
    "use strict";

    this._upload(
        {
            name: this.dataset + "." + this.user(),
            data: data,
            ok: ok,
            fail: fail
        });
};

GoogleDriveStore.prototype.read = function(ok, fail) {
    "use strict";

    this._download(
        {
            name: this.dataset + "." + this.user(),
            ok: ok,
            fail: fail
        });
};
