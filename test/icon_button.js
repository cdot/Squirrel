/*@preserve Copyright (C) 2019 Crawford Currie http://c-dot.co.uk license MIT*/
/*eslint-env node, mocha */

/**
 * Note this may not run correctly under node.js, due to the lack of event
 * handlers in jsdom. The gold standard is that it runs in a browser.
 */
if (typeof module !== "undefined") {
    requirejs = require('requirejs');
   // node.js
    const { JSDOM } = require('jsdom');
    document = new JSDOM('<!doctype html><html><body id="working"></body></html>');
    const { window } = document;
    global.window = window;
    global.document = window.document;
    global.navigator = { userAgent: "node.js" };
    let jQuery = require('jquery');
    global.jQuery = jQuery;
    global.$ = jQuery;

    requirejs.config({
        baseUrl: "..",
        paths: {
            "jquery-ui": "test/libs/jquery-ui",
        }
    });
}

requirejs(["test/TestRunner", "jquery", "js/jq/icon_button"], function(TestRunner) {

    let tr = new TestRunner("icon_button");
    let assert = tr.assert;

    tr.afterEach(function() {
        $("#working").empty();
    });

    tr.addTest('basic', function() {
        let $butt = $('<button data-icon="ui-icon-info">Info</button>');
        $("#working").append($butt);
        $butt.icon_button();
        let html = $("#working").html();
        assert.equal(html, '<button data-icon="ui-icon-info" class="ui-button ui-corner-all ui-widget ui-button-icon-only" title="Info"><span class="ui-button-icon ui-icon ui-icon-info"></span><span class="ui-button-icon-space"> </span>Info</button>');
    });

    tr.addTest('application', function() {
        let $butt = $('<button data-icon="app">App</button>');
        $("#working").append($butt);
        $butt.icon_button();
        let html = $("#working").html();
        assert.equal(html, '<button data-icon="app" class="ui-button ui-widget ui-button-icon-only" title="App"><span class="ui-button-icon squirrel-icon ui-icon app"></span><span class="ui-button-icon-space"> </span>App</button>');
    });

    $(() => {
        tr.run();
    });
});
