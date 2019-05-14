/*@preserve Copyright (C) 2015-2019 Crawford Currie http://c-dot.co.uk license MIT*/

if (typeof module !== "undefined") {
    requirejs = require('requirejs');
    // node.js
    const { JSDOM } = require('jsdom');
    document = new JSDOM('<!doctype html><html><body><div id="container"><div id="sites-node"></div></div></body></html>');
    const { window } = document;
    global.window = window;
    global.document = window.document;
    global.navigator = { userAgent: "node.js" };
    let jQuery = require('jquery');
    global.jQuery = jQuery;
    global.$ = jQuery;
}

// This all works fine in the browser, but not in node.js. So the fix
// - whetever it is - belongs here :-(
requirejs.config({
    baseUrl: "..",
    paths: {
        "jquery-ui": "test/libs/jquery-ui"
    }
});

const actions = [
    {
	type: "N",
	time: Date.UTC(2000, 0),
	path: ["FineDining"]
    },
    {
	type: "N",
	time: Date.UTC(2001, 0),
	path: [ "FineDining", "Caviare" ]
    },
    {
	type: "N",
	time: Date.UTC(2002, 0),
	path: [ "FineDining", "Caviare", "Beluga" ],
        data: "£6.70 per gram"
    },
    {
        type: "A",
	path: [ "FineDining", "Caviare", "Beluga" ],
	time: Date.UTC(2003, 0),
        data: Date.UTC(2004, 0),
    },
    {
        type: "R",
	path: [ "FineDining", "Caviare" ],
	time: Date.UTC(2005, 0),
        data: "Caviar"
    },
    {
        type: "E",
	path: [ "FineDining", "Caviar", "Beluga" ],
	time: Date.UTC(2006, 0),
        data: "£6.70 per gramme"
    },
    {
        type: "X",
	path: [ "FineDining", "Caviar", "Beluga" ],
	time: Date.UTC(2007,0),
        data: { size: 10, chars: "If you have to ask, you can't afford it" }
    }
];

var undos = [
    "D:FineDining @1/1/2000, 12:00:00 AM",
    "D:FineDining/Caviare @1/1/2001, 12:00:00 AM",
    "D:FineDining/Caviare/Beluga @1/1/2002, 12:00:00 AM",
    "C:FineDining/Caviare/Beluga @1/1/2003, 12:00:00 AM",
    "R:FineDining/Caviar @1/1/2005, 12:00:00 AM Caviare",
    "E:FineDining/Caviar/Beluga @1/1/2006, 12:00:00 AM £6.70 per gram",
    "X:FineDining/Caviar/Beluga @1/1/2007, 12:00:00 AM"
];

let deps = ["js/Utils",
            "js/Hoard",
            "js/Serror",
            "js/Translator",
            "js/Tree",
            "test/TestRunner",
            "jquery",
            "jquery-ui"
           ];
