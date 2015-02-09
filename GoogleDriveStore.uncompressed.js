/**
 * A store using Google Drive
 * @implements AbstractStore
 */

function GoogleDriveStore(cID) {
    this.cID = cID;
    this.isReadOnly = false;
    this.authorised = false;
};

GoogleDriveStore.prototype = Object.create(AbstractStore.prototype);

// TODO: use drive.appfolder, see https://developers.google.com/drive/web/appdata
const SCOPES = 'https://www.googleapis.com/auth/drive';

// If use of Drive can be authorised, calls ok(drive) where drive
// is this object. If it fails, calls fail(message).
// ok() is required, fail() is optional.
GoogleDriveStore.prototype._authorise = function(ok, fail) {
    var drive, tid, auth_failed;
    if (this.authorised) {
        // Don't recurse
        ok.call(this);
    } else {
        drive = this;
        tid;
        auth_failed = function(message) {
            if (message === null)
                message = "Could not authorise access to Google Drive";
            console.log("GDE: Auth failed " + message);
            fail.call(drive, message);
        };
        console.log("GDE: Authorising");
        // Timeout after 5 seconds
        tid = window.setTimeout(function() {
            window.clearTimeout(tid);
            auth_failed("Timeout trying to authorise");
        }, 5000);
        gapi.auth.authorize(
            {'client_id': this.cID, 'scope': SCOPES, 'immediate': true},
            function (authResult) {
                window.clearTimeout(tid);
                if (authResult && !authResult.fail) {
                    // Access token has been okfully retrieved, requests
                    // can be sent to the API.
                    console.log("GDE: Auth OK");
                    gapi.client.load('drive', 'v2', function() {
                        drive.authorised = true;
                        ok.call(drive);
                        drive.authorised = false;
                    });
                } else {
                    auth_failed(authResult ? authResult.fail : null);
                }
            });
    }
};

// Insert new file
// p = {
// name:
// data:
// contentType:
// ok:
// fail:
// };
// call ok or fail on completion
GoogleDriveStore.prototype._upload = function(p) {
    var drive = this;

    if (p.id)
        this._putfile(p);
    else
        this.exists(
            p.name,
            function(id) {
                p.id = id;
                drive._putfile(p);
            },
            function() {
                drive._putfile(p);
            });
}

GoogleDriveStore.prototype._putfile = function(p) {

    var url = '/upload/drive/v2/files',
    method = 'POST',
    params = {
            'uploadType': 'multipart',
    },
    metadata, base64Data, multipartRequestBody;

    if (p.id) {
        // Known fileId, we're updating and existing file
        url += '/' + p.id;
        method = 'PUT';
    } else {
        // New upload
        params['visibility'] = 'PRIVATE';
    }

    const boundary = '-------314159265358979323846';
    const delimiter = "\r\n--" + boundary + "\r\n";
    const close_delim = "\r\n--" + boundary + "--";

    if (!p.contentType)
        p.contentType = 'application/octet-stream';

    // Check required params
    if (typeof(p.name) !== 'string')
        debugger;
    if (typeof(p.data) !== 'string')
        debugger;

    metadata = {
        'title': p.name,
        'mimeType': p.contentType
    };

    base64Data = btoa(p.data);
    multipartRequestBody =
        delimiter +
        'Content-Type: application/json\r\n\r\n' +
        JSON.stringify(metadata) +
        delimiter +
        'Content-Type: ' + p.contentType + '\r\n' +
        'Content-Transfer-Encoding: base64\r\n' +
        '\r\n' +
        base64Data +
        close_delim;

    gapi.client.request({
        'path': url,
        'method': method,
        'params': params,
        'headers': {
            'Content-Type': 'multipart/mixed; boundary="' + boundary + '"'
        },
        'body': multipartRequestBody})

        .then(
            function(response) {
                p.ok.call(drive, response.result);
            },
            function(reason) {
                p.fail.call(drive, reason);
            })
};

// Get a list of resources, call ok passing the list of matching
// items, or fail with a message
GoogleDriveStore.prototype._search = function(query, ok, fail) {
    var drive = this;
    this._authorise(
	function() {
	    gapi.client
		.request({
		    'path': '/drive/v2/files',
		    'method': 'GET',
		    'params' : { q: query }
		})
		.then(
		    function(response) {
			ok.call(drive, response.result.items);
		    },
		    function(reason) {
			fail.call(drive, reason);
		    });
	},
	function(reason) {
	    fail.call(drive, reason);
	});	   
};

// Download a resource, call ok or fail
// p = { (id | name):, ok:, fail: }
GoogleDriveStore.prototype._download = function(p) {
    var gd;
    if (p.url) {
        this._getfile(p);
    } else if (p.name) {
        gd = this;
        this._search(
	    "title='" + p.name + "'",
            function(items) {
                if (items.length > 0) {
                    p.url = items[0].downloadUrl;
                    drive._download(p);
                } else
                    p.fail.call(gd, "File not found");
            },
            p.fail);
    } else
        debugger;
};

// p = {url: ok: , fail: }
GoogleDriveStore.prototype._getfile = function(p) {
    var drive = this,
    oauthToken = gapi.auth.getToken();
    $.ajax(
        {
            url: p.url,
            method: 'GET',
            beforeSend: function(jqXHR) {
                jqXHR.setRequestHeader(
                    'Authorization',
                    'Bearer ' + oauthToken.access_token);
            },
            ok: function(data) {
                p.ok.call(drive, data);
            },
            fail: function(reason) {
                p.fail.call(drive, reason);
            }
        });
};

// Determine if the given name exists, call the function 'does' or
// 'does_not' accordingly, passing the faileId to 'does'
// Implements: AbstractStore
GoogleDriveStore.prototype.exists = function(name, does, does_not) {
    var drive = this;
    if (!this.user) {
        fail.call(this, "Not logged in");
        return;
    }
    this._search(
        "title='" + this.user + ':' + name + "'",
	function(items) {
            if (items.length > 0)
                does.call(drive, items[0].id);
            else
                does_not.call(drive);
	},
	function() {
            does_not.call(drive);
	});
};

// Implements: AbstractStore
GoogleDriveStore.prototype.setData = function(key, data, ok, fail) {
    if (!this.user) {
        fail.call(this, "Not logged in");
        return;
    }
    this.authorise(
        function() {
            this._upload(
                {
                    name: this.user + ':' + key,
                    data: data,
                    ok: ok,
                    fail: fail
                });
        },
        fail);
};

GoogleDriveStore.prototype.getData = function(key, ok, fail) {
    if (!this.user) {
        fail.call(this, "Not logged in");
        return;
    }
    this.authorise(
        function() {
            this._download(
                {
                    name: this.user + ':' + key,
                    ok: ok,
                    fail: fail
                })
        },
        fail);
};

