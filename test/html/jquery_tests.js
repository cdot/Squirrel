/*@preserve Copyright (C) 2019 Crawford Currie http://c-dot.co.uk license MIT*/
/*eslint-env browser*/
/*global __filename*/

if (typeof requirejs === 'undefined')
  throw new Error(__filename + " is not runnable stand-alone");

/**
 * Support for jquery_tests HTML page
 */
requirejs.config({
  baseUrl: "..",
  urlArgs: "nocache=" + Date.now(),
  paths: {
    mocha: "//cdnjs.cloudflare.com/ajax/libs/mocha/6.0.2/mocha",
    chai: "//cdnjs.cloudflare.com/ajax/libs/chai/4.2.0/chai",
    jquery: "//code.jquery.com/jquery-3.3.1",
    "jquery-ui": "//cdnjs.cloudflare.com/ajax/libs/jqueryui/1.12.1/jquery-ui"
  }
});

import { Translator } from "../src/Translator.js";
import "../src/jq/icon_button";
import "./simulated_password.js";

  const TX = Translator.configure({ url: "locale", debug: console.debug});

  /*function assert(v, m) {
    if (!v) {
    if (typeof m !== 'undefined')
    throw "Assert failed: " + m;
    else
    throw "Assret failed";
    }
    }*/

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

  return () =>
  // on ready
  TX.language("fr").then(() => {
    simulated_password();
    icon_button();
  });
});
