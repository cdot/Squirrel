/*@preserve Copyright (C) 2017-2022 Crawford Currie http://c-dot.co.uk license MIT*/
/* eslint-env browser, node */

const min = /[\?;]debug/.test(window.location.search.substring(1))
      ? "" : ".min";

requirejs.config({
  paths: {
    jquery: `node_modules/jquery/dist/jquery${min}`,
    "jquery-ui": `node_modules/jquery-ui-dist/jquery-ui${min}`,
    cookie: "node_modules/jquery.cookie/jquery.cookie"
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