requirejs(deps, function(Utils, Hoard, Serror, Translator, Tree, TestRunner) {

    let tr = new TestRunner("Tree");
    let assert = tr.assert;
    let $DOMtree = $("#sites-node");

    function normalise_html(html) {
        return html
            .replace(/\n/g, " ")
            .replace(/ +</g,"<")
            .replace(/> +/g,">")
            .replace(/ +/g," ")
            .replace(/^ /, "")
            .replace(/ $/, "");
    }

    function expect_html(expected_html) {
        let actual = normalise_html($("#container").html());
        let expected = normalise_html(expected_html)
        assert.equal(actual, expected);
    }

    tr.beforeEach(function() {
        $DOMtree.tree({});
    });
    tr.afterEach(function() {
        $DOMtree.tree("destroy");
        $DOMtree.find("ul").remove();
        Tree.cache = {};
    });

    tr.addTest("should reconstruct cache", function() {
        let promise = Promise.resolve();
        for (let act of actions) {
            promise = promise.then($DOMtree.tree("action", act));
        }
        const empty_tree = '\
            <div id="sites-node" class="tree-node tree-never-opened tree-root tree-collection tree-has-alarms">\
              <ul class="sortable tree-subnodes" style="display: none;">\
                <li class="tree-node tree-never-opened tree-collection tree-modified tree-has-alarms">\
                  <ul class="sortable tree-subnodes" style="display: none;">\
                    <li class="tree-node tree-never-opened tree-collection tree-modified tree-has-alarms">\
                      <ul class="sortable tree-subnodes" style="display: none;">\
                        <li class="tree-node tree-never-opened tree-leaf tree-modified">\
                        </li>\
                      </ul>\
                    </li>\
                  </ul>\
                </li>\
              </ul>\
            </div>';
        promise.then(() => {
            expect_html(empty_tree);
        });
    });

    tr.addTest("should open undecorated", function() {
        let promise = Promise.resolve();
        for (let act of actions) {
            promise = promise.then($DOMtree.tree("action", act));
        }
        promise.then(() => {
            // open a leaf node
            let $node = $DOMtree.tree("getNodeFromPath", ["FineDining", "Caviar", "Beluga"]);
            $node.tree("open");
            const open_tree = '\
            <div id="sites-node" class="tree-node tree-never-opened tree-root tree-collection tree-has-alarms">\
                <ul class="sortable tree-subnodes" style="display: none;">\
                  <li class="tree-node tree-never-opened tree-collection tree-modified tree-has-alarms">\
                    <ul class="sortable tree-subnodes" style="display: none;">\
                      <li class="tree-node tree-never-opened tree-collection tree-modified tree-has-alarms">\
                        <ul class="sortable tree-subnodes" style="display: none;">\
                          <li class="tree-node tree-leaf tree-modified tree-node-is-open">\
                          </li>\
                        </ul>\
                      </li>\
                    </ul>\
                  </li>\
                </ul>\
              </div>';
            expect_html(open_tree);
        });
    });

    tr.addTest("should open decorated", function() {
        let promise = Promise.resolve();
        for (let act of actions) {
            promise = promise.then($DOMtree.tree("action", act));
        }
        promise.then(() => {
            // open a leaf node
            let $node = $DOMtree.tree("getNodeFromPath", ["FineDining", "Caviar", "Beluga"]);
            $node.tree("open", {decorate:true});
            const open_tree = '\
            <div id="sites-node" class="tree-node tree-never-opened tree-root tree-collection tree-has-alarms">\
              <ul class="sortable tree-subnodes" style="display: none;">\
                <li class="tree-node tree-never-opened tree-collection tree-modified tree-has-alarms">\
                  <ul class="sortable tree-subnodes" style="display: none;">\
                    <li class="tree-node tree-never-opened tree-collection tree-modified tree-has-alarms">\
                      <ul class="sortable tree-subnodes" style="display: none;">\
                        <li class="tree-node tree-leaf tree-modified ui-draggable tree-node-is-open" style="position: relative;">\
                          <div class="tree-title">\
                            <div class="tree-info">\
                              <button class="tree-alarm ui-button ui-widget ui-button-icon-only">\
                                <span class="ui-button-icon squirrel-icon ui-icon tree-icon-alarm">\
                                </span>\
                                <span class="ui-button-icon-space">\
                                </span>\
                              </button>\
                              <span class="tree-key">Beluga\
                              </span>\
                              <span class="tree-separator"> :\
                              </span>\
                              <span class="tree-value">£6.70 per gramme\
                              </span>\
                              <span class="tree-change">2007-01-01</span>\
                            </div>\
                            <div class="tree-draghandle ui-button ui-corner-all ui-widget ui-button-icon-only ui-draggable-handle" role="button" style="display: none;">\
                              <span class="ui-button-icon ui-icon ui-icon-arrow-2-n-s">\
                              </span>\
                              <span class="ui-button-icon-space">\
                              </span>\
                            </div>\
                          </div>\
                        </li>\
                      </ul>\
                    </li>\
                  </ul>\
                </li>\
              </ul>\
            </div>';
            expect_html(open_tree);
        });
    });

    tr.addTest("should close decorated", function() {
        let promise = Promise.resolve();
        for (let act of actions) {
            promise = promise.then($DOMtree.tree("action", act));
        }
        promise.then(() => {
            // open a leaf node
            let $node = $DOMtree.tree("getNodeFromPath", ["FineDining", "Caviar", "Beluga"]);
            $node.tree("open", {decorate:true});
            $node.tree("close");
            const open_tree = '\
            <div id="sites-node" class="tree-node tree-never-opened tree-root tree-collection tree-has-alarms">\
              <ul class="sortable tree-subnodes" style="display: none;">\
                <li class="tree-node tree-never-opened tree-collection tree-modified tree-has-alarms">\
                  <ul class="sortable tree-subnodes" style="display: none;">\
                    <li class="tree-node tree-never-opened tree-collection tree-modified tree-has-alarms">\
                      <ul class="sortable tree-subnodes" style="display: none;">\
                        <li class="tree-node tree-leaf tree-modified ui-draggable" style="position: relative;">\
                          <div class="tree-title">\
                            <div class="tree-info">\
                              <button class="tree-alarm ui-button ui-widget ui-button-icon-only">\
                                <span class="ui-button-icon squirrel-icon ui-icon tree-icon-alarm">\
                                </span>\
                                <span class="ui-button-icon-space">\
                                </span>\
                              </button>\
                              <span class="tree-key">Beluga\
                              </span>\
                              <span class="tree-separator"> :\
                              </span>\
                              <span class="tree-value">£6.70 per gramme\
                              </span>\
                              <span class="tree-change">2007-01-01</span>\
                            </div>\
                            <div class="tree-draghandle ui-button ui-corner-all ui-widget ui-button-icon-only ui-draggable-handle" role="button" style="display: none;">\
                              <span class="ui-button-icon ui-icon ui-icon-arrow-2-n-s">\
                              </span>\
                              <span class="ui-button-icon-space">\
                              </span>\
                            </div>\
                          </div>\
                        </li>\
                      </ul>\
                    </li>\
                  </ul>\
                </li>\
              </ul>\
            </div>';
            expect_html(open_tree);
        });
    });

    tr.run();
});


