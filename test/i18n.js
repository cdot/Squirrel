import { jsdom } from "./jsdom.js";

/**
 * Load i18n for tests.
 * Should work in node.js and browser.
 */
function i18n() {
  return jsdom()
  .then(() => {
    if (!window.navigator)
      window.navigator = {};
    window.navigator.userLanguage = "en";
    return import("../src/jq/i18n.js");
  })
  .then(() => {

    if (typeof global === "undefined") {
      // BROWSER
      return $.i18n.init("../..");

    } else {
      // NODE.JS
      return Promise.all([
        import("path"),
        import("url")
      ])
      .then(modz => {
        const Path = modz[0];
        const fileURLToPath = modz[1].fileURLToPath;
        const __dirname = Path.dirname(import.meta.url);
        return $.i18n.init(`${__dirname}/..`);
      });
    }
  });
}

export { i18n }
