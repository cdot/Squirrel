/*@preserve Copyright (C) 2015-2019 Crawford Currie http://c-dot.co.uk license MIT*/
/* eslint-env node, mocha */
/* global document:writable */

import { assert } from "chai";
import { Utils } from "../src/Utils.js";
import { Hoard } from "../src/Hoard.js";
import { Serror } from "../src/Serror.js";
import { jsdom } from "./jsdom.js";

describe("Tree", () => {

  let $DOMtree, $actual, $expect, Tree;
  before(
    () => jsdom()
    .then(() => import("jquery-ui/dist/jquery-ui.js"))
    .then(() => import("../src/Tree.js"))
    .then(mod => {
      Tree = mod.Tree;
      $actual = $("#actual");
      $expect = $("#expect");
      if ($actual.length == 0) {
        // node.js
        $actual = $("<div id='actual'></div>");
        $("body").append($actual);
      }
      if ($expect.length === 0) {
        $expect = $("<div id='expect'></div>");
        $("body").append($expect);
      }
      $DOMtree = $("<div id='DOMtree'></div>");
      $actual.append($DOMtree);
    }));

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

  /*var undos = [
    "D:FineDining @1/1/2000, 12:00:00 AM",
    "D:FineDining/Caviare @1/1/2001, 12:00:00 AM",
    "D:FineDining/Caviare/Beluga @1/1/2002, 12:00:00 AM",
    "C:FineDining/Caviare/Beluga @1/1/2003, 12:00:00 AM",
    "R:FineDining/Caviar @1/1/2005, 12:00:00 AM Caviare",
    "E:FineDining/Caviar/Beluga @1/1/2006, 12:00:00 AM £6.70 per gram",
    "X:FineDining/Caviar/Beluga @1/1/2007, 12:00:00 AM"
    ];*/

  beforeEach(function() {
    $DOMtree.tree({});
  });

  afterEach(function() {
    $DOMtree.tree("destroy");
    $DOMtree.empty();
    Tree.cache = {};
  });

  function expect_html(html) {
    $expect.empty().append(html.replace(/>\s+</g, "><"));
    assert($actual.find("div")[0].isEqualNode($expect.find("div")[0]),
           `\nExpect: ${$expect.html()}\n\nActual: ${$actual.html()}`);
  }

  it("should reconstruct cache", function() {
    let promise = Promise.resolve();
    for (let act of actions) {
      promise = promise.then($DOMtree.tree("action", act));
    }
    $expect.html(
      `<div id="DOMtree" class="tree tree-never_opened tree-isRoot tree-hasAlarms">
       <ul class="tree_subtree sortable" style="display: none;">
        <li class="tree tree-never_opened tree-isModified tree-hasAlarms" accesskey="FineDining">
         <ul class="tree_subtree sortable" style="display: none;">
          <li class="tree tree-never_opened tree-isModified tree-hasAlarms" accesskey="Caviar">
           <ul class="tree_subtree sortable" style="display: none;">
            <li class="tree tree-never_opened tree-isLeaf tree-isModified" accesskey="Beluga">
             <ul class="tree_subtree sortable" style="display: none;"></ul>
            </li>
           </ul>
          </li>
         </ul>
        </li>
       </ul>
      </div>`.replace(/>\s+</g, "><"));
    return promise.then(() => {
      assert($actual.find("div")[0].isEqualNode($expect.find("div")[0]),
             `\nExpect: ${$expect.html()}\n\nActual: ${$actual.html()}`);
    });
  });

  it("should open undecorated", function() {
    let promise = Promise.resolve();
    for (let act of actions) {
      //console.log("Play",act);
      promise = promise.then($DOMtree.tree("action", act));
      $DOMtree.tree("getNodeFromPath", ["FineDining"]);
    }
    return promise.then(() => {
      // open a leaf node
      let $node = $DOMtree.tree("getNodeFromPath", ["FineDining", "Caviar", "Beluga"]);
      $node.tree("open");
      $expect.html(
        `<div id="DOMtree" class="tree-never_opened tree tree-isRoot tree-hasAlarms">
                <ul class="tree_subtree sortable" style="display: none;">
                  <li class="tree tree-never_opened tree-isModified tree-hasAlarms" accesskey="FineDining">
                    <ul class="tree_subtree sortable" style="display: none;">
                      <li class="tree tree-never_opened tree-isModified tree-hasAlarms" accesskey="Caviar">
                        <ul class="tree_subtree sortable" style="display: none;">
                          <li class="tree tree-isLeaf tree-isModified tree-isOpen" accesskey="Beluga">
                           <ul class="tree_subtree sortable" style=""></ul>
                          </li>
                        </ul>
                      </li>
                    </ul>
                  </li>
                </ul>
              </div>`.replace(/>\s+</g, "><"));
      assert($actual.find("div")[0].isEqualNode($expect.find("div")[0]),
             `\nExpect: ${$expect.html()}\n\nActual: ${$actual.html()}`);
    });
  });

  it("should open decorated", function() {
    let promise = Promise.resolve();
    for (let act of actions) {
      promise = promise.then($DOMtree.tree("action", act));
    }
    return promise.then(() => {
      // open a leaf node
      let $node = $DOMtree.tree("getNodeFromPath", ["FineDining", "Caviar", "Beluga"]);
      $node.tree("open", {decorate:true});
      $expect.html(
        `<div id="DOMtree" class="tree-never_opened tree tree-isRoot tree-hasAlarms">
              <ul class="tree_subtree sortable" style="display: none;">
               <li class="tree tree-never_opened tree-isModified tree-hasAlarms" accesskey="FineDining">
                <ul class="tree_subtree sortable" style="display: none;">
                 <li class="tree tree-never_opened tree-isModified tree-hasAlarms" accesskey="Caviar">
                  <ul class="tree_subtree sortable" style="display: none;">
                   <li class="tree tree-isLeaf tree-isModified tree-decorated tree-isOpen" accesskey="Beluga">
                    <div class="tree_title">
                     <button class="tree_t_toggle ui-button ui-widget ui-button-icon-only">
                      <span class="ui-button-icon squirrel-icon ui-icon squirrel-icon-folder-open"></span>
                      <span class="ui-button-icon-space"> </span>
                     </button>
                     <div class="tree_t_info">
                      <button class="tree_t_i_alarm ui-button ui-widget ui-button-icon-only">
                       <span class="ui-button-icon squirrel-icon ui-icon tree-icon-alarm"></span>
                       <span class="ui-button-icon-space"> </span>
                      </button>
                      <span class="tree_t_i_key">Beluga</span>
                      <span class="tree_t_i_leaf">
                       <span class="tree_t_i_l_separator"> : </span>
                       <span class="tree_t_i_l_value">£6.70 per gramme</span>
                      </span>&nbsp;<span class="tree_t_i_change" style="display: none;">2007-01-01</span>
                     </div>
                    </div>
                    <ul class="tree_subtree sortable" style=""></ul>
                   </li>
                  </ul>
                 </li>
                </ul>
               </li>
              </ul>
             </div>`.replace(/>\s\s+</g, "><"));
      assert($actual.find("div")[0].isEqualNode($expect.find("div")[0]),
             `\nExpect: ${$expect.html()}\n\nActual: ${$actual.html()}`);

    });
  });

  it("should close decorated", function() {
    let promise = Promise.resolve();
    for (let act of actions) {
      promise = promise.then($DOMtree.tree("action", act));
    }
    return promise.then(() => {
      // open a leaf node
      let $node = $DOMtree.tree("getNodeFromPath", ["FineDining", "Caviar", "Beluga"]);
      $node.tree("open", {decorate:true});
      $node.tree("close");
      $expect.html(
        `<div id="DOMtree" class="tree-never_opened tree tree-isRoot tree-hasAlarms">
          <ul class="tree_subtree sortable" style="display: none;">
           <li class="tree tree-never_opened tree-isModified tree-hasAlarms" accesskey="FineDining">
            <ul class="tree_subtree sortable" style="display: none;">
             <li class="tree tree-never_opened tree-isModified tree-hasAlarms" accesskey="Caviar">
              <ul class="tree_subtree sortable" style="display: none;">
               <li class="tree tree-isLeaf tree-isModified tree-decorated" accesskey="Beluga">
                <div class="tree_title">
                 <button class="tree_t_toggle ui-button ui-widget ui-button-icon-only">
                  <span class="ui-button-icon squirrel-icon ui-icon squirrel-icon-folder-closed"></span>
                  <span class="ui-button-icon-space"> </span>
                 </button>
                 <div class="tree_t_info">
                  <button class="tree_t_i_alarm ui-button ui-widget ui-button-icon-only">
                   <span class="ui-button-icon squirrel-icon ui-icon tree-icon-alarm"></span>
                   <span class="ui-button-icon-space"> </span>
                  </button>
                  <span class="tree_t_i_key">Beluga</span>
                  <span class="tree_t_i_leaf">
                   <span class="tree_t_i_l_separator"> : </span>
                   <span class="tree_t_i_l_value">£6.70 per gramme</span>
                  </span>&nbsp;<span class="tree_t_i_change" style="display: none;">2007-01-01</span>
                 </div>
               </div>
               <ul class="tree_subtree sortable" style="display: none;"></ul>
              </li>
             </ul>
            </li>
           </ul>
          </li>
         </ul>
        </div>`.replace(/>\s\s+</g, "><"));
      assert($actual.find("div")[0].isEqualNode($expect.find("div")[0]),
             `\nExpect: ${$expect.html()}\n\nActual: ${$actual.html()}`);
    });
  });
});

export {}
