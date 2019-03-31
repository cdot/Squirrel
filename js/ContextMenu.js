/*@preserve Copyright (C) 2015-2019 Crawford Currie http://c-dot.co.uk license MIT*/
/* eslint-env browser,jquery */

define("js/ContextMenu", ["js/Translator", "clipboard", "js/Dialog", "jquery", "jquery-ui", "contextmenu" ], function(Translator, ClipboardJS, Dialog) {

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
                    let n = self.app.client.hoard.get_node(p);
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

            if (!$node) {
                if (self.debug) self.debug("No node for contextmenu>" + ui.cmd);
                return;
            }

            switch (ui.cmd) {
            case "copy_value":
                self.clipboard = $node.data("value");
                break;

            case "make_copy":
                self.clipboard = JSON.stringify(
                    // SMELL
                    self.app.client.hoard.get_node($node.tree("getPath")));
                break;

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
                if (self.clipboard) {
                    let data = JSON.parse(self.clipboard);
                    Dialog.confirm("insert", {
                        $node: $node,
                        data: data
                    });
                }
                break;

            case "rename":
                $node.tree("editKey");
                break;

            case "edit":
                $node.tree("editValue");
                break;

            case "add_value":
                Dialog.confirm("add", { $node: $node, is_value: true })
                .then((dlg) => {
                    self.app.add_child_node(
                        $node,
                        dlg.control("key").val(),
                        dlg.control("value").val());
                });
                break;

            case "add_subtree":
                Dialog.confirm("add", { $node: $node, is_value: false })
                .then((dlg) => {
                    self.app.add_child_node($node, dlg.control("key").val());
                });
                break;

            case "randomise":
                Dialog.confirm("randomise", { $node: $node });
                break;

            case "add_alarm":
                Dialog.confirm("alarm", { $node: $node });
                break;

            case "delete":
                Dialog.confirm("delete", { $node: $node });
                break;

            case "pick_from":
                Dialog.confirm("pick", { $node: $node });
                break;

            default:
                throw new Error("ERROR: unrecognised command " + ui.cmd);
            }
        }
    }
    return ContextMenu;
});