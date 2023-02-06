/*@preserve Copyright (C) 2019 Crawford Currie http://c-dot.co.uk license MIT*/
/*eslint-env node, mocha */
/*global document:writable*/

import { assert } from "chai";
import { jsdom } from "./jsdom.js";

describe("icon_button", () => {

  before(() => jsdom(true)
         .then(() => import("jquery-ui/dist/jquery-ui.js"))
         .then(() => import("../src/jq/icon_button.js")));

  beforeEach(function() {
    if ($("#actual").length === 0)
      $("body").append("<div id='actual'></div>");
    $("#actual").empty();
    if ($("#expected").length === 0)
      $("body").append("<div id='expected'></div>");
    $("#expected").empty();
  });

  it('basic', function() {
    const $expected = $("#expected");
    const $actual = $("#actual");
    const $butt = $('<button data-icon="ui-icon-info">Info</button>');
    $actual.append($butt);
    $butt.icon_button();

    $("#expected").append('<button data-icon="ui-icon-info" class="ui-button ui-corner-all ui-widget ui-button-icon-only" title="Info"><span class="ui-button-icon ui-icon ui-icon-info"></span><span class="ui-button-icon-space"> </span>Info</button>');

    assert($actual.html(), $expected.html(),
           `\nExpect: ${$expected.html()}\n\nActual: ${$actual.html()}`);
  });

  it('application', function() {
    const $expected = $("#expected");
    const $actual = $("#actual");
    const $butt = $('<button data-icon="app">App</button>');
    $actual.append($butt);
    $butt.icon_button();

    $expected.append('<button data-icon="app" class="ui-button ui-widget ui-button-icon-only" title="App"><span class="ui-button-icon squirrel-icon ui-icon app"></span><span class="ui-button-icon-space"> </span>App</button>');

    assert.equal($actual.html(), $expected.html(),
                 `\nExpect: ${$expected.html()}\n\nActual: ${$actual.html()}`);    
  });
});
