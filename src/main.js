/*@preserve Copyright (C) 2019 Crawford Currie http://c-dot.co.uk license MIT*/
/* eslint-env browser */

requirejs.config({
    baseUrl: ".",
    paths: {
        js: "src",
        jsjq: "src/jquery",
        jquery: "//cdnjs.cloudflare.com/ajax/libs/jquery/3.3.1/jquery",
        "jquery-ui": "//cdnjs.cloudflare.com/ajax/libs/jqueryui/1.12.1/jquery-ui",
        "jquery-ui/ui": "node_modules/jquery-ui/ui",
        contextmenu: "//cdnjs.cloudflare.com/ajax/libs/jquery.ui-contextmenu/1.18.1/jquery.ui-contextmenu.min",
        cookie: "//cdnjs.cloudflare.com/ajax/libs/js-cookie/2.2.0/js.cookie.min",
        "mobile-events": "//cdnjs.cloudflare.com/ajax/libs/jquery-touch-events/2.0.0/jquery.mobile-events.min",
        clipboard: "//cdnjs.cloudflare.com/ajax/libs/clipboard.js/2.0.3/clipboard.min"
    }
});

if (typeof module !== "undefined") {
    /* eslint-env node */
    let fs = require("fs");
    let html = fs.readFileSync("../index.html");
    let jsdom = require('jsdom');
    var { JSDOM } = jsdom;
    /* global document: true */
    document = new JSDOM(html);
    var { window } = document;
    global.jQuery = require('jquery')(window);
    global.$ = jQuery;
    require("jquery-ui"); // loads ui/widgets.js
    require("jquery-ui/ui/widgets/button"); // loads ui/widgets/button.js
    require("jquery-ui/ui/plugin"); // loads ui/widgets/button.js
    require("jquery-ui/ui/widgets/mouse"); // loads ui/widgets/button.js
    require("jquery-ui/ui/widgets/draggable"); // loads ui/widgets/button.js

    /* global Cookies */
    global.Cookies = {
        // TODO: save a .rc
        vals: {},
        get: (k) => {
            return Cookies.vals[k];
        },
        set: (k, v) => {
            Cookies.vals[k] = v;
        },
        remove: (k) => {
            delete Cookies.vals[k];
        }
    }
}

define(["js/Utils", "js/Squirrel", "js/Translator", "jquery"], function (Utils, Squirrel, Translator) {
    // Parse URL parameters
    let qs = Utils.parseURLParams(window.location.search.substring(1));

    if (typeof qs.debug !== "undefined") {
        requirejs.config({
            urlArgs: "nocache=" + Date.now() // suppress cache
        });
        if ($.isTouchCapable && $.isTouchCapable())
            console.debug("Device is touch-capable");
        console.debug("Device is " + window.screen.width + " X " +
            window.screen.height + " Body is " +
            $("body")
            .width() + " X " + $("body")
            .height());
    } else {
        // By default, jQuery timestamps datatype 'script' and 'jsonp'
        // requests to avoid them being cached by the browser.
        // Disable this functionality by default so that as much as
        // possible is cached locally
        $.ajaxSetup({
            cache: true
        });
    }

    if (typeof qs.stores === "undefined")
        qs.cloudStore = "LocalStorageStore";

    Translator.instance({debug: qs.debug ? console.debug : false});

    // Initialise UI components
    $(function() {
        let squirrel = new Squirrel(qs);

        squirrel.init_ui();
        $(document).trigger("init_application");
    });
});



