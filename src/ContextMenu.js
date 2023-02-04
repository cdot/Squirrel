/*@preserve Copyright (C) 2015-2023 Crawford Currie http://c-dot.co.uk license MIT*/
/* eslint-env browser,jquery */

import "jquery/dist/jquery.js";
import "jquery-ui-dist/jquery-ui.js";
import "ui-contextmenu/jquery.ui-contextmenu.js";
import { Clipboard } from "./clipboard/clipboard.js";

import { Dialog } from "./Dialog.js";
import { Action } from "./Action.js";
import { Serror } from "./Serror.js";

/**
 * Squirrel context menu for nodes, using jquery.ui-contentmenu
 */
class ContextMenu {

	/**
	 * @param {Squirrel} containing app object
	 */
  constructor(app) {
    this.debug = app.debug;

    // Node that is the target of a context menu operation
    this.$menuTarget = undefined;

    this.clipboard = null;
    this.clipboardContents = null;

    // For unknown reasons, we get a taphold event on mobile devices
    // even when a taphold hasn't happened. So we have to selectively
    // disable the context menu :-(
    this.contextMenuDisables = 0;

    this.app = app;

    const menu = {
      delegate: ".tree_title",
      menu: [
        {
          title: $.i18n("pick-chars"),
          cmd: "pick_from",
          uiIcon: "squirrel-icon-pick squirrel-icon"
        },
        {
          title: $.i18n("rename"),
          cmd: "rename",
          uiIcon: "squirrel-icon-edit squirrel-icon"
        },
        {
          title: $.i18n("ed-val"),
          cmd: "edit",
          uiIcon: "squirrel-icon-edit squirrel-icon"
        },
        {
          title: $.i18n("remind"),
          cmd: "add_alarm",
          uiIcon: "tree-icon-alarm squirrel-icon"
        },
        {
          title: $.i18n("randomise"),
          cmd: "randomise",
          uiIcon: "squirrel-icon-key squirrel-icon"
        },
        {
          title: $.i18n("add-val"),
          cmd: "add_value",
          uiIcon: "squirrel-icon-add-value squirrel-icon"
        },
        {
          title: $.i18n("add-fol"),
          cmd: "add_subtree",
          uiIcon: "squirrel-icon-add-folder squirrel-icon"
        },
				{
					title: $.i18n("Move to"),
					cmd: "move_to",
					uiIcon: "squirrel-icon-move-to squirrel-icon"
				},
        {
          title: $.i18n("Copy"),
          cmd: "copy",
          uiIcon: "squirrel-icon-copy squirrel-icon"
        },
        {
          title: $.i18n("paste"),
          cmd: "paste",
          uiIcon: "squirrel-icon-paste squirrel-icon"
        },
        {
          title: $.i18n("delete"),
          cmd: "delete",
          uiIcon: "squirrel-icon-delete squirrel-icon"
        }
      ],
      preventContextMenuForPopup: true,
      preventSelect: true,
      //taphold: true,
      beforeOpen: (e, ui) => this._before_menu_open(ui),
      select: (e, ui) => this._handle_menu_choice(ui)
    };

    $("body")
    .contextmenu(menu);

    // The clipboard works by setting the text of the clipboard
    // action based on the content of the node. This both sets
    // the system clipboard to this text. We then remember what
    // was copied in the clipboardContents. Of course this means
    // we can't paste the system clipboard as it was before the
    // app started.
    const clipboard =
          new Clipboard(".ui-contextmenu li[data-command='copy']", {
            text: () => {
              const p = this.$menuTarget.tree("getPath");
              if (this.debug) this.debug("copy ", p);
              const n = this.app.hoarder.hoard.get_node(p);
              if (n.isLeaf())
						    return n.value;
					    else
                return JSON.stringify(n);
            }
          });

    /* Try to get existing clipboard per the Mozilla API
       - doesn't work on either Chrome or Firefox
       navigator.permissions.query({name:'clipboard-read'})
       .then(function(result) {
       if (result.state == 'granted') {
       navigator.clipboard.readText().then(
       clipText => this.clipboardContents = clipText);
       }
       });*/

    // Initialise the clipboard to get "paste" enabled, in case
    // we are copy-pasting external content
    this.clipboardContents = `{"data":"${$.i18n("add-val")}"}`;
    clipboard.on("success", e => {
      this.clipboardContents = e.text;
    });
  }

  /**
   * Check if the clipboard contains useable data
   * @return {boolean}
	 * @private
   */
  _clipboardReady() {
    if (typeof this.clipboardContents !== 'string')
      return false;
    try {
      JSON.parse(this.clipboardContents);
      return true;
    } catch(e) {
      if (this.debug) this.debug("Clipboard", this.clipboardContents, e);
      return false;
    }
  }
  

  /**
   * Handle context menu enable/disable
   * @param {boolean} enable
   */
  toggle(enable) {
    if (enable) {
      if (this.contextMenuDisables > 0)
        this.contextMenuDisables--;
      if (this.debug) this.debug("Context menu disables",
                                 this.contextMenuDisables);
      if (this.contextMenuDisables <= 0)
        $("body").contextmenu("option", "autoTrigger", true);
    } else {
      this.contextMenuDisables++;
      if (this.debug) this.debug("Context menu disables",
                                 this.contextMenuDisables);
      $("body").contextmenu("option", "autoTrigger", false);
    }
  }

