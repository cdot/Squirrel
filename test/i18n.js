import { jsdom } from "./jsdom.js";
import Path from "path";
import { fileURLToPath } from "url";
const __dirname = Path.dirname(fileURLToPath(import.meta.url));

/** Fixture for internationalisation */
function i18n() {
  return jsdom()
  .then(() => Promise.all([
    import("../../src/jq/i18n.js"),
  ]))
  .then(() => {
    const lang = "en";
    let url = 'file://' + Path.normalize(`${__dirname}/../i18n/${lang}.json`), nurl;
    const params = {};
    params[lang] = url;
    return $.i18n({ locale: lang }).load(params);
  });
}

export { i18n }
