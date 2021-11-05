/*@preserve Copyright (C) 2015-2019 Crawford Currie http://c-dot.co.uk license MIT*/
/* eslint-env browser,jquery */

define("js/ContextMenu", ["js/Translator", "js/Dialog", "js/Action", "js/Serror", "clipboard", "jquery", "jquery-ui", "contextmenu" ], function(Translator, Dialog, Action, Serror, ClipboardJS) {

    let TX = Translator.instance();

	/**
	 * Squirrel context menu for nodes
	 */
    class ContextMenu {

        constructor(app) {
            let self = this;
            
            this.debug = app.debug;

            // Node that is the target of a context menu operation
            this.$menuTarget;

            this.clipboard = null;
            this.clipboardContents = null;

            // For unknown reasons, we get a taphold event on mobile devices
            // even when a taphold hasn't happened. So we have to selectively
            // disable the context menu :-(
            this.contextMenuDisables = 0;

            this.app = app;

            let menu = {
                delegate: ".tree_title",
                menu: [
                    {
                        title: TX.tx("Pick characters"),
                        cmd: "pick_from",
                        uiIcon: "squirrel-icon-pick squirrel-icon"
                    },
                    {
                        title: TX.tx("Rename"),
                        cmd: "rename",
                        uiIcon: "squirrel-icon-edit squirrel-icon"
                    },
                    {
                        title: TX.tx("Edit value"),
                        cmd: "edit",
                        uiIcon: "squirrel-icon-edit squirrel-icon"
                    },
                    {
                        title: TX.tx("Set/Change Reminder"),
                        cmd: "add_alarm",
                        uiIcon: "squirrel-icon-alarm squirrel-icon"
                    },
                    {
                        title: TX.tx("Generate new random value"),
                        cmd: "randomise",
                        uiIcon: "squirrel-icon-key squirrel-icon"
                    },
                    {
                        title: TX.tx("Add new value"),
                        cmd: "add_value",
                        uiIcon: "squirrel-icon-add-value squirrel-icon"
                    },
                    {
                        title: TX.tx("Add new folder"),
                        cmd: "add_subtree",
                        uiIcon: "squirrel-icon-add-folder squirrel-icon"
                    },
                    {
                        title: TX.tx("Copy"),
                        cmd: "copy",
                        uiIcon: "squirrel-icon-copy squirrel-icon"
                    },
                    {
                        title: TX.tx("Paste"),
                        cmd: "paste",
                        uiIcon: "squirrel-icon-paste squirrel-icon"
                    },
                    {
                        title: TX.tx("Delete"),
                        cmd: "delete",
                        uiIcon: "squirrel-icon-delete squirrel-icon"
                    }
                ],
                preventContextMenuForPopup: true,
                preventSelect: true,
                //taphold: true,
                beforeOpen: function (e, ui) { self._before_menu_open(ui); },
                select: function (e, ui) { self._handle_menu_choice(ui); }
            };

            $("body")
            .contextmenu(menu);

            // The clipboard works by setting the text of the clipboard
            // action based on the content of the node. This both sets
            // the system clipboard to this text. We then remember what
            // was copied in the clipboardContents. Of course this means
            // we can't paste the system clipboard as it was before the
            // app started.
            let clipboard =
            new ClipboardJS(".ui-contextmenu li[data-command='copy']", {
                text: function () {
                    let p = self.$menuTarget.tree("getPath");
                    if (self.debug) self.debug("copy tree from", p);
                    let n = self.app.hoarder.hoard.get_node(p);
                    if (typeof n.data === "object")
                        return JSON.stringify(n);
                    else
                        return n.data;
                }
            });

            /* Try to get existing clipboard per the Mozilla API
               - doesn't work on either Chrome or Firefox
            navigator.permissions.query({name:'clipboard-read'})
            .then(function(result) {
                if (result.state == 'granted') {
                    navigator.clipboard.readText().then(
                        clipText => self.clipboardContents = clipText);
                }
            });*/

            // Initialise the clipboard to get "paste" enabled, in case
            // we are copy-pasting external content
            this.clipboardContents = '{"data":"' + TX.tx("Add new value")
            + '"}';
            clipboard.on("success", function(e) {
                self.clipboardContents = e.text;
            });
        }

        /**
         * Check if the clipboard contains useable data
         * @return boolean
		 * @private
         */
        _clipboardReady() {
            if (typeof this.clipboardContents !== "string")
                return false;
            try {
                JSON.parse(this.clipboardContents);
                return true;
            } catch(e) {
                if (this.debug) this.debug("Clipboard", e);
                return false;
            }
        }
        

        /**
         * Handle context menu enable/disable
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

            let $node = (ui.target.is(".tree")) ?
                ui.target :
                ui.target.closest(".tree");

            //let has_alarm = typeof $node.data("alarm") !== "undefined";
            let is_leaf = $node.hasClass("tree-isLeaf");
            let is_root = ui.target.closest(".tree")
                .hasClass("tree-isRoot");
            let is_open = $node.hasClass("tree-isOpen");

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
            .contextmenu("showEntry", "rename", !is_root);

            $("body").contextmenu("setTitle", "copy",
                                  is_leaf ? TX.tx("Copy Value")
                                  : TX.tx("Copy Folder"));

            this.$menuTarget = $node;
        }

        /**
         * Handler for context menu items
         * @private
         */
        _handle_menu_choice(ui) {
            let self = this;
            let $node = self.$menuTarget;

            function validate_unique_key(val) {
                let ok = true;
                let $ul = $node.find("ul").first();
                $ul.children(".tree")
                .each(function () {
                    if (val === $(this).data("key")) {
                        // Key not unique
                        ok = false;
                        return false; // stop iterator
                    }
					return true;
                });
                return ok;
            }
            
            if (!$node) {
                if (self.debug) self.debug("No node for contextmenu>", ui.cmd);
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
                
                return Dialog.confirm("insert", {
                    path: $node.tree("getPath"),
                    validate: validate_unique_key,
                    value: self.clipboardContents,
                    is_value: true
                })
                .then((kv) => {
                    self.clipboardContents = kv.value;
                    return self.app.playAction(new Action({
                        type: "I",
                        path: $node.tree("getPath").concat(kv.key),
                        data: kv.value
                    }), true);
                });
                //break;

            case "rename":
                promise = $node.tree("editKey")
                .then((a) => {
                    return self.app.playAction(a);
                });
                break;

            case "edit":
                promise = $node.tree("editValue")
                .then((a) => {
                    return self.app.playAction(a);
                });
                break;

            case "add_value":
                promise = Dialog.confirm("add", {
                    path: $node.tree("getPath"),
                    validate: validate_unique_key,
                    is_value: true
                })
                .then((res) => {
                    return self.app.playAction(new Action({
                        type: "N",
                        path: $node.tree("getPath").concat(res.key),
                        data: res.value
                    }), true);
                });
                break;

            case "add_subtree":
                promise = Dialog.confirm("add", {
                    path: $node.tree("getPath"),
                    validate: validate_unique_key,
                    is_value: false
                })
                .then((res) => {
                    return self.app.playAction(new Action({
                        type: "N",
                        path: $node.tree("getPath").concat(res.key)
                    }), true);
                });
                break;

            case "randomise":
                promise = Dialog.confirm("randomise", {
                    key: $node.data("key"),
                    constraints: $node.data("constraints")
                })
                .then((result) => {
                    let prom = self.app.playAction(new Action({
                        type: "E",
                        path: $node.tree("getPath"),
                        data: result.text
                    }));
                    if (typeof result.constraints !== "undefined")
                        prom = prom.then(() => {
                            return self.app.playAction(new Action({
                                type: "X",
                                path: $node.tree("getPath"),
                                data: result.constraints
                            }));
                        });
                    return prom;
                });
                break;

            case "add_alarm":
                promise = Dialog.confirm("alarm", {
                    path: $node.tree("getPath"),
                    alarm: $node.data("alarm"),
                    last_change: $node.data("last-time-changed")
                })
                .then((act) => {
                    act.path = $node.tree("getPath").slice();
                    return self.app.playAction(act);
                });
                break;

            case "delete":
                promise = Dialog.confirm("delete", {
                    path: $node.tree("getPath"),
                    is_leaf: $node.hasClass("tree-isLeaf")
                })
                .then(() => {
                    return self.app.playAction(new Action({
                        type: "D",
                        path: $node.tree("getPath")
                    }));
                });
                break;

            case "pick_from":
                promise = Dialog.confirm(
                    "pick", { pick_from: $node.data("value") || "" });
                break;

            default:
                Serror.assert("Unrecognised command", ui.cmd);
                return Promise.reject();
            }
            
            this.toggle(false);
            if (self.debug)
                promise = promise.catch((fail) => {
                    if (fail) self.debug("Dialog catch", fail);
                });
            
            return promise
            .finally(() => {
                this.toggle(true);
            });
        }
    }
    return ContextMenu;
});
