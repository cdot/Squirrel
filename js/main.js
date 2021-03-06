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

requirejs(["js/Utils"], function (Utils) {
    // Parse URL parameters
    let qs = Utils.parseURLParams(
        window.location.search.substring(1),
        {
            store: { type: "string", "default": "LocalStorageStore" },
            use: { array: true, type: "string", "default": ["aes"] },
            debug: { type: "boolean" },
            url: { type: "string" }
        });

    if (qs.debug) {
        requirejs.config({
            urlArgs: `nocache=${Date.now()}` // suppress cache
        });
    }

    requirejs(["jquery", "jquery-ui", "js/Translator", "js/Squirrel"], function (jq, jqui, Translator, Squirrel) {

        Translator.instance().debug = qs.debug ? console.debug : false;
        Translator.instance().options.url = "locale";
        
        if (qs.debug) {
            if ($.isTouchCapable && $.isTouchCapable())
                console.debug("Device is touch-capable");
            console.debug(
				"Device is", window.screen.width, "X",
                window.screen.height, "Body is",
                $("body").width(), "X", $("body").height());
        } else {
            // By default, jQuery timestamps datatype 'script' and 'jsonp'
            // requests to avoid them being cached by the browser.
            // Disable this functionality by default so that as much as
            // possible is cached locally
            $.ajaxSetup({
                cache: true
            });
        }

        // Initialise UI components
        $(function() {          
            // Have to do this as a two-step process because mobile-events has
            // a clumsy dependency on jQuery
            requirejs(["mobile-events"], function() {
                new Squirrel(qs).begin();
            });
        });
    });
});
    

    
