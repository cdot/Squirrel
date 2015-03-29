/* Copyright (C) 2015 Crawford Currie http://c-dot.co.uk / MIT */

/**
 * A store using Google Drive
 * @implements AbstractStore
 */

const CLIENT_ID = "985219699584-mt1do7j28ifm2vt821d498emarmdukbt.apps.googleusercontent.com";
// We do everything in the appfolder
const SCOPE = "https://www.googleapis.com/auth/drive.appfolder";

function GoogleDriveStore(params) {
    "use strict";

    GoogleDriveStore.is_loaded = false;
    GoogleDriveStore.load_waits = 10;
    $.getScript("https://apis.google.com/js/client.js?onload=GoogleDriveStore.loaded");
    GoogleDriveStore._init(this, params);
}

const SQUIRREL_STORE = GoogleDriveStore;

GoogleDriveStore.loaded = function() {
    "use strict";

    if (DEBUG) console.debug("gapi: loaded");
    GoogleDriveStore.loaded = true;
};

GoogleDriveStore._init = function(self, params) {
    "use strict";

    if (!GoogleDriveStore.is_loaded) {
        if (DEBUG) console.debug("gapi: not loaded yet");
        if (GoogleDriveStore.load_waits-- === 0) {
            params.fail.call("Timeout waiting for Google Drive Client API");
            return;
        }
        // Wait 200ms before trying again. try a maximum of 10 times.
        tid = window.setTimeout(function() {
            window.clearTimeout(tid);
            // Try again
            GoogleDriveStore._init(self, params);
        }, 200);
        return;
    }

    // Timeout after 5 seconds of waiting for auth
    var tid = window.setTimeout(function() {
        window.clearTimeout(tid);
        params.fail.call("Timeout trying to authorise access to Google Drive");
    }, 5000),

    handleAboutGetResult = function(result) {
        if (result.status === 200) {
            self.user(result.result.user.displayName);
        } else {
            if (DEBUG) console.debug("gapi: Google Drive about.get failed");
            params.fail.call(self, "Google Drive about.get failed");
        }
        AbstractStore.call(self, params);
    },

    handleClientLoad = function() {
        if (DEBUG) console.debug("gapi: drive/v2 loaded");
        gapi.client.drive.about.get()
            .then(handleAboutGetResult);
    },

    handleAuthResult = function (authResult) {
        var message;
        window.clearTimeout(tid);
        if (authResult && !authResult.fail) {
            // Access token has been retrieved, requests
            // can be sent to the API.
            if (DEBUG) console.debug("gapi: auth OK");
            gapi.client.load("drive", "v2", handleClientLoad);
        } else {
            if (authResult === null)
                message = "Could not authorise access to Google Drive";
            else
                message = authResult.fail;
            params.fail.call(self, message);
        }
    };

    if (DEBUG) console.debug("gapi: authorising");

    gapi.auth.authorize(
        {
            client_id: CLIENT_ID,
            scope: SCOPE
//            immediate: true
        },
        handleAuthResult);
};

GoogleDriveStore.prototype = Object.create(AbstractStore.prototype);

GoogleDriveStore.prototype.identifier = function() {
    "use strict";

    return "Google Drive";
};

// The load process is triggered by the tag in the html:
// <script type="text/javascript" src="https://apis.google.com/js/client.js?onload=gapi_loaded"></script>

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
