/*@preserve Copyright (C) 2017 Crawford Currie http://c-dot.co.uk license MIT*/
/* eslint-env browser, node */

if (typeof requirejs === 'undefined') {
    requirejs = require('requirejs');
	requirejs.config({
		baseUrl: `${__dirname}/..`
	});
}

requirejs.config({
    baseUrl: ".",
    paths: {
        jquery: "//cdnjs.cloudflare.com/ajax/libs/jquery/3.3.1/jquery",
        "jquery-ui": "//cdnjs.cloudflare.com/ajax/libs/jqueryui/1.12.1/jquery-ui",
        "jquery-ui/ui": "//cdn.jsdelivr.net/npm/jquery-ui@1.12.1/ui",
        "js-cookie": "//cdnjs.cloudflare.com/ajax/libs/js-cookie/2.2.0/js.cookie.min"
    }
});

define([
	"js-cookie", "jquery", "js/jq/icon_button", "js/jq/twisted",
	"js/jq/styling"
], Cookies => {

    $(function() {
        $.styling.init();
        $("button").icon_button();
        $(".twisted").twisted();
        if (Cookies.get("ui_scale"))
            $("body").css("font-size", Cookies.get("ui_scale") + "px");
        $.styling.reset();
    });
});