  /**
   * Handle context menu open on a node
   * @private
   */
  _before_menu_open(ui) {
    if (this.contextMenuDisables > 0)
      return;

    const $node = (ui.target.is(".tree")) ?
          ui.target :
          ui.target.closest(".tree");

    //let has_alarm = typeof $node.data("alarm") !== 'undefined';
    const is_leaf = $node.hasClass("tree-isLeaf");
    const is_root = ui.target.closest(".tree")
          .hasClass("tree-isRoot");
    const is_open = $node.hasClass("tree-isOpen");

    if (this.debug) this.debug("beforeOpen contextmenu on",
                               $node.data("key"), is_leaf);

    $("body")
    .contextmenu("showEntry", "add_alarm", !is_root)
    .contextmenu("showEntry", "add_subtree",
                 is_open && !is_leaf)
    .contextmenu("showEntry", "add_value",
                 is_open && !is_leaf && !is_root)
    .contextmenu("showEntry", "copy", true)
    .contextmenu("showEntry", "delete", !is_root)
    .contextmenu("showEntry", "edit", is_leaf)
    .contextmenu("showEntry", "paste",
                 is_open && !is_leaf && this._clipboardReady())
    .contextmenu("showEntry", "pick_from", is_leaf)
    .contextmenu("showEntry", "randomise", is_leaf)
    .contextmenu("showEntry", "rename", !is_root)
		.contextmenu("showEntry", "move_to", true);

    $("body").contextmenu("setTitle", "copy",
                          is_leaf ? $.i18n("Copy Value")
                          : $.i18n("Copy Folder"));

    this.$menuTarget = $node;
  }

  /**
   * Handler for context menu items
   * @private
   */
  _handle_menu_choice(ui) {
    const $node = this.$menuTarget;

    const validate_unique_key = val => {
      let ok = true;
      const $ul = $node.find("ul").first();
      $ul.children(".tree")
      .each((i, el) => {
        if (val === $(el).data("key")) {
          // Key not unique
          ok = false;
          return false; // stop iterator
        }
				return true;
      });
      return ok;
    };
    
    if (!$node) {
      if (this.debug) this.debug("No node for contextmenu>", ui.cmd);
      return Promise.reject();
    }

    let promise;

    // Items with no dialog simply return. Items that open a
    // dialog set a promise and break to a generic catch
    // handler after the switch.
    
    switch (ui.cmd) {

    case "copy": // NOOP - handled by clipboard
      return Promise.resolve();

    case "paste":
      
      return Dialog.confirm("InsertDialog", {
        path: $node.tree("getPath"),
        validate: validate_unique_key,
        value: this.clipboardContents,
        is_value: true
      })
      .then(kv => {
        this.clipboardContents = kv.value;
        return this.app.appPlayAction(new Action({
          type: "I",
          path: $node.tree("getPath").concat(kv.key),
          data: kv.value
        }), true);
      });
      //break;

    case "rename":
      promise = $node.tree("editKey")
      .then(a => this.app.appPlayAction(a));
      break;

    case "edit":
      promise = $node.tree("editValue")
      .then(a => this.app.appPlayAction(a));
      break;

    case "add_value":
      promise = Dialog.confirm("AddDialog", {
        path: $node.tree("getPath"),
        validate: validate_unique_key,
        is_value: true
      })
      .then(res => this.app.appPlayAction(new Action({
        type: "N",
        path: $node.tree("getPath").concat(res.key),
        data: res.value
      }), true));
      break;

    case "add_subtree":
      promise = Dialog.confirm("AddDialog", {
        path: $node.tree("getPath"),
        validate: validate_unique_key,
        is_value: false
      })
      .then(res => this.app.appPlayAction(new Action({
        type: "N",
        path: $node.tree("getPath").concat(res.key)
      }), true));
      break;

		case "move_to":
			promise = Dialog.confirm("MoveToDialog", {
        path: $node.tree("getPath"),
				getContent: path => this.app.nodeContents(path)
			})
			.then(path => this.app.appPlayAction(new Action({
        type: "M",
        path: $node.tree("getPath"),
        data: path
      }), true));
			break;

    case "randomise":
      promise = Dialog.confirm("RandomiseDialog", {
        key: $node.data("key"),
        constraints: $node.data("constraints")
      })
      .then(result => {
        let prom = this.app.appPlayAction(new Action({
          type: "E",
          path: $node.tree("getPath"),
          data: result.text
        }));
        if (typeof result.constraints !== 'undefined')
          prom = prom.then(() => {
            return this.app.appPlayAction(new Action({
              type: "X",
              path: $node.tree("getPath"),
              data: result.constraints
            }));
          });
        return prom;
      });
      break;

    case "add_alarm":
      promise = Dialog.confirm("AlarmDialog", {
        path: $node.tree("getPath"),
        alarm: $node.data("alarm"),
        last_change: $node.data("last-time-changed")
      })
      .then(act => {
        act.path = $node.tree("getPath").slice();
        return this.app.appPlayAction(act);
      });
      break;

    case "delete":
      promise = Dialog.confirm("DeleteDialog", {
        path: $node.tree("getPath"),
        is_leaf: $node.hasClass("tree-isLeaf")
      })
      .then(() => this.app.appPlayAction(new Action({
        type: "D",
        path: $node.tree("getPath")
      })));
      break;

    case "pick_from":
      promise = Dialog.confirm(
         "PickDialog", { pick_from: $node.data("value") || "" });
      break;

    default:
      Serror.assert("Unrecognised command", ui.cmd);
      return Promise.reject();
    }
    
    this.toggle(false);
    if (this.debug) {
      promise = promise.catch(fail => {
        if (fail) this.debug("Dialog catch", fail);
      });
		}
    
    return promise
    .then(() => this.toggle(true))
		.catch(() => this.toggle(true));
  }
}

export { ContextMenu }
