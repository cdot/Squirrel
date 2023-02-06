/* global DOM */

function jsdom(url, html) {
  if (typeof global === "undefined")
    // PITA, but doesn't matter how many times I use a static import,
    // $.ui is never defined!
    return Promise.all([
      import("jquery/dist/jquery.js"),
      import("jquery-ui/dist/jquery-ui.js")
    ]);

  const opts = {
    url: url,
    resources: "usable"
  };
  let JSDOM, jquery;
  Promise.all([
    import("jquery/dist/jquery.js"),
    import("jquery-ui/dist/jquery-ui.js"),
    import("jsdom")
  ])
  .then(modz => {
    jquery = modz[0].default;
    JSDOM = modz[1].JSDOM;
    if (html)
      return JSDOM.fromFile(html, opts);
    else
      return new JSDOM(`<!doctype html><html></html>"`, opts);
  })
  .then(dom => {
    global.DOM = dom;
    global.window = DOM.window;
    global.document = DOM.window.document;
    global.navigator = { userAgent: "node.js" };
    global.$ = global.jQuery = jquery(window);
  });
}

export { jsdom }
  
