/*@preserve Copyright (C) 2015-2019 Crawford Currie http://c-dot.co.uk license MIT*/

/* global Tree: true */

/**
 * Functions involved in the management of the DOM tree that represents
 * the content of the client hoard cache.
 *
 * Each node in the client hoard cache is represented in the DOM by an
 * LI node in a UL/LI tree. A node has structure as follows:
 * classes:
 *   tree-node (always)
 *   tree-leaf - if this is a leaf node
 *   tree-collection - if this is an intermediate node
 *   tree-modified (if UI modified)
 *   tree-root - only on the root of the tree (which need not be an LI)
 * data:
 *   data-key: the key name the node is for (simple name, not a path)
 *        NOTE: the root doesn't have a data-key
 *   data-value: if this is a leaf node
 *   data-path: the full pathname of the node (string)
 *   data-alarm: if there is an alarm on the node
 * children:
 *   various buttons used to open/close nodes
 *   div.tree-info:
 *      span.tree-key: target for click events
 *          text: the key name
 *      span.tree-separator: if tree-leaf
 *      span.tree-value: if this is a leaf node, text is the leaf value,
 *          should be same as data-value
 *   ul: child tree, if this is tree-collection
 *
 * The DOM tree is built and maintained through the use of actions sent
 * to the Squirrel client hoard, which are then passed on in a callback to
 * the DOM tree. Nodes in the DOM tree are never manipulated directly outside
 * this namespace (other than to add the 'tree-modified' class)
 *
 * Nodes are managed using the squirrel.tree widget. Additional
 * services are provided through the functions of the Squirrel.Tree
 * namespace. These functions support a static cache mapping node path
 * names to DOM nodes.
 */

