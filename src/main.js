/*@preserve Copyright (C) 2019-2022 Crawford Currie http://c-dot.co.uk license MIT*/
/* eslint-env browser */

import { Squirrel } from "./Squirrel.js";
import { Utils } from "./Utils.js";

import "jquery/dist/jquery.js";
import "@wikimedia/jquery.i18n/src/jquery.i18n.js";
import "@wikimedia/jquery.i18n/src/jquery.i18n.language.js";
import "@wikimedia/jquery.i18n/src/jquery.i18n.messagestore.js";
import "@wikimedia/jquery.i18n/src/jquery.i18n.parser.js";
import "@wikimedia/jquery.i18n/src/jquery.i18n.fallbacks.js";
import "@wikimedia/jquery.i18n/src/jquery.i18n.emitter.js";

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
/*
const min = qs.debug ? "" : ".min";

const rjs_config = {
  baseUrl: ".",
  paths: {
    jquery: `node_modules/jquery/jquery${min}`,
    "jquery-ui": `node_modules/jquery-ui-dist/jquery-ui${min}`,
    contextmenu: `node_modules/ui-contextmenu/jquery.ui-contextmenu${min}`,
    cookie: "node_modules/jquery.cookie/jquery.cookie",
    "jquery-touch-events": `node_modules/@benmajor/jquery-touch-events/src/jquery.mobile-events${min}`,
    clipboard: `node_modules/clipboard/dist/clipboard${min}`,
    i18n: "node_modules/@wikimedia/jquery.i18n/src/jquery.i18n",
    i18n_emitter:
    "node_modules/@wikimedia/jquery.i18n/src/jquery.i18n.emitter",
    i18n_fallbacks:
    "node_modules/@wikimedia/jquery.i18n/src/jquery.i18n.fallbacks",
    i18n_language:
    "node_modules/@wikimedia/jquery.i18n/src/jquery.i18n.language",
    i18n_messagestore:
    "node_modules/@wikimedia/jquery.i18n/src/jquery.i18n.messagestore",
    i18n_parser:
    "node_modules/@wikimedia/jquery.i18n/src/jquery.i18n.parser",
    cldrpluralruleparser:
    "node_modules/@wikimedia/jquery.i18n/libs/CLDRPluralRuleParser/src/CLDRPluralRuleParser",
    "jquery-ui/ui/widgets/menu": "js/rjs_stub"
  },

  shim: {
    "jquery-touch-events": [ "jquery" ],
    "jquery-ui":           [ "jquery" ],
    contextmenu:           [ "jquery-ui" ],
    i18n:                  [ "jquery" ],
    i18n_emitter:          [ "i18n" ],
    i18n_fallbacks:        [ "i18n"],
    i18n_language:         ["i18n"],
    i18n_messagestore:     ["i18n"],
    i18n_parser:           ["i18n"],
    cldrpluralruleparser: {
      deps: [ "i18n_parser" ]
      //exports: "pluralRuleParser"
    }
  }   
};

if (qs.debug)
  rjs_config.urlArgs = `nocache=${Date.now()}`; // suppress cache

requirejs.config(rjs_config);

requirejs([
	"js/Squirrel",
  "jquery", "i18n",
  "i18n_emitter",
  "i18n_fallbacks",
  "i18n_language",
  "i18n_messagestore",
  "i18n_parser"
], Squirrel => {
  */

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
