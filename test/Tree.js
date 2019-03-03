/*@preserve Copyright (C) 2015-2019 Crawford Currie http://c-dot.co.uk license MIT*/

if (typeof module !== "undefined") {
    requirejs = require('requirejs');
    // node.js
    chai = require("chai");
    const { JSDOM } = require('jsdom');
    document = new JSDOM('<!doctype html><html><body><div id="container"><div id="sites-node"></div></div></body></html>');
    const { window } = document;
    global.window = window;
    global.document = window.document;
    global.jQuery = require('jquery')(window);
    global.navigator = { userAgent: "node.js" };

    // This all works fine in the browser, but not in node.js. So the fix
    // - whetever it is - belongs here :-(
    requirejs.config({
        baseUrl: "..",
        paths: {
            js: "src",
            jsjq: "src/jquery",
            test: "test",
            jquery: "libs/test/jquery-3.3.1",
            "jquery-ui": "libs/test/jquery-ui"
        }
    });
}

const actions = [
    {
	type: "N",
	time: new Date("1 Jan 2000").getTime(),
	path: ["Fine-dining"]
    },
    {
	type: "N",
	time: new Date("1 Jan 2001").getTime(),
	path: [ "Fine-dining", "Caviare" ]
    },
    {
	type: "N",
	time: new Date("1 Jan 2002").getTime(),
	path: [ "Fine-dining", "Caviare", "Beluga" ],
        data: "£6.70 per gram"
    },
    {
        type: "A",
	path: [ "Fine-dining", "Caviare", "Beluga" ],
	time: new Date("1 Jan 2003").getTime(),
        data: new Date("1 Jan 2004").getTime(),
    },
    {
        type: "R",
	path: [ "Fine-dining", "Caviare" ],
	time: new Date("1 Jan 2005").getTime(),
        data: "Caviar"
    },
    {
        type: "E",
	path: [ "Fine-dining", "Caviar", "Beluga" ],
	time: new Date("1 Jan 2006").getTime(),
        data: "£6.70 per gramme"
    },
    {
        type: "X",
	path: [ "Fine-dining", "Caviar", "Beluga" ],
	time: new Date("1 Jan 2007").getTime(),
        data: "If you have to ask, you can't afford it"
    }
];

var undos = [
    "D:Fine-dining @01/01/2000, 00:00:00",
    "D:Fine-dining/Caviare @01/01/2001, 00:00:00",
    "D:Fine-dining/Caviare/Beluga @01/01/2002, 00:00:00",
    "C:Fine-dining/Caviare/Beluga @01/01/2003, 00:00:00",
    "R:Fine-dining/Caviar @01/01/2005, 00:00:00 Caviare",
    "E:Fine-dining/Caviar/Beluga @01/01/2006, 00:00:00 £6.70 per gram",
    "X:Fine-dining/Caviar/Beluga @01/01/2007, 00:00:00"
];

function normalise_html(html) {
    return html
        .replace(/>\s*/gs,">")
        .replace(/\s*</gs,"<")
        .replace(/^\s*/s, "")
        .replace(/\s*$/s, "")
        .replace(/></g, ">\n<");
}

function expect_html(expected_html) {
    let actual = normalise_html($("#container").html());
    let expected = normalise_html(expected_html)
    assert.equal(actual, expected);
}

assert = chai.assert;

it('Tree', function(done) {
    let $DOMtree, DOMtree, TX;

    let deps = ["js/Utils",
                "js/Hoard",
                "js/Translator",
                "js/Tree"];
        
    requirejs(deps, function(Utils, Hoard, Translator, Tree) {

        TX = Translator.instance();

        describe("Tests", function() {
            beforeEach(function() {
                $DOMtree = $("#sites-node");
                $DOMtree.tree({});
            });

            afterEach(function() {
                $("#sites-node").tree("destroy");
                $("#sites-node").find("ul").remove();
                Tree.cache = {};
            });

            it("should play_actions into empty hoard", function() {
                // Reconstruct a cache from an actions list in an empty hoard
                var undi = 0;
                for (let i in actions) {
                    let e = actions[i];

                    $DOMtree.tree("action", e, function undo(action, path, time, data) {
                        assert.equal(action+":"+path.join('/')+" @"  + new Date(time)
                                     .toLocaleString() + (typeof data !== "undefined" ? " "+data:""), undos[undi++]);
                    });
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
                expect_html(empty_tree);
            });
            
            it("should open undecorated", function() {
                for (let i in actions) {
                    $DOMtree.tree("action", actions[i]);
                }
                // open a leaf node
                let $node = $DOMtree.tree("getNodeFromPath", ["Fine-dining", "Caviar", "Beluga"]);
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
            
            it("should open decorated", function() {
                for (let i in actions) {
                    $DOMtree.tree("action", actions[i]);
                }
                // open a leaf node
                let $node = $DOMtree.tree("getNodeFromPath", ["Fine-dining", "Caviar", "Beluga"]);
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
            
            it("should close decorated", function() {
                for (let i in actions) {
                    $DOMtree.tree("action", actions[i]);
                }
                // open a leaf node
                let $node = $DOMtree.tree("getNodeFromPath", ["Fine-dining", "Caviar", "Beluga"]);
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
        done();
    });
});

        
