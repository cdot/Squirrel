/*@preserve Copyright (C) 2019-2022 Crawford Currie http://c-dot.co.uk license MIT*/
/* eslint-env browser */

/**
 * Parse a URL parameter string according to the given spec
 * @param {string} s the URLparameters string (undecoded)
 * @param {object.<string.object>} spec optional parameter spec object.
 * Fields are parameter names, and map to an object that can have
 * array:true for array values
 * and must have type: for the parameter type. type: is one of the
 * standard JS object types e.g. String, Number, Date and uses the
 * constructor of that object type to create the value.
 * @return {object.<string,object>} map of parameter name to value
 * @throw Error if there is a problem
 */
function parseURLParams(s, specs) {
  function parse(v, t) {
    switch (t) {
    case "number": case "float":
      return parseFloat(v);
    case "int": case "integer":
      return parseInt(v);
    case "bool": case "boolean":
      if (!v) return false;
      if (/^(false|no)$/i.test(v)) return false;
      if (/^[0-9]+$/.test(v)) return parseInt(v) != 0;
      return true;
    }
    return v;
  }
  
  if (!specs) specs = {};
  const lets = s.split(/[&;]+/);
  const query = {};
  for (let i = 0; i < lets.length; i++) {
    if (lets[i] === "")
      continue;
    const ass = lets[i].split('=', 2);
    let key, value;
    if (ass.length > 1) // value option
      key = ass[0], value = decodeURIComponent(ass[1]);
    else
      key = ass, value = "1"; // boolean option
    
    const spec = specs[key];
    if (!spec)
      query[key] = value;
    else {
      if (spec.array) {
        query[key] = value.split(",")
				.map(v => parse(v, spec.type));
      }
      else
        query[key] = parse(value, spec.type);
    }
  }

  for (let key in specs) {
    if (!(key in query)) {
      if ("default" in specs[key]) {
        query[key] = specs[key].default;
      }
    }
  }
  return query;
}

// Parse URL parameters
const qs = parseURLParams(
  window.location.search.substring(1),
  {
		// The base store path
    store: { type: "string", "default": "LocalStorageStore" },
		// Additional store layers
    use: { array: true, type: "string", "default": ["Crypto"] },
		// 1 for debug messages
    debug: { type: "boolean" },
		// Remote store URL
    url: { type: "string" }
  });

const min = qs.debug ? "" : ".min";

const rjs_config = {
  baseUrl: ".",
  paths: {
    jquery: `node_modules/jquery/dist/jquery${min}`,
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

/**
 * "Main Program"
 */


requirejs([
	"js/Squirrel",
  "jquery", "i18n",
  "i18n_emitter",
  "i18n_fallbacks",
  "i18n_language",
  "i18n_messagestore",
  "i18n_parser"
], Squirrel => {
  
	if (qs.debug) {
		if ($.isTouchCapable && $.isTouchCapable())
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
  const ulang = $.cookie("language") || "en";
  if (qs.debug)
    console.debug("User language", ulang);
  // Set up to load the language file
  params[ulang] = `/i18n/${ulang}.json`;
  // Select the language and load
  return $.i18n({ locale: ulang }).load(params)
  .then(() => new Squirrel(qs).begin());
});
