/*@preserve Copyright (C) 2015-2022 Crawford Currie http://c-dot.co.uk license MIT*/
/* eslint-env browser */
/* global google */
/* global gapi */

define([
  'js/Utils', 'js/HttpServerStore', 'js/Serror',
  "i18n"
], (
  Utils, HttpServerStore, Serror
) => {

  // https://console.cloud.google.com/welcome?project=ringed-inn-834
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

  // Authorization scopes required by the API; multiple scopes can be
  // included, separated by spaces.
  const SCOPES = "https://www.googleapis.com/auth/drive https://www.googleapis.com/auth/userinfo.profile";
  const DISCOVERY_DOCS = [
    "https://www.googleapis.com/discovery/v1/apis/drive/v3/rest",
    "https://www.googleapis.com/discovery/v1/apis/people/v1/rest"
  ];

  const BOUNDARY = "-------314159265358979323846";
  const DELIMITER = `\r\n--${BOUNDARY}\r\n`;
  const RETIMILED = `\r\n--${BOUNDARY}--`;

  // Parse JWT token without verification. Not used, but kept for reference.
  function parseJwt (token) {
    const base64Url = token.split('.')[1];
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
    const jsonPayload = decodeURIComponent(
      window.atob(base64).split('').map(function(c) {
        return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
      }).join(''));
    return JSON.parse(jsonPayload);
  }

  /**
   * A store using Google Drive
   * @extends HttpServerStore
   */
  class GoogleDriveStore extends HttpServerStore {

    /**
     * See {@link HttpServerStore} for other constructor options
     */
    constructor(p) {
      super(p);
      this.type = "GoogleDriveStore";
      this.option("needs_api_key", true);
      // Override HttpServerStore
      this.option("needs_url", false);
      this.option("url", "");
    }

    /**
     * Return a promise to initialise the store
     * @Override
     */
    init() {
      if (!this.option("api_key"))
        throw new Error("GoogleDriveStore requires an ?api_key=");

      // First load Google Identity Services and complete
      // login there to get an access token
      return super.init()
      .then(() => $.getScript("https://accounts.google.com/gsi/client"))
      .then(() => {
        if (this.debug) this.debug("GIS loaded");
        return $.getScript("https://apis.google.com/js/client.js");
      })
      .then(() => new Promise(resolve => gapi.load("client", resolve)))
      .then(() => new Promise(resolve => {
        if (this.debug) this.debug("gapi.client loaded");
        const tokenClient = google.accounts.oauth2.initTokenClient({
          client_id: CLIENT_ID,
          discoveryDocs: DISCOVERY_DOCS,
          scope: SCOPES,
          callback: resolve
        });
        if (gapi.client.getToken() === null) {
          tokenClient.requestAccessToken({prompt: 'consent'});
        } else {
          tokenClient.requestAccessToken({prompt: ''});
        }
      }))
      // GIS has automatically updated gapi.client with the
      // access token.
      .then(() => {
        this.debug("API key", this.option("api_key"));
        return gapi.client.init({
          // API key can't be hard coded, and there is no server to store it on,
          // so the only option is to get it from the URL
          apiKey: this.option("api_key")
        });
      })
      // Load the Drive API
      .then(() => gapi.client.load("drive", "v3"))
      // Get user name from profile. Clunky.
      .then(() => gapi.client.load("people", "v1"))
      .then(() => gapi.client.people.people.get({
        'resourceName': 'people/me',
        'personFields': 'names'
      }))
      .then(response => {
        const repo = JSON.parse(response.body);
        const name = repo.names[0];
				this.option("user", name.displayName);
      })
      .catch(e => console.error(e));
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
     * @Override
     */
    addAuth(headers) {
      // I don't know what this is
      const apiTok = gapi.auth.getToken().access_token;
      headers.Authorization = `Bearer ${apiTok}`;
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

      if (this.debug) this.debug(`Drive: ${query}`);
      return gapi.client.drive.files
      .list({
        q: query,
        fields: "files/id"
      })
      .then(response => {
        if (this.debug) this.debug(`Drive: response ${response.result}`);
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
        throw new Serror(400, path + this._gError(r, $.i18n("gdrive-err")));
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
        const query = `name='${name}' and '${parentId}' in parents and trashed=false`;
        if (this.debug) this.debug(`Drive: ${query}`);
        return gapi.client.drive.files
        .list({
          q: query,
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
        console.error("Read failed", r);
        throw new Serror(400, path + this._gError(r, $.i18n("gd-rerr")));
      });
    }
  }

  return GoogleDriveStore;
});
