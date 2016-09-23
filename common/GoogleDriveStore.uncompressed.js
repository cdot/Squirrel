/*@preserve Copyright (C) 2015 Crawford Currie http://c-dot.co.uk license MIT*/

/* global DEBUG */
/* global TX */
/* global AbstractStore */
/* global Utils */
/* global gapi */
/* global SQUIRREL_STORE:true */

/**
 * A store using Google Drive
 * @implements AbstractStore
 */

var CLIENT_ID = "985219699584-mt1do7j28ifm2vt821d498emarmdukbt.apps.googleusercontent.com";

// While the appfolder would seem to make sense for Squirrel, it does make
// it absolutely clear to an attacker where to look for Squirrel data files.
// By granting full drive access, we open up the whole drive for possible
// places to hoard.
var SCOPE = "https://www.googleapis.com/auth/drive";

var gapi_is_loaded = false;
var gapi_loader;

function GoogleDriveStore(params) {
    "use strict";

    if (gapi_is_loaded) {
        if (DEBUG) console.debug("gapi is already loaded");
        this._init(params);
    } else {
        var self = this;
        gapi_loader = function() {
            if (DEBUG) console.debug("Loading GoogleDriveStore");
            self._init(params);
        };
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

SQUIRREL_STORE = GoogleDriveStore;

function gapi_on_load() {
    "use strict";

    if (DEBUG) console.debug("gapi is loaded");
    gapi_is_loaded = true;
    if (gapi_loader)
        gapi_loader();
}

/**
 * @private
 * Analyse an error returned by a promise
 */
GoogleDriveStore.prototype._analyse_error = function(r, context, fail) {
    "use strict";
    var mess = context + TX.tx(" failed: ");
    if (r.status === 401) {
        mess += TX.tx("Your access token has expired, or you are not logged in. Please refresh the page in order to save in Google Drive");
    } else if (r.result) {
        mess += r.result.error.message;
    } else {
        mess += r.body;
    }
    fail.call(this, mess);
};

GoogleDriveStore.prototype._init = function(params) {
    "use strict";

    var self = this;

    // Timeout after 20 seconds of waiting for auth
    var tid = window.setTimeout(function() {
        window.clearTimeout(tid);
        params.fail.call(
            self,
            TX.tx("Timeout trying to authorise access to Google Drive. Are popups blocked in your browser?"));
    }, 20000);

    var handleClientLoad = function() {
        if (DEBUG) console.debug("GoogleDriveStore: drive/v2 loaded");
        gapi.client.drive.about.get("name")
            .then(
                function(result) {
                    if (result.status === 200) {
                        self.user(result.result.user.displayName);
                    } else {
                        self._analyse_error(
                            result, TX.tx("Google Drive load"), params.fail);
                    }
                    // Finish initialising the store
                    AbstractStore.call(self, params);
                },
                function(r) {
                    self._analyse_error(
                        r, TX.tx("Google Drive load"), params.fail);
                });
    };

    var handleAuthResult = function (authResult) {
        var message;
        window.clearTimeout(tid);
        if (authResult && !authResult.fail) {
            // Access token has been retrieved, requests
            // can be sent to the API.
            if (DEBUG) console.debug("GoogleDriveStore: auth OK");
            gapi.client.load("drive", "v2", handleClientLoad);
        } else {
            if (authResult === null)
                message = TX.tx("Could not authorise access to Google Drive");
            else
                message = authResult.fail;
            params.fail.call(self, message);
        }
    };

    if (DEBUG) console.debug("GoogleDriveStore: authorising");

    gapi.auth.authorize(
        {
            //immediate: true,
            client_id: CLIENT_ID,
            scope: SCOPE
        },
        handleAuthResult);
};

var BOUNDARY = "-------314159265358979323846";
var DELIMITER = "\r\n--" + BOUNDARY + "\r\n";
var RETIMILED = "\r\n--" + BOUNDARY + "--";

/**
 * @private
 * @param url url to GET
 * @param ok callback on ok, passed the data
 * @param fail callback on fail
 */
GoogleDriveStore.prototype._getfile = function(url, ok, fail) {
    "use strict";

    var self = this;
    var oauthToken = gapi.auth.getToken();
    var converter;

    if (DEBUG) console.debug("GoogleDriveStore: GET " + url);

    // SMELL: no client API to get file content from Drive
    $.ajax({
        url: url,
        method: "GET",
        dataType: "binary",
        responseType: "arraybuffer",
        beforeSend: function(jqXHR) {
            jqXHR.setRequestHeader(
                "Authorization",
                "Bearer " + oauthToken.access_token);
        },
        success: function(data, textStatus, jqXHR) {
            if (DEBUG) console.debug("GoogleDriveStore: _getfile OK");
            ok.call(self, data);
        },
        error: function(jqXHR, textStatus, errorThrown) {
            var reason = textStatus + " " + errorThrown;
            if (DEBUG) console.debug("_getfile failed", reason);
            fail.call(self, reason);
        }
    });
};

// Get the id of the folder at the end of the given path, optionally creating
// the folders if they don't exist. Call ok passing the id of the
// leaf folder, or fail otherwise.
GoogleDriveStore.prototype._follow_path = function(
    parentid, path, ok, fail, create) {
    "use strict";

    var self = this;

    if (path.length === 0) {
        ok.call(self, parentid);
        return;
    }

    var p = path.slice();
    var pathel = p.shift();
    var create_folder = function(reason) {
        var metadata = {
            title: pathel,
            mimeType: "application/vnd.google-apps.folder"
        };
        if (parentid !== "root")
            // Don't think we want this for a root file?
            metadata.parents = [ { id: parentid } ];
        if (DEBUG) console.debug("Creating folder " + pathel + " under " + parentid);
        gapi.client.drive.files
            .insert(metadata)
            .then(
                function(response) {
                    var id = response.result.id;
                    self._follow_path(id, p, ok, fail, true);
                },
                function(r) {
                    // create failed
                    self._analyse_error(r, TX.tx("Create folder"), fail);
                });
    };
    var query = "title='" + pathel + "'"
        + " and '" + parentid + "' in parents"
        + " and mimeType='application/vnd.google-apps.folder'"
        + " and trashed=false";

    gapi.client.drive.files
        .list({
            q: query
        })
        .then(
            function(response) {
                var items = response.result.items;
                if (items.length > 0) {
                    var id = items[0].id;
                    if (DEBUG) console.debug("GoogleDriveStore: found " + query + " at " + id);
                    self._follow_path(id, p, ok, fail, create);
                } else {
                    if (DEBUG) console.debug("GoogleDriveStore: could not find " + query);
                    if (create) {
                        create_folder();
                    } else {
                        fail.call(self, AbstractStore.NODATA);
                    }
                }
            },
            function(r) {
                self._analyse_error(r, TX.tx("Follow path"), fail);
            });
};

// id is a (string) id or a { parentid: name: structure }
GoogleDriveStore.prototype._putfile = function(parentid, name, data, ok, fail, id) {
    "use strict";

    var self = this;
    var url = "/upload/drive/v2/files";
    var method = "POST";
    var params = {
        uploadType: "multipart",
        visibility: "PRIVATE"
    };
    var metadata = {
        title: name,
        mimeType: "application/octet-stream"
    };

    if (typeof parentid !== "undefined") {
        metadata.parents = [ { id: parentid } ];
    }

    if (typeof id !== "undefined") {
        // Known fileId, we're updating an existing file
        url += "/" + id;
        method = "PUT";
    }

    var multipartRequestBody =
        DELIMITER +
        "Content-Type: application/json\r\n\r\n" +
        JSON.stringify(metadata) +
        DELIMITER +
        "Content-Type: application/octet-stream\r\n" +
        "Content-Transfer-Encoding: base64\r\n" +
        "\r\n" +
        Utils.ArrayBufferToBase64(data) +
        RETIMILED;

    gapi.client.request({
        path: url,
        method: method,
        params: params,
        headers: {
            "Content-Type": "multipart/related; boundary=\"" + BOUNDARY + "\""
        },
        body: multipartRequestBody})

        .then(
            function(response) {
                ok.call(self, response.result);
            },
            function(r) {
                self._analyse_error(r, TX.tx("Put"), fail);
            });
};

GoogleDriveStore.prototype.options = function() {
    "use strict";

    return $.extend(AbstractStore.prototype.options(), {
        needs_path: true,
        identifier: "Google Drive"
    });
};

GoogleDriveStore.prototype.write = function(path, data, ok, fail) {
    "use strict";

    var self = this;

    var p = path.split("/");
    var name = p.pop();

    var create_file = function(parentid) {
        // See if the file already exists, if it does then use it's id
        var query = "title='" + name + "'"
            + " and '" + parentid + "' in parents"
            + " and trashed=false";
        if (DEBUG) console.debug("GoogleDriveStore: checking existance of " + name);
        gapi.client.drive.files
            .list({ q: query })
            .then(
                function(response) {
                    var items = response.result.items;
                    var id;
                    if (items.length > 0) {
                        id = items[0].id;
                        if (DEBUG) console.debug("GoogleDriveStore: updating " + name + " id " + id);
                    } else
                        if (DEBUG) console.debug("GoogleDriveStore: creating " + name + " in " + parentid);
                    self._putfile(parentid, name, data, ok, fail, id);
                },
                function(r) {
                    self._analyse_error(r, TX.tx("Write"), fail);
                });
    };

    if (DEBUG) console.debug("GoogleDriveStore: following " + path);
    this._follow_path(
        "root",
        p,
        create_file,
        fail,
        true);
};

GoogleDriveStore.prototype.read = function(path, ok, fail) {
    "use strict";

    if (DEBUG) console.debug("GoogleDriveStore: read " + path);

    var p = path.split("/");
    var name = p.pop();
    var self = this;

    var get_file = function(parentid) {
        var query = "title='" + name + "'"
        + " and '" + parentid + "' in parents"
        + " and trashed=false";

        gapi.client.drive.files
            .list({ q: query })
            .then(
                function(response) {
                    var items = response.result.items;
                    if (items.length > 0) {
                        var url = items[0].downloadUrl;
                        if (DEBUG) console.debug(
                            "GoogleDriveStore: download found " + name + " at " + url);
                        self._getfile(url, ok, fail);
                    } else {
                        if (DEBUG) console.debug(
                            "GoogleDriveStore: could not find " + name);
                        fail.call(self, AbstractStore.NODATA);
                    }
                },
                function(r) {
                    self._analyse_error(r, TX.tx("Read"), fail);
                });
    };

    this._follow_path(
        "root",
        p,
        get_file,
        fail,
        false);
};
