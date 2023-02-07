/**
 * Set up $, $.cookie, and $.ui for unit tests. Should run under
 * node or browser.
 * @param {string?} url the url we are pretending to have been loaded
 * from (node only)
 * @param {string?} html file path to load html from (node only)
 */
function jsdom(url, html) {

  if (typeof $ !== "undefined")
    return Promise.resolve();

  if (typeof global === "undefined") {
    // BROWSER
    // PITA, but doesn't matter how many times I use a static import,
    // $.ui is never defined!
    // N.B. requires importmap
    return import("jquery/dist/jquery.js")
    .then(() => import("jquery-ui/dist/jquery-ui.js"))
    .then(() => import("jquery.cookie/jquery.cookie.js"));
  }

  // NODE.JS
  const opts = {
    url: url,
    resources: "usable"
  };

  let JSDOM, jquery;
  return import("jsdom")
  .then(mod => JSDOM = mod.JSDOM)
  .then(() => import("jquery/dist/jquery.js"))
  .then(mod => jquery = mod.default)
  .then(() => {
    if (html)
      return JSDOM.fromFile(html, opts);
    else
      return new JSDOM(`<!doctype html><html></html>"`, opts);
  })
  .then(dom => {
    global.DOM = dom;
    global.window = dom.window;
    global.document = dom.window.document;
    global.navigator = { userAgent: "node.js" };
    global.$ = global.jQuery = jquery(window);
  })
  .then(() => import("../src/jq/cookie.js"))
  .then(() => import("jquery-ui/dist/jquery-ui.js"));
}

export { jsdom }
  
