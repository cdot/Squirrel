/*@preserve Copyright (C) 2019 Crawford Currie http://c-dot.co.uk license MIT*/
/* eslint-env browser */

requirejs.config({
    baseUrl: ".",
    paths: {
        jquery: "//cdnjs.cloudflare.com/ajax/libs/jquery/3.3.1/jquery",
        "jquery-ui": "//cdnjs.cloudflare.com/ajax/libs/jqueryui/1.12.1/jquery-ui",
        "jquery-ui/ui": "//cdn.jsdelivr.net/npm/jquery-ui@1.12.1/ui",
        contextmenu: "//cdnjs.cloudflare.com/ajax/libs/jquery.ui-contextmenu/1.18.1/jquery.ui-contextmenu.min",
        "js-cookie": "//cdnjs.cloudflare.com/ajax/libs/js-cookie/2.2.0/js.cookie.min",
        "mobile-events": "//cdnjs.cloudflare.com/ajax/libs/jquery-touch-events/2.0.0/jquery.mobile-events.min",
        clipboard: "//cdnjs.cloudflare.com/ajax/libs/clipboard.js/2.0.3/clipboard.min"
    }
});

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

    Translator.instance({debug: qs.debug ? console.debug : false});

    // Initialise UI components
    $(function() {
        new Squirrel(qs).begin();
    });
});



