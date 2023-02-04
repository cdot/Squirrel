/*@preserve Copyright (C) 2019-2022 Crawford Currie http://c-dot.co.uk license MIT*/
/* eslint-env browser */

import "jquery/dist/jquery.js";
import "jquery-ui-dist/jquery-ui.js";
import "jquery.cookie/jquery.cookie.js";
import "@wikimedia/jquery.i18n/src/jquery.i18n.js";
import "@wikimedia/jquery.i18n/src/jquery.i18n.language.js";
import "@wikimedia/jquery.i18n/src/jquery.i18n.messagestore.js";
import "@wikimedia/jquery.i18n/src/jquery.i18n.parser.js";
import "@wikimedia/jquery.i18n/src/jquery.i18n.fallbacks.js";
import "@wikimedia/jquery.i18n/src/jquery.i18n.emitter.js";

import { Squirrel } from "./Squirrel.js";
import { Utils } from "./Utils.js";

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

// Initialise UI components
const params = {};
const ulang = $.cookie("ui_lang") || "en";
if (qs.debug)
  console.debug("User language", ulang);
// Set up to load the language file
params[ulang] = `i18n/${ulang}.json`;
// Select the language and load
$.i18n({ locale: ulang }).load(params)
.then(() => new Squirrel(qs).begin());
