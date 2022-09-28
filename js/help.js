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
    "jquery-ui": "//cdnjs.cloudflare.com/ajax/libs/jqueryui/1.12.1/jquery-ui"
  }
});

define([
	"cookie", "jquery", "js/jq/icon_button", "js/jq/twisted",
	"js/jq/styling"
], () => {

  $(function() {
    $.styling.init();
    $("button").icon_button();
    $(".twisted").twisted();
    if ($.cookie("ui_scale"))
      $("body").css("font-size", $.cookie("ui_scale") + "px");
    $.styling.reset();
  });
});
