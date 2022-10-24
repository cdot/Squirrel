/*@preserve Copyright (C) 2022 Crawford Currie http://c-dot.co.uk license MIT*/
/*eslint-env shared-node-browser, mocha */

const paths = {
  //    jquery: "node_modules/jquery/dist/jquery",
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

  "jquery-touch-events": "node_modules/@benmajor/jquery-touch-events/src/jquery.mobile-events",
  "jquery-ui": "node_modules/jquery-ui-dist/jquery-ui"
};

if (typeof document === "undefined") {
  // node.js
  const { JSDOM } = require('jsdom');
  /* eslint-disable no-global-assign */
  document = new JSDOM('<!doctype html><html><body id="working"></body></html>');
  /* eslint-enable no-global-assign */
  const { window } = document;
  global.window = window;
  global.document = window.document;
  global.navigator = { userAgent: "node.js" };
  const jQuery = require('jquery');
  global.jQuery = jQuery;
  global.$ = jQuery;

  //paths.i18n = "test/I18N";
}

requirejs.config({
	baseUrl: `${__dirname}/..`,
  paths: paths,
  shim: {
    "jquery-touch-events": [ "jquery" ],
    "jquery-ui":           [ "jquery" ],
    i18n:                  [ "jquery" ],
    i18n_emitter:          [ "i18n" ],
    i18n_fallbacks:        [ "i18n"],
    i18n_language:         ["i18n"],
    i18n_messagestore:     ["i18n"],
    i18n_parser:           ["i18n"],
    cldrpluralruleparser: {
      deps: [ "i18n_parser", "i18n_messagestore", "i18n_emitter", "i18n_language" ]
      //exports: "pluralRuleParser"
    }
	}
});
