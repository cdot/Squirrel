/*@preserve Copyright (C) 2015-2019 Crawford Currie http://c-dot.co.uk license MIT*/
/* eslint-env browser,jquery */

define("js/ContextMenu", ["js/Translator", "js/Dialog", "js/Action", "clipboard", "jquery", "jquery-ui", "contextmenu" ], function(Translator, Dialog, Action, ClipboardJS) {

    let TX = Translator.instance();

    class ContextMenu {

        constructor(app) {
            let self = this;
            
            this.debug = app.debug;

            // Node that is the target of a context menu operation
            this.$menuTarget;

            this.clipboard = null;

            // For unknown reasons, we get a taphold event on mobile devices
            // even when a taphold hasn't happened. So we have to selectively
            // disable the context menu :-(
            this.contextMenuDisables = 0;

            this.app = app;

            let menu = {
                delegate: ".tree-title",
                menu: [
                    {
                        title: TX.tx("Copy value"),
                        cmd: "copy_value",
                        uiIcon: "squirrel-icon-copy squirrel-icon"
                    },
                    /* Can't get it to work
                       {
                       title: TX.tx("Paste"),
                       cmd: "paste",
                       uiIcon: "squirrel-icon-paste squirrel-icon"
                       },
                       /**/
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
                        title: TX.tx("Add reminder"),
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
                        title: TX.tx("Copy folder"),
                        cmd: "make_copy",
                        uiIcon: "squirrel-icon-copy squirrel-icon"
                    },
                    {
                        title: TX.tx("Insert copy of folder"),
                        cmd: "insert_copy",
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

            self.valueCopyClipboard =
            new ClipboardJS(".ui-contextmenu li[data-command='copy_value']", {
                text: function () {
                    if (this.debug) {
                        let p = self.$menuTarget.tree("getPath");
                        this.debug("clip val from", p);
                    }
                    return self.$menuTarget.data("value");
                }
            });
            
            self.treeCopyClipboard =
            new ClipboardJS(".ui-contextmenu li[data-command='make_copy']", {
                text: function () {
                    let p = self.$menuTarget.tree("getPath");
                    if (self.debug) self.debug("clip tree from", p);
                    // SMELL
                    let n = self.app.hoarder.hoard.get_node(p);
                    return JSON.stringify(n);
                }
            });
        }

        /**
         * Handle context menu enable/disable
         */
        toggle(enable) {
            if (enable) {
                if (this.contextMenuDisables > 0)
                    this.contextMenuDisables--;
                if (this.debug) this.debug("Context menu disables " +
                                           this.contextMenuDisables);
                if (this.contextMenuDisables <= 0)
                    $("body").contextmenu("option", "autoTrigger", true);
            } else {
                this.contextMenuDisables++;
                if (this.debug) this.debug("Context menu disables " +
                                           this.contextMenuDisables);
                $("body").contextmenu("option", "autoTrigger", false);
            }
        }

        /**
         * @private
         * Handle context menu open on a node
         */
        _before_menu_open(ui) {
            let self = this;
            if (self.contextMenuDisables > 0)
                return false;

            let $node = (ui.target.is(".tree-node")) ?
                ui.target :
                ui.target.closest(".tree-node");

            let has_alarm = typeof $node.data("alarm") !== "undefined";
            let is_leaf = $node.hasClass("tree-leaf");
            let is_root = ui.target.closest(".tree-node")
                .hasClass("tree-root");
            let is_open = $node.hasClass("tree-node-is-open");

            if (self.debug) self.debug("beforeOpen contextmenu on",
                                       $node.data("key"), is_leaf);

            $("body")
            .contextmenu("showEntry", "add_alarm", !has_alarm && !is_root)
            .contextmenu("showEntry", "add_subtree",
                         is_open && !is_leaf)
            .contextmenu("showEntry", "add_value",
                         is_open && !is_leaf && !is_root)
            .contextmenu("showEntry", "copy_value", is_leaf)
            .contextmenu("showEntry", "delete", !is_root)
            .contextmenu("showEntry", "edit", is_leaf)
            .contextmenu("showEntry", "insert_copy", !is_leaf && (typeof self.clipboard !== "undefined"))
            .contextmenu("showEntry", "make_copy", !is_root && !is_leaf)
            .contextmenu("showEntry", "pick_from", is_leaf)
            .contextmenu("showEntry", "randomise", is_leaf)
            .contextmenu("showEntry", "rename", !is_root);

            self.$menuTarget = $node;
        }

        /**
         * @private
         * Handler for context menu items
         */
        _handle_menu_choice(ui) {
            let self = this;
            let $node = self.$menuTarget;

            function validate_unique_key(val) {
                let ok = true;
                let $ul = $node.find("ul").first();
                $ul.children(".tree-node")
                .each(function () {
                    if (val === $(this).data("key")) {
                        // Key not unique
                        ok = false;
                        return false; // stop iterator
                    }
                });
                return ok;
            }
            
            if (!$node) {
                if (self.debug) self.debug("No node for contextmenu>" + ui.cmd);
                return;
            }

            let promise;

            // Items with no dialog simply return. Items that open a
            // dialog set a promise and break to a generic catch
            // handler after the switch.
            switch (ui.cmd) {
            case "copy_value":
                self.clipboard = $node.data("value");
                return;

            case "make_copy":
                self.clipboard = JSON.stringify(
                    // SMELL
                    self.app.hoarder.hoard.get_node($node.tree("getPath")));
                return;

                /* Can't get it to work like this - would need an intermediate
                   element that a Ctrl+V event happens on.
                   case "paste":
                   document.designMode = "on";
                   $(window).on("paste", function(e) {
	           let   systemPasteContent =
                   e.clipboardData.getData("text/plain");
                   });
                   $("#pasteboard").focus();
                   document.execCommand("Paste");
                   break;
                   /**/

            case "insert_copy":
                if (!self.clipboard)
                    return;
                
                let data = JSON.parse(self.clipboard);
                promise = Dialog.confirm("insert", {
                    $node: $node,
                    data: data
                });
                break;

            case "rename":
                $node.tree("editKey");
                return;

            case "edit":
                $node.tree("editValue");
                return;

            case "add_value":
                promise = Dialog.confirm("add", {
                    path: $node.tree("getPath"),
                    validate: validate_unique_key,
                    is_value: true
                })
                .then((res) => {
                    self.app.add_child_node($node, res.key, res.value);
                });
                break;

            case "add_subtree":
                promise = Dialog.confirm("add", {
                    path: $node.tree("getPath"),
                    validate: validate_unique_key,
                    is_value: false
                })
                .then((res) => {
                    self.app.add_child_node($node, res.key);
                });
                break;

            case "randomise":
                let nc = $node.data("constraints");
                promise = Dialog.confirm("randomise", {
                    key: $node.data("key"),
                    constraints: nc
                })
                .then((result) => {
                    self.app.playAction(new Action({
                        type: "E",
                        path: $node.tree("getPath"),
                        data: result.text
                    }));
                    if (typeof result.constraints !== "undefined")
                        self.app.playAction(new Action({
                            type: "X",
                            path: $node.tree("getPath"),
                            data: result.constraints
                        }));

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
                    self.app.playAction(act);
                });
                break;

            case "delete":
                promise = Dialog.confirm("delete", {
                    path: $node.tree("getPath"),
                    is_leaf: $node.hasClass("tree-leaf")
                })
                .then(() => {
                    self.app.playAction(new Action({
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
                Serror.assert("Unrecognised command " + ui.cmd);
                return;
            }
            
            return promise
            .then(() => {
                $(document).trigger("update_save");
            })
            .catch((fail) => {
                if (self.debug) self.debug(fail);
            });
        }
    }
    return ContextMenu;
});
