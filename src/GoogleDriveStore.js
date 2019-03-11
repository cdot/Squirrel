/*@preserve Copyright (C) 2015-2019 Crawford Currie http://c-dot.co.uk license MIT*/
/* eslint-env browser */

/* global gapi */
var gapi_is_loaded = false;
var gapi_loader;

function gapi_on_load() {
    if (this.debug) this.debug("gapi is loaded");
    gapi_is_loaded = true;
    if (gapi_loader)
        gapi_loader();
}

define(['js/Utils', 'js/Translator', 'js/AbstractStore'], function(Utils, Translator, AbstractStore) {
    let TX = Translator.instance();

    /**
     * A store using Google Drive
     * @implements AbstractStore
     */

    const CLIENT_ID = "985219699584-mt1do7j28ifm2vt821d498emarmdukbt.apps.googleusercontent.com";

    // While the appfolder would seem to make sense for Squirrel, it does make
    // it absolutely clear to an attacker where to look for Squirrel data files.
    // By granting full drive access, we open up the whole drive for possible
    // places to hoard.
    const SCOPE = "https://www.googleapis.com/auth/drive";

    const BOUNDARY = "-------314159265358979323846";
    const DELIMITER = "\r\n--" + BOUNDARY + "\r\n";
    const RETIMILED = "\r\n--" + BOUNDARY + "--";

    class GoogleDriveStore extends AbstractStore {

        constructor(p) {
            p = p || {};
            this.type = "GoogleDriveStore";
            super(p);
        }

        init() {
            if (gapi_is_loaded) {
                if (this.debug) this.debug("gapi is already loaded");
                return this._init();
            }
            let self = this;
            return new Promise((resolve, reject) => {
                gapi_loader = function () {
                    if (this.debug) this.debug("Loading GoogleDriveStore");
                    resolve(self._init());
                };
                return $.getScript("https://apis.google.com/js/client.js?onload=gapi_on_load");
            });
        }

        /**
         * @private
         * Analyse an error returned by a Google promise
         */
        _gError(r, context) {
            if (this.debug) {
                let mess = context + TX.tx(" failed: ");
                if (r.status === 401) {
                    mess +=
                        TX.tx("Your access token has expired, or you are not logged in.") +
                        " " +
                        TX.tx("Please refresh the page in order to save in Google Drive");
                } else if (r.result) {
                    mess += r.result.error.message;
                } else {
                    mess += r.body;
                }
                this.debug(mess);
            }
            this.status(r.status);
        }

        _init() {
            let self = this;

            // Timeout after 20 seconds of waiting for auth
            let tid = window.setTimeout(function () {
                window.clearTimeout(tid);
                throw new Error(
                    TX.tx("Timeout trying to authorise access to Google Drive.") +
                        " " + TX.tx("Are popups blocked in your browser?"));
            }, 20000);

            if (this.debug) this.debug("GoogleDriveStore: authorising");

            return gapi.auth
                .authorize({
                    //immediate: true,
                    client_id: CLIENT_ID,
                    scope: SCOPE
                })
                .then((authResult) => {
                    window.clearTimeout(tid);
                    if (!authResult)
                        throw new Error(TX.tx("Could not authorise access to Google Drive"));
                    else if (authResult.fail)
                        throw new Error(authResult.fail);
                    // Access token has been retrieved, requests
                    // can be sent to the API.
                    if (this.debug) this.debug("GoogleDriveStore: auth OK");
                    return gapi.client.load("drive", "v2");
                })
                .then(() => {
                    if (this.debug) this.debug("GoogleDriveStore: drive/v2 loaded");
                    return gapi.client.drive.about.get("name");
                })
                .then((result) => {
                    if (result.status !== 200)
                        throw result;
                    self.option("user", result.result.user.displayName);
                    // We're done, fall through to resolve
                })
                .catch((r) => {
                    self._gError(r, TX.tx("Google Drive load"));
                    throw new Error("GoogleDriveStore: init failed");
                });
        }

        /**
         * @private
         * Promise to get the (binary) content of a file
         * @param url url to GET
         * @param ok callback on ok, passed the data
         * @param fail callback on fail
         */
        _getfile(url) {
            if (this.debug) this.debug("GoogleDriveStore: GET " + url);

            // SMELL: no client API to get file content from Drive
            return $.ajax({
                url: url,
                method: "GET",
                dataType: "binary",
                responseType: "arraybuffer",
                beforeSend: function (jqXHR) {
                    jqXHR.setRequestHeader(
                        "Authorization",
                        "Bearer " + gapi.auth.getToken().access_token);
                }
            });
        }

        /**
         * @private
         * Promise to get the id of the folder at the end of the given path, optionally creating
         * the folders if they don't exist.
         * Any errors thrown will be from Google
         */
        _follow_path(parentid, path, create) {
            let self = this;

            if (path.length === 0)
                return parentid;

            let p = path.slice();
            let pathel = p.shift();

            function create_folder() {
                let metadata = {
                    title: pathel,
                    mimeType: "application/vnd.google-apps.folder"
                };
                if (parentid !== "root")
                    // Don't think we want this for a root file?
                    metadata.parents = [{
                        id: parentid
                    }];
                if (this.debug) this.debug("Creating folder " + pathel + " under " + parentid);
                return gapi.client.drive.files
                    .insert(metadata)
                    .then((response) => {
                        return self._follow_path(response.result.id, p, true);
                    });
            }

            let query = "title='" + pathel + "'" +
                " and '" + parentid + "' in parents" +
                " and mimeType='application/vnd.google-apps.folder'" +
                " and trashed=false";

            return gapi.client.drive.files
                .list({
                    q: query
                })
                .then((response) => {
                    let items = response.result.items;
                    if (items.length > 0) {
                        let id = items[0].id;
                        if (this.debug) this.debug("GoogleDriveStore: found " + query + " at " + id);
                        return self._follow_path(id, p, create);
                    }
                    if (this.debug) this.debug("GoogleDriveStore: could not find " + query);
                    if (create)
                        return create_folder();
                    self.status(404);
                    return undefined;
                });
        }

        /**
         * @private
         * Promise to put data at the given path, optionally creating
         * intermediate folders if they don't exist.
         * Any errors thrown will be from Google
         */
        // id is a (string) id or a { parentid: name: structure }
        _putfile(parentid, name, data, id) {
            let self = this;
            let url = "/upload/drive/v2/files";
            let method = "POST";
            let params = {
                uploadType: "multipart",
                visibility: "PRIVATE"
            };
            let metadata = {
                title: name,
                mimeType: "application/octet-stream"
            };

            if (typeof parentid !== "undefined") {
                metadata.parents = [{
                    id: parentid
                }];
            }

            if (typeof id !== "undefined") {
                // Known fileId, we're updating an existing file
                url += "/" + id;
                method = "PUT";
            }

            let multipartRequestBody =
                DELIMITER +
                "Content-Type: application/json\r\n\r\n" +
                JSON.stringify(metadata) +
                DELIMITER +
                "Content-Type: application/octet-stream\r\n" +
                "Content-Transfer-Encoding: base64\r\n" +
                "\r\n" +
                Utils.Uint8ArrayToBase64(data) +
                RETIMILED;

            return gapi.client
                .request({
                    path: url,
                    method: method,
                    params: params,
                    headers: {
                        "Content-Type": "multipart/related; boundary=\"" + BOUNDARY + "\""
                    },
                    body: multipartRequestBody
                })
                .then((response) => {
                    return true;
                })
                .catch((e) => {
                    self.status(e.code);
                    return false;
                });
        }

        write(path, data) {
            let self = this;

            let p = path.split("/");
            let name = p.pop();

            if (this.debug) this.debug("GoogleDriveStore: following " + path);
            return this
                ._follow_path("root", p, true)
                .then((parentId) => {
                    if (typeof parentId === "undefined")
                        return false;

                    // See if the file already exists, if it does then use it's id
                    let query = "title='" + name + "'" +
                        " and '" + parentId + "' in parents" +
                        " and trashed=false";
                    if (this.debug) this.debug("GoogleDriveStore: checking existance of " + name);
                    return gapi.client.drive.files
                        .list({
                            q: query
                        })
                        .then((response) => {
                            let items = response.result.items;
                            let id;
                            if (items.length > 0) {
                                id = items[0].id;
                                if (this.debug) this.debug("GoogleDriveStore: updating " + name + " id " + id);
                            } else
                                if (this.debug) this.debug("GoogleDriveStore: creating " + name + " in " + parentId);
                            return self._putfile(parentId, name, data, id);
                        })
                        .catch((r) => {
                            self._gError(r, TX.tx("Write"));
                            return false;
                        });
                });
        }

        read(path) {
            if (this.debug) this.debug("GoogleDriveStore: read " + path);

            let p = path.split("/");
            let name = p.pop();
            let self = this;

            return this
                ._follow_path("root", p, false)
                .then((parentId) => {
                    if (typeof parentId === "undefined")
                        return undefined;
                    let query = "title='" + name + "'" +
                        " and '" + parentId + "' in parents" +
                        " and trashed=false";

                    return gapi.client.drive.files
                        .list({
                            q: query
                        })
                        .then((response) => {
                            let items = response.result.items;
                            if (items.length === 0) {
                                if (this.debug) this.debug(
                                    "GoogleDriveStore: could not find " + name);
                                throw new Error("No data");
                            }
                            let url = items[0].downloadUrl;
                            if (this.debug) this.debug(
                                "GoogleDriveStore: download found " + name + " at " + url);
                            return self._getfile(url);
                        })
                        .catch((r) => {
                            self._gError(r, TX.tx("Read"));
                            return undefined;
                        });
                });
        }
    }

    return GoogleDriveStore;
});
