/*@preserve Copyright (C) 2019 Crawford Currie http://c-dot.co.uk license MIT*/
/* eslint-env browser */
import "jquery/dist/jquery.js";
import "jquery-ui/dist/jquery-ui.js";
import "jquery.cookie/jquery.cookie.js";
import { default as Banana } from "banana-i18n/dist/banana-i18n.js";

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

$.i18n.init = (root) => {

  if (!root) root = ".";
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
  console.debug("i18n loading en");
  return $.get(`${root}/i18n/en.json`)
  .then(en => banana = new Banana("en", { messages: en }))
  .catch(e => {
    console.error(`i18n en load failed`);
    throw e;
  })
  .then(() => {
    if (language === "en") {
      console.debug("i18n using default en");
      return banana;
    }

    // Load the language selected in the browser
    console.debug("i18n loading", language);
    return $.get(`${root}/i18n/${language}.json`)
    .catch(e => {
      console.error(`i18n ${language} load failed`);
      if (/-/.test(language)) {
        language = language.replace(/-.*$/, "");
        if (language === "en") {
          console.debug("i18n using en (fallback)");
          return undefined;
        }
        console.debug("i18n loading", language);
        return $.get(`${root}/i18n/${language}.json`);
      }
      throw e;
    })
    .then(messages => {
      if (messages) {
        banana.load(messages, language);
        banana.setLocale(language);
        console.debug("Using language", language);
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

