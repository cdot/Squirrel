/*@preserve Copyright (C) 2018-2023 Crawford Currie http://c-dot.co.uk license MIT*/
/* eslint-env shared-node-browser */

import "jquery/dist/jquery.js";

import { Serror } from "../common/Serror.js";
import { Utils } from "../common/Utils.js";
import { AbstractStore } from "../stores/AbstractStore.js";

// Set up an ajax transport to read binary data
$.ajaxTransport("+binary", function (options, originalOptions, jqXHR) {
  return {
    // create new XMLHttpRequest
    send: function (headers, callback) {
      (typeof XMLHttpRequest === "undefined"
       ? import("xhr2").then(mod => mod.default)
       : Promise.resolve(XMLHttpRequest))

      .then(XMLHttpRequest => {
        const xhr = new XMLHttpRequest();

        xhr.addEventListener('load', function () {
          const data = {};
          data[options.dataType] = xhr.response;
          // make callback and send data
          callback(xhr.status, xhr.statusText, data,
                   xhr.getAllResponseHeaders());
        });

        xhr.open(options.type, options.url, options.async || true,
                 options.username || null, options.password || null);

        // setup custom headers
        for (const i in headers)
          xhr.setRequestHeader(i, headers[i]);

        xhr.responseType = options.responseType || "arraybuffer";
        xhr.send(options.data || null);
      })
      .catch(e => console.error(e));
    },
    abort: function () {
      jqXHR.abort();
    }
  };
});

/**
 * Interface to a 'cloud' store using ajax to communicate with a
 * remote file server e.g. the node.js.server store included in
 * the Squirrel distribution. Or node simple-server python -m
 * SimpleHTTPServer 3000 Or lighttpd nginx apache server etc. Or a
 * simple server built using express.
 * @extends AbstractStore
 */
class HttpServerStore extends AbstractStore {

	/**
	 * {@link AbstractStore} for an explanation of parameters.
	 * Sets `options.needs_url`
	 */
  constructor(p) {
    super(p);
    this.option("needs_url", true);
    this.type = "HttpServerStore";
  }

  /**
   * Set Basic auth headers for {@link HttpServerStore#request}
	 * @param {object} headers headers for BasicAuth
   */
  getHeaders() {
    // Override auth if credentials are set
    if (this.option('net_user')) { // populated by login
      if (this.debug)
        this.debug("HttpServerStore: using BasicAuth", this.option('net_user'));
      // Not happy about caching this
      return {
        Authorization: 'Basic '
        + btoa(this.option('net_user') + ":" + this.option('net_pass'))
      };
    } else if (this.debug)
      this.debug("HttpServerStore: No net_user");
    return undefined;
  }

  /**
   * @protected
   */
  request(opts) {
    if (this.debug) this.debug("HttpServerStore: request", opts);
    const headers = this.getHeaders();
    if (headers)
      opts.headers = headers;
    return $.ajax(opts)
    .catch(res => {
      if (res.status === 401) {
        const handler = this.option("network_login");
        if (typeof handler === 'function') {
          if (this.debug) this.debug("HttpServerStore: handling 401");
          return handler.call(this)
          .then(login => this.request(opts));
        }
      }
      throw new Serror(res.status, `${opts.type} ${opts.url} failed ${res.statusText}`);
    });
  }

  /**
   * Return a promise to make a folder.
   * Subclasses override to provide specific path creation steps.
   * @param path {String} Relative or absolute path to folder
   * @throws Serror if anything goes wrong
	 * @return {Promise} resolves if all went well
   */
  mkpath(/*path*/) {
    return Promise.resolve();
  }

  /**
	 * @Override
	 */
  read(path) {
    if (this.debug) this.debug("HttpServerStore: read", path);
    return this.request({
      url: `${this.option("url")}/${path}`,
      type: "GET",
      dataType: "binary", // use the binary transport, above
      responseType: "arraybuffer"
    })
    .then(ab => new Uint8Array(ab, 0, ab.byteLength));
  }

  /**
	 * @Override
	 */
  reads(path) {
		return this.read(path)
		.then(buff => Utils.Uint8ArrayToString(buff));
	}

  /**
	 * @Override
	 */
  write(path, data) {
    if (this.debug) this.debug("HttpServerStore: write", path);
    const pathbits = path.split(/\/+/);
    const folder = pathbits.slice(0, pathbits.length - 1);
    return this.mkpath(folder.join("/"))
    .then(() => this.request({
      url: `${this.option("url")}/${path}`,
      type: "PUT",
      contentType: 'application/octet-stream',
      data: data,
      processData: false
    }));
  }

  /**
	 * @Override
	 */
  writes(path, data) {
		return this.write(path, Utils.StringToUint8Array(data));
	}
}

export { HttpServerStore }