define(["js/Hoard", "jquery", "jsjq/edit_in_place", "jsjq/scroll_into_view", "jsjq/icon_button", "jquery-ui"], function(Hoard) {

    // separator used in Path->node mapping index
    const PATHSEP = String.fromCharCode(1);

    // Character used to hide values
    const HIDE = "※";
    
    /**
     * Static mapping paths to nodes
     */
    let path2$node = {};

    Tree = {

        // The next few methods reflect global settings that must affect
        // all Tree instances at the same time. They are intended to be
        // overridden once in the calling context.

        /**
         * Compare keys for sorting
         */
        compareKeys: (a, b) => {
            if (a == b)
                return 0;
            return (a < b) ? -1 : 1;
        },

        /**
         * A change has been made to a node. Play the relevant action.
         * Override in calling context
         * @param {Action} act
         */
        playAction: () => {},

        /**
         * An editor is about to be opened.
         * Override in calling context
         */
        onOpenEditor: () => {},

        /**
         * An editor is about to be opened.
         * Override in calling context
         */
        onCloseEditor: () => {},

        /**
         * Invoked when the mouse hovers over a node title.
         * Override in calling context
         * @returns {Boolean} true to terminate the hover-in action.
         */
        onTitleHoverIn: () => false,
        /**
         * Invoked when the mouse hover over a node title ends.
         * Override in calling context
         * @returns {Boolean} true to terminate the hover-out action.
         */
        onTitleHoverOut: () => false,

        /**
         * Are we to hide values when the tree is opened?
         * Override in calling context
         */
        hidingValues: () => false,

        /**
         * Construct a new UI element for a tree node. The created element
         * is a placeholder only until the parent is opened, at which time the
         * element is populated with controls.
         */
        _create: function() {
            let $node = this.element;

            // this.element is the object it's called on
            // This will be a div for the root, and an li for any other node
            // this.options is the options passed

            let is_leaf = false;
            let is_root = !this.options.path;
            let parent, key = "",
                $parent;

            $node.addClass("tree-node");
            // Flag that it hasn't been opened yet, so its child nodes
            // will have no controls.
            $node.addClass("tree-never-opened");

            if (is_root) {
                path2$node[""] = $node;
                $node.addClass("tree-root"); // should be there in HTML?
                $node.data("path", []);
            } else {
                parent = this.options.path.slice();
                key = parent.pop();
                $parent = this.getNodeFromPath(parent);
                $node.data("key", key);

                if (typeof this.options.value !== "undefined" &&
                    this.options.value !== null) {

                    $node
                        .data("value", this.options.value)
                        .data("is_leaf", true)
                        .addClass("tree-leaf");
                    is_leaf = true;
                }
            }

            if (!is_leaf) {
                let $ul = $("<ul></ul>")
                    .addClass("sortable tree-subnodes")
                    .hide();
                $node
                    .addClass("tree-collection")
                    .append($ul);
            }

            if ($parent)
                // Insert-sort into the $parent
                this._insertInto($parent);

            if (typeof this.options.time !== "undefined")
                this.setModified(this.options.time);

            if (this.options.onCreate)
                this.options.onCreate.call($node);
        },

        /**
         * @private
         * Get the current node value for display, obscuring as
         * required
         */
        _displayedValue: function() {
            let s = this.element.data("value");
            if (Tree.hidingValues())
                return s.replace(/./g, HIDE);
            return s;
        },

        /**
         * Change the display of values
         */
        showHideValues: function(on) {
            if (on && Tree.hidingValues() ||
                !on && !Tree.hidingValues())
                return;
            
            $(".tree-leaf")
                .each(function() {
                    let v = $(this).data("value");
                    $(this)
                        .find(".tree-value")
                        .each(
                            function () {
                                $(this).text(on ? v.replace(/./g, HIDE) : v);
                            });
                });
        },
        
        /**
         * Requires edit_in_place. selector may be a jquery selector or
         * an object.
         * @param $span child node to edit
         * ~para, text text to present in the editor
         * @param action 'R'ename or 'E'dit
         */
        _edit: function($span, text, action) {
            let $node = this.element;

            // Fit width to the container
            let w = $node.closest(".tree-root")
                .width();
            w -= $span.position()
                .left;
            $span.parents()
                .each(function () {
                    w -= $(this)
                        .position()
                        .left;
                });

            Tree.onOpenEditor();

            let nodepath = this.getPath();
            $span.edit_in_place({
                width: w,
                text: text,
                changed: function (s) {
                    Tree.playAction(Hoard.new_action({
                        type: action,
                        path: nodepath,
                        data: s
                    }));
                    return s;
                },
                closed: function () {
                    Tree.onCloseEditor();
                }
            });
        },

        editKey: function() {
            let $node = this.element;
            this._edit(
                $node.find(".tree-key")
                    .first(), $node.data("key"), "R");
        },

        editValue: function() {
            let $node = this.element;
            this._edit(
                $node.find(".tree-value")
                    .first(), $node.data("value"), "E");
        },

        /**
         * Mark the alarm on this node as having rung
         */
        ringAlarm: function() {
            this.element
                .find(".tree-alarm")
                .addClass("tree-expired")
                .find(".tree-icon-alarm")
                .removeClass("tree-icon-alarm")
                .addClass("tree-icon-rang");
        },

        _makeDraggable: function($node) {
            function handleDrag(event) {
                // Need to get from a position to a target element
                let $within = $(".tree-collection")
                    .not(".ui-draggable-dragging")
                    .filter(function () {
                        if ($(this)
                            .is($node.parent()
                                .closest(".tree-node")))
                            return false;
                        let box = $(this)
                            .offset();
                        if (event.pageX < box.left ||
                            event.pageY < box.top)
                            return false;
                        if (event.pageX >
                            box.left + $(this)
                            .outerWidth(true) ||
                            event.pageY >
                            box.top + $(this)
                            .outerHeight(true))
                            return false
                        return true;
                    });
                // inside $this
                $(".drop-target")
                    .removeClass("drop-target");
                if ($within.length > 0) {
                    $within = $within.last();
                    $within.addClass("drop-target");
                }
            }

            function handleStop() {
                let $target = $(".drop-target");
                if ($target.length > 1)
                    debugger;
                $target.each(function () {
                    let $new_parent = $(this);
                    $new_parent.removeClass("drop-target");
                    let oldpath = $node.tree("getPath");
                    let newpath = $new_parent.tree("getPath");
                    Tree.playAction(Hoard.new_action({
                        type: "M",
                        path: oldpath,
                        data: newpath
                    }));
                });
            }

            // Drag handle
            let $button = $("<div></div>")
                .addClass("tree-draghandle")
                .icon_button({
                    icon: "ui-icon-arrow-2-n-s"
                })
                .hide();
            $node
                .children(".tree-title")
                .append($button);

            // Make the node draggable by using the drag handle
            $node.draggable({
                handle: ".tree-draghandle",
                axis: "y",
                containment: ".tree-collection",
                cursor: "pointer",
                revert: true,
                revertDuration: 1,
                drag: handleDrag,
                stop: handleStop
            });
        },

        /**
         * Find the path for a DOM node or jQuery node.
         * @return an array containing the path to the node, one string per key
         */
        getPath: function() {
            let $node = this.element;
            if ($node.hasClass("tree-root"))
                return [];
            if (!$node.hasClass("tree-node"))
                throw new Error("Assertion error");

            // IMPORTANT: root node MUST NOT have data-path in HTML

            // Lookup shortcut, if set
            let ps = $node.data("path");
            if (!ps) {
                this._addToCaches();
                ps = $node.data("path");
                if (!ps)
                    ps = [];
            }
            return ps;
        },

        /**
         * Find the jQuery node for a path. Callable on any node.
         * @param path array of keys representing the path
         * @return a JQuery element
         */
        getNodeFromPath: function(path) {
            let $node = path2$node[path.join(PATHSEP)];
            if ($node && $node.length === 0)
                throw new Error("Not in the cache, was something not been through get_path?");
            return $node;
        },

        /**
         * @private
         * Insert-sort the given node as a child of the given parent node
         */
        _insertInto: function($parent) {
            if ($parent.length == 0)
                throw new Error("Assert: No parent to insert into", $parent);
            let $node = this.element;

            // First decouple from the old parent
            this._removeFromCaches();
            $node.detach();

            // Now insert in the new parent
            let key = $node.data("key");
            let inserted = false;

            let $ul = $parent.find("ul")
                .first();
            if ($ul.length === 0)
                throw new Error("Assert: No ul in parent");
            $ul.children(".tree-node")
                .each(function () {
                    if (Tree.compareKeys(
                        $(this)
                            .data("key"), key) > 0) {
                        $node.insertBefore($(this));
                        inserted = true;
                        return false;
                    }
                });
            if (!inserted) {
                $ul.append($node);
            }
            this._addToCaches();
        },

        /**
         * @param time optional time in ms, if missing will use now
         */
        setModified: function(time) {
            return this.element
                .addClass("tree-modified")
                .data("last-time-changed", time);
        },

        // Add UI components for handling any alarm that may be on
        // the node
        _decorate_with_alarm: function($node) {
            let alarm = $node.data("alarm");
            if (!alarm)
                return; // no alarm
            $node
                .find(".tree-key")
                .first()
                .before(function () {
                    let $button = $("<button></button>")
                        .addClass("tree-alarm");

                    $button.icon_button({
                        icon: "tree-icon-alarm"
                    })
                        .on("click", function () {
                            let $dlg = $("#alarm_dlg");
                            $dlg.dialog("option", "$node", $node);
                            $dlg.dialog("open");
                            return false;
                        });
                    return $button;
                });
        },

        _decorate_node: function() {
            let self = this;
            let $node = this.element;

            // Invoked on tree-title
            function hoverIn( /*evt*/ ) {
                if (Tree.onTitleHoverIn() || $("body")
                    .find("input.in_place_editor")
                    .length > 0)
                    return true;

                $(".tree-hover")
                    .removeClass("tree-hover");

                // Unobscure the value if it's hidden
                if (Tree.hidingValues() && $node.hasClass("tree-leaf")) {
                    $(this)
                        .find(".tree-value")
                        .each(
                            function () {
                                $(this).text($node.data("value"));
                            });
                }

                $(this)
                    .addClass("tree-hover")
                    .find(".tree-draghandle")
                    .first()
                    .show();

                return false;
            }

            // Invoked on tree-title
            function hoverOut( /*evt*/ ) {
                if (Tree.onTitleHoverOut() ||
                    $("body")
                    .find("input.in_place_editor")
                    .length > 0)
                    return true;

                // Re-obscure the node if required
                if (Tree.hidingValues() && $node.hasClass("tree-leaf")) {
                    $(this)
                        .find(".tree-value")
                        .each(
                            function () {
                                // Obscure the value
                                $(this).text(self._displayedValue());
                            });
                }
                $(this)
                    .removeClass("tree-hover")
                    .find(".tree-draghandle")
                    .first()
                    .hide();
            }

            // <title>
            let $title = $("<div></div>")
                .addClass("tree-title")
            // SMELL: only if screen is wide enough!
                .hover(hoverIn, hoverOut)
                .on("paste", function () {
                    debugger;
                })
                .prependTo($node);

            if (!$node.hasClass("tree-leaf")) {
                // Add open/close button on child none-leaf nodes
                let $control = $("<button></button>")
                    .addClass("tree-node-is-open-close");
                $control.appendTo($title);
                $control.icon_button({
                    icon: "squirrel-icon-folder-closed"
                })
                    .on($.getTapEvent(),
                        function () {
                            $node.tree("toggle");
                            return false;
                        });
            }

            // <info>
            let $info = $("<div></div>")
                .addClass("tree-info")
                .appendTo($title);

            // Create the key span
            $("<span></span>")
                .appendTo($info)
                .addClass("tree-key")
                .text($node.data("key"))
                .on($.isTouchCapable && $.isTouchCapable() ?
                    "doubletap" : "dblclick",
                    function (e) {
                        if (this.debug) this.debug("Double-click 1");
                        e.preventDefault();
                        $(e.target).closest(".tree-node").tree("editKey");
                    });

            if ($node.hasClass("tree-leaf")) {
                $("<span></span>")
                    .text(" : ")
                    .addClass("tree-separator")
                    .appendTo($info);
                $("<span></span>")
                    .appendTo($info)
                    .addClass("tree-value")
                    .text(this._displayedValue())
                    .on($.isTouchCapable && $.isTouchCapable() ?
                        "doubletap" : "dblclick",
                        function (e) {
                            if (this.debug) this.debug("Double-click 2");
                            e.preventDefault();
                            $(e.target).closest(".tree-node").tree("editValue");
                        });
            }
            this._makeDraggable($node);
            this._decorate_with_alarm($node);
        },

        open: function(options) {
            let $node = this.element;

            if (options && options.decorate)
                this._decorate_node();

            if ($node.hasClass("tree-node-is-open"))
                return $node;

            if ($node.hasClass("tree-never-opened")) {
                // Expand children for display, if this is the
                // first time this node has been opened
                $node.removeClass("tree-never-opened");
                $node.children(".tree-subnodes").children().each(function () {
                    $(this).tree("instance")._decorate_node();
                });
            }

            if (!$node.hasClass("tree-root")) {
                let fruitbat = $node.find(".tree-node-is-open-close")
                    .first();
                fruitbat.icon_button("option", "icon", "squirrel-icon-folder-open");
            }
            return $node
                .addClass("tree-node-is-open")
                .children(".tree-subnodes")
                .show();
        },

        close: function() {
            let $node = this.element;
            if (!$node.hasClass("tree-node-is-open"))
                return $node;
            $node.find(".tree-node-is-open-close")
                .first()
                .icon_button("option", "icon", "squirrel-icon-folder-closed");
            return $node
                .removeClass("tree-node-is-open")
                .children(".tree-subnodes")
                .hide();
        },

        toggle: function() {
            if (this.element.hasClass("tree-node-is-open"))
                return this.close();
            return this.open();
        },

        /**
         * @private
         * Action handler for node edit
         */
        _action_E: function(action, undoable) {
            let $node = this.element;
            if (undoable)
                undoable("E", this.getPath(),
                         action.time, $node.data("value"));

            $node
                .data("value", action.data)
                .find(".tree-value")
                .first()
                .text(this._displayedValue());

            this.setModified(action.time);
        },

        /**
         * @private
         * Action handler for node delete
         */
        _action_D: function(action, undoable) {
            let $node = this.element;

            if (undoable) {
                // Not enough - all the subtree would need to be
                // regenerated
                undoable("N",
                         this.getPath(),
                         action.time,
                         $node.data("value"));
            }

            this._removeFromCaches();

            let $parent = $node.parent()
                .closest(".tree-node");
            $parent.tree("setModified", action.time);

            $node.remove();
        },

        /**
         * @private
         * Action handler for alarm add
         */
        _action_A: function(action, undoable) {
            let $node = this.element;
            // Check there's an alarm already
            let alarm = $node.data("alarm");
            if (alarm === action.data)
                return; // no change

            $node.data("alarm", action.data);

            if (typeof alarm === "undefined") {
                // No existing alarm, need to create parts
                this._decorate_with_alarm($node);

                // Run up the tree, incrementing the alarm count
                $node.parents(".tree-node")
                    .each(function () {
                        let c = $(this)
                            .data("alarm-count") || 0;
                        $(this)
                            .data("alarm-count", c + 1);
                        $(this)
                            .addClass("tree-has-alarms");
                    });

                // Undo by cancelling the new alarm
                if (undoable)
                    undoable("C", this.getPath(), action.time);
            } else {
                // Existing alarm, parts already exist.
                // Undo by rewriting the old alarm.
                if (undoable)
                    undoable("A", this.getPath(), action.time, alarm);
            }

            this.setModified(action.time);
        },

        /**
         * Action handler for cancelling an alarm
         */
        _action_C: function(action, undoable) {
            let $node = this.element;

            let alarm = $node.data("alarm");
            if (!alarm)
                return;

            if (undoable)
                undoable("A", this.getPath(), action.time, alarm);

            // run up the tree decrementing the alarm count
            $node.parents(".tree-node")
                .each(function () {
                    let c = $(this)
                        .data("alarm-count") || 0;
                    c = c - 1;
                    $(this)
                        .data("alarm-count", c);
                    if (c === 0)
                        $(this)
                        .removeClass("tree-has-alarms");
                });

            $(".tree-alarm")
                .first()
                .remove();

            $node.removeData("alarm");

            this.setModified(action.time);
        },

        /**
         * Action handler for modifying constraints
         */
        _action_X: function(action, undoable) {
            let constraints = this.element.data("constraints");
            if (constraints === action.data)
                return; // same constraints already
            if (undoable)
                undoable("X", this.getPath(), action.time, constraints);

            this.element.data("constraints", action.data);
            this.setModified(action.time);
        },

        /**
         * Action handler for moving a node
         */
        _action_M: function(action, undoable) {
            let $node = this.element;
            let oldpath = this.getPath();
            let newpath = action.data.slice();
            let $new_parent = this.getNodeFromPath(newpath);

            // Relocate the node in the DOM
            this._insertInto($new_parent);

            if (typeof $node.scroll_into_view !== "undefined")
                $node.scroll_into_view();

            this.setModified(action.time);

            newpath.push(oldpath.pop());

            if (undoable)
                undoable("M", newpath, action.time, oldpath);
        },

        /**
         * Action handler for node rename
         */
        _action_R: function(action, undoable) {
            // Detach the li from the DOM
            let $node = this.element;
            let key = action.path[action.path.length - 1]; // record old node name

            $node
                .data("key", action.data)
                .find(".tree-key")
                .first()
                .text(action.data);

            this.setModified(action.time);

            // Re-insert the element in it's sorted position
            this._insertInto($node.parent()
                             .closest(".tree-collection"));

            if (typeof $node.scroll_into_view !== "undefined")
                $node.scroll_into_view();

            if (undoable) {
                undoable("R", $node.tree("getPath"), action.time, key);
            }
        },

        /**
         * Callback for use when managing hoards; plays an action that is being
         * played into the hoard into the DOM as well.
         * @param e action to play
         * @param {function}, undoable passed the inverse of this action
         * @param chain function to call once the action has been
         * played. Passed the modified node.
         */
        action: function(action, undoable, chain) {
            if (action.type === "N") {
                // Create the new node. Automatically adds it to the right parent.
                $("<li></li>")
                    .tree($.extend(
                        {},
                        this.options,
                        {
                            path: action.path,
                            value: action.data,
                            time: action.time,
                            onCreate: function () {
                                // get_path will update the caches on the fly with the
                                // new node
                                if (undoable)
                                    undoable("D", this.tree("getPath"), action.time);
                                if (chain) chain(this);
                            }
                        }));
            } else {
                let $node = this.getNodeFromPath(action.path);
                let widget = $node.tree("instance");
                widget["_action_" + action.type].call(
                    widget,
                    action,
                    undoable);
                if (chain) chain(this);
            }
        },

        /**
         * Node paths are calculated from the DOM tree and are cached in
         * two ways; in a path->node lookup table called cache[], and in
         * a path->node lookup using a data("path") field on the
         * node, which maps to the PATHSEP separated path string.
         * @param $node jQuery node
         * @param parent optional path to the parent of this node
         */
        _addToCaches: function() {

            // Recursively cache node and descendants
            function recache($node, pa) {
                let path = pa.concat($node.data("key"));

                if (this.debug) {
                    if (!pa)
                        throw "recache outside tree";
                    if (path2$node[path.join(PATHSEP)]) {
                        debugger;
                        throw "Remapping path -> node";
                    }
                    if ($node.data("path"))
                        throw "Remapping node -> path";
                }

                // node->path mapping
                $node.data("path", path);

                // path->node mapping
                path2$node[path.join(PATHSEP)] = $node;

                // Repeat for subnodes
                $node
                    .find("ul")
                    .first()
                    .children(".tree-node")
                    .each(function () {
                        recache($(this), path);
                    });
            }

            let $el = this.element;

            // Find the path to the parent of this node
            let $parent = $el.parent();
            if (!$parent || $parent.length == 0)
                throw new Error("No immediate parent");
            $parent = $parent
                .closest(".tree-node")
            if (!$parent || $parent.length == 0)
                throw new Error("No containing treenode");
            let pa = $parent.tree("getPath");
            recache($el, pa);
        },

        /**
         * @private
         * Remove the node (and all subnodes) from the node->path->node mappings
         * @param $node node to remove
         */
        _removeFromCaches: function() {
            let $node = this.element;
            if (!$node.hasClass("tree-node"))
                $node = $node.closest(".tree-node");

            if ($node.data("path"))
                delete path2$node[$node.data("path")
                                  .join(PATHSEP)];

            $node
                .removeData("path")
            // Reset the path of all subnodes
                .find(".tree-node")
                .each(function () {
                    let $s = $(this);
                    delete path2$node[$s.data("path").join(PATHSEP)];
                    $s.removeData("path");
                });
        }
    };

    (function ($) {
        $.widget("squirrel.tree", Tree);
    })(jQuery);

    return Tree;
});

