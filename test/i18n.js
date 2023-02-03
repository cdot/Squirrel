import { jsdom } from "./jsdom.js";
import Path from "path";
import { fileURLToPath } from "url";
const __dirname = Path.dirname(fileURLToPath(import.meta.url));

/** Fixture for internationalisation */
function i18n() {
  return jsdom()
  .then(() => Promise.all([
    import("@wikimedia/jquery.i18n/src/jquery.i18n.js"),
    import("@wikimedia/jquery.i18n/src/jquery.i18n.language.js"),
    import("@wikimedia/jquery.i18n/src/jquery.i18n.messagestore.js"),
    import("@wikimedia/jquery.i18n/src/jquery.i18n.parser.js"),
    import("@wikimedia/jquery.i18n/src/jquery.i18n.fallbacks.js"),
    import("@wikimedia/jquery.i18n/src/jquery.i18n.emitter.js")
  ]))
  .then(() => {
    const lang = "en";
    let url = 'file://' + Path.normalize(`${__dirname}/../i18n/${lang}.json`), nurl;
    $.i18n.debug = console.debug;
    const params = {};
    params[lang] = url;
    return $.i18n({ locale: lang }).load(params);
  });
}

export { i18n }
