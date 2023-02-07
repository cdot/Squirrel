/*@preserve Copyright (C) 2022 Crawford Currie http://c-dot.co.uk license MIT*/
/*eslint-env node, mocha */

import { assert } from "chai";
import { i18n } from "../i18n.js";

/**
 * Note this may not run correctly under node.js, due to the lack of event
 * handlers in jsdom. The gold standard is that it runs in a browser.
 */
describe("template", () => {

  before(
    () => i18n()
    .then(() => import("../../src/jq/template.js")));

  beforeEach(function() {
    if ($("#actual").length === 0)
      $("body").append("<div id='actual'></div>");
    $("#actual").empty();
    if ($("#expected").length === 0)
      $("body").append("<div id='expected'></div>");
    $("#expected").empty();
  });

	it("expand1", () => {
    const $expected = $("#expected");
    const $actual = $("#actual");
    $actual.append('<div data-i18n-template="A$1C"></div>');
    $actual.find("div").template();
    $actual.find("div").template("expand", "B");
    $expected.append('<div data-i18n-template="A$1C">ABC</div>');
    assert.equal($actual.html(), $expected.html());
  });

	it("expand2", () => {
    const $expected = $("#expected");
    const $actual = $("#actual");
    $actual.append('<div data-i18n-template="{{PLURAL:$1|FALSE|TRUE}}"></div>');

    $actual.find("div").template();
    $actual.find("div").template("expand", 2);
    $expected.html('<div data-i18n-template="{{PLURAL:$1|FALSE|TRUE}}">TRUE</div>');
    assert.equal($actual.html(), $expected.html());

    $actual.find("div").template("expand", 1);
    $expected.html('<div data-i18n-template="{{PLURAL:$1|FALSE|TRUE}}">FALSE</div>');
    assert.equal($actual.html(), $expected.html());
  });

  it("pick", () => {
    const $expected = $("#expected");
    const $actual = $("#actual");
    $actual.append('<div class="pick-one"><span data-id=1>one</span><span data-id=2>two</span></div>');
    $actual.find("div").template();
    $actual.find("div").template("pick", 1);
    $expected.html('<div class="pick-one"><span data-id="1" style="">one</span><span data-id="2" style="display: none;">two</span></div>');
    let act = $actual.find("div")[0];
    let exp = $expected.find("div")[0];
    assert(act.isEqualNode(exp),
           `\nExpect: ${$expected.html()}\n\nActual: ${$actual.html()}`);
    
    $actual.find("div").template("pick", 2);
    $expected.html('<div class="pick-one"><span data-id="1" style="display: none;">one</span><span data-id="2" style="">two</span></div>');
    act = $actual.find("div")[0];
    exp = $expected.find("div")[0];
    assert(act.isEqualNode(exp),
           `\nExpect: ${$expected.html()}\n\nActual: ${$actual.html()}`);
  });
});
