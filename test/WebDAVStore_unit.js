/*@preserve Copyright (C) 2019 Crawford Currie http://c-dot.co.uk license MIT*//*eslint-env node, mocha */

import { assert } from "chai";
import {jsdom} from "./jsdom.js";
import { StoreTester } from "./StoreTester.js";

let server;

function setup() {
  if (typeof global === undefined)
    // When run from the browser, requires `url` to be set up to
    // point to a webdav server, and `net_user/net_password` to log
    // in to that server.
    return Promise.resolve({
			url: "?",
			net_user: "?",
      net_pass: "?"
    });

  else {
    const PORT = 13199;
    // When run from node.js, create a
    // webdav server on PORT.
    return Promise.all([
      import("path"),
      import("url"),
      import("webdav-server"),
      import("tmp-promise")
    ])
    .then(mods => {
      const Path = mods[0];
      const fileURLToPath = mods[1].fileURLToPath;
      const __dirname = Path.dirname(fileURLToPath(import.meta.url));
		  const WebDAV = mods[2].v2;
      const tmp = mods[3].default;

		  const userManager = new WebDAV.SimpleUserManager();
      const webdav_user = `u${Date.now()}`;
      const webdav_pass = `p${webdav_user}`;
		  const user = userManager.addUser(webdav_user, webdav_pass, false);
		  console.log("User", user);
		  const privilegeManager = new WebDAV.SimplePathPrivilegeManager();
		  privilegeManager.setRights(user, "/", [ 'all' ]);
      const headers = {};
      headers["access-control-allow-headers"] = "Authorization";
		  server = new WebDAV.WebDAVServer({
			  httpAuthentication: new WebDAV.HTTPBasicAuthentication(
				  userManager, 'Default realm'),
			  privilegeManager: privilegeManager,
			  port: PORT,
        headers: headers
		  });

		  return tmp.dir({unsafeCleanup: true})
      .then(p => p.path)
      .then(tmpdir => new Promise(resolve => server.setFileSystem(
			  "/",
			  new WebDAV.PhysicalFileSystem(tmpdir),
			  success =>
			  server.start(() => {
				  console.log('Server ready');
				  resolve({
					  url: `http://localhost:${PORT}`,
					  net_user: webdav_user,
            net_pass: webdav_pass,
//            debug: console.debug
          });
			  }))));
    });
  }
}

const suite = describe("WebDAVStore", () => {

  before(() => jsdom()
         .then(() => setup())
         .then(cfg => new StoreTester(["WebDAVStore"]).setup(suite, cfg)));

  after(() => server ? server.stopAsync() : 0);

  it("Placeholder", () => {});
});

