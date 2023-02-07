/*@preserve Copyright (C) 2019-2022 Crawford Currie http://c-dot.co.uk license MIT*/
/* eslint-env browser */

import "jquery/dist/jquery.js";
import "jquery-ui/dist/jquery-ui.js";

import "../jq/i18n.js";

import { Squirrel } from "./Squirrel.js";
import { Utils } from "../common/Utils.js";

// Parse URL parameters
const qs = Utils.parseURLParams(
  window.location.search.substring(1),
  {
		// The base store path
    store: { type: "string", "default": "LocalStorageStore" },
		// Additional store layers
    use: { array: true, type: "string", "default": ["Crypto"] },
		// 1 for debug messages
    debug: { type: "boolean" },
		// Remote store URL
    url: { type: "string" },
    api_key: { type: "string" }
  });

$(() => {
  if (qs.debug) {
	  if ($.support.touch)
		  console.debug("Device is touch-capable");
	  console.debug(
		  "Device is", window.screen.width, "X",
		  window.screen.height, "Body is",
		  $("body").width(), "X", $("body").height());
  } else {
	  // By default, jQuery timestamps datatype 'script' and 'jsonp'
	  // requests to avoid them being cached by the browser.
	  // Disable this functionality by default so that as much as
	  // possible is cached locally
	  $.ajaxSetup({
		  cache: true
	  });
  }

  $.i18n.init()
  .then(() => new Squirrel(qs).begin());
});
