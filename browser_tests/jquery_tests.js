/*@preserve Copyright (C) 2019 Crawford Currie http://c-dot.co.uk license MIT*/
/*eslint-env browser*/
/*global __filename*/

import { assert } from "chai";
import "jquery/dist/jquery.js";
import "../../src/jq/i18n.js";
import "../../src/jq/icon_button.js";
import "../../src/jq/simulated_password.js";
import "../../src/jq/template.js";

function simulated_password() {
  $("#hidden_pw")
  .simulated_password()
  .on("change", function() {
    const info = $(this).val() + " (on change)";
    console.debug(info);
    $("#pw_val").text(info);
  })
  .on("input", function() {
    const info = $(this).val() + "(on input)";
    console.debug(info);
      $("#pw_val").text(info);
  });
  $("#password_reset").on("click", function() {
    $("#hidden_pw").val("reset");
    $("#pw_val").text($("#hidden_pw").val());
  });
}

function icon_button() {
  $(".icon_button").icon_button();
}

function template() {
  $(".actual").template();

  $("#template1 .actual").template("expand", "B");

  $("#template2 .expected").text("1");
  $("#template2 .actual").template(
    "expand", $("#template2 .expected").text());
  $("#template2").on("click", () => {
    if ($("#template2 .expected").text() > 1) {
      $("#template2 .actual").template("expand", 1);
      $("#template2 .expected").text("1");
    } else {
      $("#template2 .actual").template("expand", 2);
      $("#template2 .expected").text("2");
    }
  });

  $("#template3 .actual").template("pick", 1);
  $("#template3").on("click", () => {
    if ($("#template3 .expected").text() > 1) {
      $("#template3 .actual").template("pick", 1);
      $("#template3 .expected").text(1);
    } else {
      $("#template3 .actual").template("pick", 2);
      $("#template3 .expected").text(2);
    }
  });
}

$(() => {
  simulated_password();
  icon_button();
  template();
});
