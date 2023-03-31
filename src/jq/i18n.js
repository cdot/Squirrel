/*@preserve Copyright (C) 2019 Crawford Currie http://c-dot.co.uk license MIT*/
/* eslint-env browser */
import "jquery";
import "jquery-ui";
import "./cookie.js";
// See resolution of Banana, below
import "banana-i18n";

/**
 * Support for $.i18n internationalisation using banana-i18n.
 * A reaonably drop-in replacement for jQuery.i18n, which appears
 * unsupported.
 */

let banana;

$.i18n = (...args) => {
  const ret = banana.i18n.apply(banana, args);
  return ret;
};

$.i18n.init = (root = ".", debug = false) => {

  let language;

  // Get the language from cookies
  const ulang = $.cookie("ui_lang");
  if (ulang)
    language = ulang;

  // Get the language from the browser
  else if (window.navigator.languages)
    language = window.navigator.languages[0];
  else
    language = window.navigator.userLanguage || window.navigator.language;

  // Load the fallback, English
  if (debug) debug("i18n loading fallback from", `${root}/i18n/en.json`);

  // Running in the browser, outside of webpack, the ESM import statement
  // above defines a global "Banana". Running in node and in webpack,
  // only loading the module explicitly gives us access.
  let bunch;
  if (typeof Banana !== "undefined") {
    bunch = Promise.resolve(Banana);
  } else {
    bunch = import("banana-i18n")
    .then(mod => {
      return mod.default;
    });
  }

  return Promise.all([
    bunch,
    $.getJSON(`${root}/i18n/en.json`)
  ])
  .then(modz => {
    const Banana = modz[0], en = modz[1];
    banana = new Banana("en", { messages: en });
  })
  .catch(e => {
    console.error(`i18n fallback load failed`);
    throw e;
  })
  .then(() => {
    if (language === "en") {
      if (debug) debug("i18n using default en");
      return banana;
    }

    // Load the language selected in the browser
    if (debug) debug("i18n loading", language);

    return $.getJSON(`${root}/i18n/${language}.json`)
    .catch(e => {
      console.error(`i18n ${language} load failed`);
      if (/-/.test(language)) {
        language = language.replace(/-.*$/, "");
        if (language === "en") {
          if (debug) debug("i18n using en (fallback)");
          return undefined;
        }
        if (debug) debug("i18n loading", language);
        return $.getJSON(`${root}/i18n/${language}.json`);
      }
      throw e;
    })
    .then(messages => {
      if (messages) {
        banana.load(messages, language);
        banana.setLocale(language);
        if (debug) debug("Using language", language);
      }
      return banana;
    });
  });
}

// Function to get the locale
$.i18n.locale = () => banana.locale;

$.widget("custom.i18n", {
  _create: function() {
    const $el = $(this.element);
    if ($el.data("i18n"))
      $el.html(banana.i18n($el.data("i18n")));
  }
});
