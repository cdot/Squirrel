/*@preserve Copyright (C) 2017-2022 Crawford Currie http://c-dot.co.uk license MIT*/
/* eslint-env browser, node */

import "jquery/dist/jquery.js";
import "jquery-ui/dist/jquery-ui.js";

import "../jq/cookie.js";
import "../jq/icon_button.js";
import "../jq/styling.js";
import "../jq/twisted.js";

$(() => {
  $.styling.init();
  $("button").icon_button();
  $(".twisted").twisted();
  if ($.cookie("ui_scale"))
    $("body").css("font-size", $.cookie("ui_scale") + "px");
  $.styling.reset();
});
