/*@preserve Copyright (C) 2015-2019 Crawford Currie http://c-dot.co.uk license MIT*/
/* eslint-env browser */
/* global google */

/* global gapi */
let gapi_is_loaded = false;
let gapi_loader;

// Redirect target after gapi loading
/* eslint-disable no-unused-vars */
function gapi_on_load() {
  if (this.debug) this.debug("gapi is loaded");
  gapi_is_loaded = true;
  if (gapi_loader)
    gapi_loader();
}
/* eslint-enable no-unused-vars */

let gis_is_loaded = false;
let gis_loader;

// Redirect target after gisloading
/* eslint-disable no-unused-vars */
function gis_on_load() {
  if (this.debug) this.debug("gis is loaded");
  gis_is_loaded = true;
  if (gis_loader)
    gis_loader();
}
/* eslint-enable no-unused-vars */

define("js/GoogleDriveStore", [
	'js/Utils', 'js/HttpServerStore', 'js/Serror', "i18n"
], (Utils, HttpServerStore, Serror) => {

	// Client ID from Google APi dashboard. Note this is only valid
	// for requests from specific URLs, so if you want to host your
	// own Squirrel version - for example, to host a test version on
	// localhost - you will have to
	// change it. You can do so on https://console.developers.google.com
  const CLIENT_ID = "985219699584-mt1do7j28ifm2vt821d498emarmdukbt.apps.googleusercontent.com";

  // While the appfolder would seem to make sense for Squirrel, it does make
  // it absolutely clear to an attacker where to look for Squirrel data files.
  // By granting full drive access, we open up the whole drive for possible
  // places to hoard.
  const SCOPE = "https://www.googleapis.com/auth/drive";

  const BOUNDARY = "-------314159265358979323846";
  const DELIMITER = `\r\n--${BOUNDARY}\r\n`;
  const RETIMILED = `\r\n--${BOUNDARY}--`;
	const DISCOVERY_DOCS = ["https://www.googleapis.com/discovery/v1/apis/drive/v3/rest"];

  /**
   * A store using Google Drive
   * @extends HttpServerStore
   */
  class GoogleDriveStore extends HttpServerStore {

		/**
		 * See {@link HttpServerStore} for other constructor options
		 * Sets `options.needs_url` and `options.url`
		 */
    constructor(p) {
      super(p);
      this.type = "GoogleDriveStore";
      // Override HttpServerStore
      this.option("needs_url", false);
      this.option("url", "");
    }

    /**
     * Return a promise to initialise the store
		 * @Override
		 */
    async init() {
      // Load the necessary Google libraries
      return Promise.all([
        new Promise(resolve => {
          gapi_loader = () => resolve(this._initGAPIClient());
          $.getScript(
            "https://apis.google.com/js/api.js?onload=gapi_on_load");
        }),
        new Promise(resolve => {
          gis_loader = () => resolve(this._authenticate());
          $.getScript(
            "https://accounts.google.com/gsi/client?onload=gis_on_load");
        })]);
    }

    // Callback when GAPI has been loaded
    _initGAPIClient() {
      gapi.client.init({
				//immediate: true,
				client_id: CLIENT_ID,
				discoveryDocs: DISCOVERY_DOCS,
				scope: SCOPE
			});
    }

    // Callback when GIS has been loaded
    _authenticate() {
      const tokenClient = google.accounts.oauth2.initTokenClient({
        client_id: CLIENT_ID,
        scope: SCOPE,
        callback: resp => {
          if (resp.error !== undefined) throw (resp);
          this.accessToken = resp.access_token;
          this._getUser();
        }
      });

      if (gapi.client.getToken() === null) {
        // Prompt the user to select a Google Account
        tokenClient.requestAccessToken({prompt: 'consent'});
      } else {
        // Skip display of account chooser and consent dialog
        tokenClient.requestAccessToken({prompt: ''});
      }
    }

    /**
     * Analyse an error returned by a Google promise
     * @private
     */
    _gError(r, context) {
      let mess = `${context} ` + $.i18n("failed") + ": ";
      if (typeof r.details !== 'undefined')
        mess += r.details;
      else if (typeof r.error !== 'undefined')
        mess += r.error;
      else if (r.status === 401) {
        mess +=
        $.i18n("access_expired") +
        ' ' +
        $.i18n("please_refresh");
      } else if (r.result && r.result.error) {
        mess += r.result.error.message;
      } else {
        mess += r.body;
      }
      if (this.debug) this.debug(mess);
      return ` ${mess}`;
    }

    /**
     * We have an authenticated user, get their name and init
     * drive.
     */
    _getUser(accessToken) {
      $.get({
        url: 'https://www.googleapis.com/oauth2/v3/userinfo',
        headers: {
          Authorization: `Bearer ${this.accessToken}`
        }
      })
      .then(profile => {
			  const name = profile.getName();
			  if (this.debug) this.debug(`auth OK, user ${name}`);
			  this.option("user", name);
			  return gapi.client.load("drive", "v3");
      });
    }

    /**
		 * @Override
		 */
    addAuth(headers) {
      headers.Authorization = `Bearer ${this.accessToken}`;
    }

    /**
     * Promise to get the id of the folder at the end of the given
     * path, optionally creating the folders if they don't exist.
     * Any errors thrown will be from Google
     * @private
     */
    _follow_path(parentid, path, create) {
      if (path.length === 0)
        return Promise.resolve(parentid);

      const p = path.slice();
      const pathel = p.shift();

      function create_folder() {
        const metadata = {
          title: pathel,
          mimeType: "application/vnd.google-apps.folder"
        };
        if (parentid !== "root")
          // Don't think we want this for a root file?
          metadata.parents = [{
            id: parentid
          }];
        if (this.debug) this.debug(`Creating folder ${pathel} under ${parentid}`);
        return gapi.client.drive.files
        .insert(metadata)
        .then(response =>
					    this._follow_path(response.result.id, p, true));
      }

      const query = `title='${pathel}' and '${parentid}' in parents` +
            " and mimeType='application/vnd.google-apps.folder' and trashed=false";

      return gapi.client.drive.files
      .list({
        q: query,
				fields: "files/id"
      })
      .then(response => {
        const files = response.result.files;
        if (files.length > 0) {
          const id = files[0].id;
          if (this.debug) this.debug(`found ${query} at ${id}`);
          return this._follow_path(id, p, create);
        }
        if (this.debug) this.debug(`could not find ${query}`);
        if (create)
          return create_folder();
        this.status(404);
        return undefined;
      });
    }

    /**
     * Promise to put data at the given path, optionally creating
     * intermediate folders if they don't exist.
     * Any errors thrown will be from Google
     * @private
     */
    // id is a (string) id or a { parentid: name: structure }
    _putfile(parentid, name, data, id) {
      let url = "/upload/drive/v2/files";
      let method = "POST";
      const params = {
        uploadType: "multipart",
        visibility: "PRIVATE"
      };
      const metadata = {
        title: name,
        mimeType: "application/octet-stream"
      };

      if (typeof parentid !== 'undefined') {
        metadata.parents = [{
          id: parentid
        }];
      }

      if (typeof id !== 'undefined') {
        // Known fileId, we're updating an existing file
        url += `/${id}`;
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
          "Content-Type": `multipart/related; boundary="${BOUNDARY}"`
        },
        body: multipartRequestBody
      })
      .then((/*response*/) => true)
      .catch(e => {
        this.status(e.code);
        return false;
      });
    }

    /**
		 * @Override
		 */
    write(path, data) {
      if (this.debug) this.debug("write", path);

      const p = path.split("/");
      const name = p.pop();
      let parentId;
      
      return this
      ._follow_path("root", p, true)
      .then(pid => {
        if (typeof pid === 'undefined')
          return false;
        parentId = pid;
        // See if the file already exists, if it does then use it's id
        if (this.debug) this.debug(`checking existance of ${name}`);
        return gapi.client.drive.files
        .list({
          q:  `name='${name}' and '${parentId}' in parents and trashed=false`,
					fields: "files/id"
        });
      })
      .then(response => {
        const files = response.result.files;
        let id;
        if (files.length > 0) {
          id = files[0].id;
          if (this.debug) this.debug(`updating ${name} ${id}`);
        } else
          if (this.debug) this.debug(`creating ${name} in ${parentId}`);
        return this._putfile(parentId, name, data, id);
      })
      .catch(r => {
        throw new Serror(400, path + this._gError(r, $.i18n("Write")));
      });
    }

    /**
		 * @Override
		 */
    read(path) {
      if (this.debug) this.debug("read", path);

      const p = path.split("/");
      const name = p.pop();
      return this
      ._follow_path("root", p, false)
      .then(parentId => {
        if (typeof parentId === 'undefined')
          return undefined;
				if (this.debug) this.debug(
					`listing files called ${name} in ${parentId}`);
        return gapi.client.drive.files
        .list({
          q: `name='${name}' and '${parentId}' in parents and trashed=false`,
					// "*" shows all fields. We only need the id for matched files.
					fields: "files/id"
        });
      })
      .then(response => {
        const files = response.result.files;
        if (files === null || files.length === 0) {
          if (this.debug) this.debug(`could not find ${name}`);
          throw new Serror(401, `${path} not found`);
        }
        const id = files[0].id;
        if (this.debug) this.debug(`found '${name}' id ${id}`);
				return gapi.client.drive.files.get(
					{
						fileId: id,
						alt: "media"
					})
				.then(res => {
					// alt=media requests content-type=text/plain. AFAICT the
					// file comes in base64-encoded, and is simply converted
					// to a 'string' by concatenating the bytes,
					// one per code point, without any decoding (thankfully!)
					const a = new Uint8Array(res.body.length);
					for (let i = 0; i < a.length; i++)
						a[i] = res.body.codePointAt(i);
					return a;
				});
      })
			.catch(r => {
        throw new Serror(400, path + this._gError(r, $.i18n("Read")));
      });
    }
  }

  return GoogleDriveStore;
});
