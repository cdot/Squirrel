// A store engine using Google Drive

function GoogleDriveEngine(cID) /* implements StorageEngine */ {
    this.cID = cID;
    this.isReadOnly = false;
    this.authorised = false;
};

GoogleDriveEngine.prototype = Object.create(StorageEngine.prototype);

// TODO: use drive.appfolder, see https://developers.google.com/drive/web/appdata
const SCOPES = 'https://www.googleapis.com/auth/drive';

// If use of Drive can be authorised, calls ok(drive) where drive
// is this object. If it fails, calls fail(message).
// ok() is required, fail() is optional.
GoogleDriveEngine.prototype._authorise = function(ok, fail) {
    if (this.authorised) {
        // Don't recurse
        ok.call(this);
    } else {
        var drive = this;
        var tid;
        var auth_failed = function(message) {
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
GoogleDriveEngine.prototype._upload = function(p) {
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

GoogleDriveEngine.prototype._putfile = function(p) {

    var url = '/upload/drive/v2/files';
    var method = 'POST';
    var params = {
            'uploadType': 'multipart',
    }
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

    var metadata = {
        'title': p.name,
        'mimeType': p.contentType
    };

    var base64Data = btoa(p.data);
    var multipartRequestBody =
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
GoogleDriveEngine.prototype._search = function(query, ok, fail) {
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
GoogleDriveEngine.prototype._download = function(p) {
    if (p.url) {
        this._getfile(p);
    } else if (p.name) {
        var gd = this;
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
GoogleDriveEngine.prototype._getfile = function(p) {
    var drive = this;
    var oauthToken = gapi.auth.getToken();
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
GoogleDriveEngine.prototype.exists = function(name, does, does_not) {
    var drive = this;

    var items = this._search(
        "title='" + name + "'",
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

// Implements: StorageEngine.setData
GoogleDriveEngine.prototype.setData = function(key, data, ok, fail) {
    this.authorise(
        function() {
            this._upload(
                {
                    name: key,
                    data: data,
                    ok: ok,
                    fail: fail
                });
        },
        fail);
};

// Implements: StorageEngine.getData
GoogleDriveEngine.prototype.getData = function(key, ok, fail) {
    this.authorise(
        function() {
            this._download(
                {
                    name: key,
                    ok: ok,
                    fail: fail
                })
        },
        fail);
};

