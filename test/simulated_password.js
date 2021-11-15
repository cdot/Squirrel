/*@preserve Copyright (C) 2019 Crawford Currie http://c-dot.co.uk license MIT*/
/*eslint-env node, mocha */
/* global document:writable*/
/*global window */

/**
 * TestRunner for js/jq/simulated_password.js only.
 * Note this may not run correctly under node.js, due to the lack of event
 * handlers in jsdom. The gold standard is that it runs in a browser.
 */
if (typeof module !== "undefined") {
    requirejs = require('requirejs');
   // node.js
    const { JSDOM } = require('jsdom');
	/*eslint-disable no-global-assign*/
    document = new JSDOM('<!doctype html><html><body id="working"></body></html>');
	/*eslint-enable no-global-assign*/
    const { window } = document;
    global.window = window;
    global.document = window.document;
    global.navigator = { userAgent: "node.js" };
    const jQuery = require('jquery');
    global.jQuery = jQuery;
    global.$ = jQuery;
}

requirejs.config({
    baseUrl: ".."
});

requirejs(["test/TestRunner", "jquery", "js/jq/simulated_password"], function(TestRunner) {

    const tr = new TestRunner("simulated_password");
    const assert = tr.assert;

    tr.afterEach(function() {
        $("#working").empty();
    });

    tr.addTest('basic', function() {
        const $html = $('<input type="password">');
        $("#working").append($html);
        $html.simulated_password();
        const html = $("#working").html();
        assert.equal(html, '<input type="text" class="pass_hidden"><input type="checkbox">');
    });

    tr.addTest('not hidden, no checkbox', function() {
        $("#working").html('<input class="password" id="tt" value="initial">');
        $(".password").simulated_password({hidden: false, checkbox:false});
        const html = $("#working").html();
        assert.equal(html, '<input class="password" id="tt" value="initial">');
    });

    tr.addTest('options in data', function() {
        $("#working").html('<input class="password" id="tt" value="initial" data-options=\'{"hidden":false,"checkbox":false}\'>');
        $(".password").simulated_password();
        const html = $("#working").html();
        assert.equal(html, '<input class="password" id="tt" value="initial" data-options="{&quot;hidden&quot;:false,&quot;checkbox&quot;:false}">');
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

    tr.addTest('typing', function() {
        $("#working").html('<input class="password" id="tt" value="bass">');
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

    tr.addTest('typing', function() {
        $("#working").html('<input class="password" id="tt" value="bass">');
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

    tr.addTest('set val', function() {
        $("#working").html('<input class="password" id="tt" value="bass">');
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

    $(() => tr.run());
});
