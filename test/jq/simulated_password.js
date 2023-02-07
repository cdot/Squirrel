/*@preserve Copyright (C) 2019 Crawford Currie http://c-dot.co.uk license MIT*/
/*eslint-env node, mocha */
/* global document:writable*/
/*global window */

/**
 * TestRunner for js/jq/simulated_password.js only.
 * Note this may not run correctly under node.js, due to the lack of event
 * handlers in jsdom. The gold standard is that it runs in a browser.
 */

import { assert } from "chai";
import { jsdom } from "../jsdom.js";

describe("jq/simulated_password", () => {

  before(
    () => jsdom()
    .then(() => import("../../src/jq/simulated_password.js")));

  afterEach(function() {
    $("body").empty();
  });

  it('basic', function() {
    const $html = $('<input type="password">');
    $("body").html($html);
    $html.simulated_password();
    const html = $("body").html();
    assert.equal(html, `<input type="text" class="simulated_password pass_hidden"><span class="ui-icon squirrel-icon squirrel-icon-eye-closed"></span>`);
  });

  it('not hidden, no checkbox', function() {
    $("body").html('<input class="password" id="tt" value="initial">');
    $(".password").simulated_password({hidden: false, checkbox:false});
    const html = $("body").html();
    assert.equal(html, '<input class="password simulated_password" id="tt" value="initial">');
  });

  it('options in data', function() {
    $("body").html(`<input class="password" id="tt" value="initial" data-options='{"hidden":false,"checkbox":false}'>`);
    $(".password").simulated_password();
    const html = $("body").html();
    assert.equal(html, '<input class="password simulated_password" id="tt" value="initial" data-options="{&quot;hidden&quot;:false,&quot;checkbox&quot;:false}">');
  });

  function setCursorPosition(input, pos) {
    if ('setSelectionRange' in input) {
      input.setSelectionRange(pos, pos);
    } else if ('createTextRange' in input) {
      const range = input.createTextRange();
      range.collapse(true);
      range.moveEnd('character', pos);
      range.moveStart('character', pos);
      range.select();
    }
  }

  it('typing', function() {
    $("body").html('<input class="password" id="tt" value="bass">');
    const $p = $(".password");
    $p.simulated_password({hidden: true, checkbox:false});
    $p.raw_val("•r•••");
    setCursorPosition($p[0], 2); // just after the r was typed
    $p.on("input", function() {
      assert.equal($p.val(), "brass");
      assert.equal($p.raw_val(), "•••••");
    });
    $p.trigger(jQuery.Event("input"));
  });

  it('typing', function() {
    $("body").html('<input class="password" id="tt" value="ass">');
    const $p = $(".password");
    $p.simulated_password({hidden: true, checkbox:false});
    $p.raw_val("•••");
    setCursorPosition($p[0], 0);
    $p.on("input", function() {
      assert.equal($p.val(), "ass");
      assert.equal($p.raw_val(), "•••");
    });
    $p.trigger(new jQuery.Event("input", { key: "h" }));
  });

  it('set val', function() {
    $("body").html('<input class="password" id="tt" value="bass">');
    const $p = $(".password");
    $p.simulated_password({hidden: true, checkbox:false});
    return new Promise((resolve, reject) => {
      const timmy = window.setTimeout(() => {
        assert.equal($p.val(), "roach");
        resolve();
      }, 20);
      // Must not get a change event
      $p.on("change", function() {
        window.clearTimeout(timmy);
        assert(false, "Unexpected change");
        reject();
      });
      $p.val("roach");
    });
  });
});
