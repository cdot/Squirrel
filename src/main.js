/*@preserve Copyright (C) 2019 Crawford Currie http://c-dot.co.uk license MIT*/
/* eslint-env browser */

/* global global:false */

/* global Utils:true */
/* global Squirrel:true */
/* global Cookies:true */
/* global Translator:true */
/* global TX:true */
/* global document:true */

if (typeof module !== "undefined") {
    let fs = require("fs");
    let html = fs.readFileSync("../index.html");
    let jsdom = require('jsdom');
    var { JSDOM } = jsdom;
    document = new JSDOM(html);
    var { window } = document;
    global.jQuery = require('jquery')(window);
    global.$ = jQuery;
    require("jquery-ui"); // loads ui/widgets.js
    require("jquery-ui/ui/widgets/button"); // loads ui/widgets/button.js
    require("jquery-ui/ui/plugin"); // loads ui/widgets/button.js
    require("jquery-ui/ui/widgets/mouse"); // loads ui/widgets/button.js
    require("jquery-ui/ui/widgets/draggable"); // loads ui/widgets/button.js
    require("../src/jquery/icon_button");
    Utils = require("../src/Utils");
    Translator = require("../src/Translator");
    Squirrel = require("../src/Squirrel");

    Cookies = {
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

(function ($) {
    // Parse URL parameters
    let qs = Utils.parseURLParams(window.location.search.substring(1));

    if (qs.debug) {
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

    if (typeof qs.store === "undefined")
        qs.store = "LocalStorageStore";

    TX = Translator.init({debug: qs.debug ? console.debug : false});

    qs.cookies = Cookies;

    // Initialise UI components
    $(function() {
        let squirrel = new Squirrel(qs);

        squirrel.init_ui();
        $(document).trigger("init_application");
    });
})(jQuery);



