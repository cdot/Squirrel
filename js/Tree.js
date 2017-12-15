/*@preserve Copyright (C) 2015-2017 Crawford Currie http://c-dot.co.uk license MIT*/

/* global global:true */
/* global Cookies */
/* global Squirrel */

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

/*
 * @param $ jQuery
 * @param S an object that supports:
 * .contextMenu(isOpen|close|enable|disable)
 * .playAction(action)
 */
(function ($, S) {
    "use strict";

    var cache = {}; // Path->node mapping
    const PATHSEP = String.fromCharCode(1); // separator used in Path->node mapping index
    var compare; // compare function

    function obscure_value(s) {
        return (Cookies.get("ui_hidevalues") == "on") ?
            s.replace(/./g, "※") : s;
    }

    function hide_values(on) {
        if (typeof on !== "undefined") {
            var is_on = (Cookies.get("ui_hidevalues") == "on");
            Cookies.set("ui_hidevalues", on ? "on" : "off");
            if (on !== is_on) {
                $(".tree-value:not(:hover)")
                    .each(
                        function () {
                            var s = $(this)
                                .closest(".tree-node")
                                .data("value");
                            $(this).text(obscure_value(s));
                        });
            }
        }
        return Cookies.get("ui_hidevalues") == "on";
    }

    var tree_widget = {};

    tree_widget.hide_values = hide_values;

    tree_widget._create = function () {

        var self = this;
        var $node = this.element;

        if (this.options.compare)
            compare = this.options.compare;

        // this.element is the object it's called on
        // This will be a div for the root, and an li for any other node
        // this.options is the options passed

        // Invoked on tree-title
        function hoverIn( /*evt*/ ) {
            S.contextMenu("close");

            if ($("body")
                .find("input.in_place_editor")
                .length > 0)
                return true;

            $(".tree-hover")
                .removeClass("tree-hover");

            if (hide_values() && $node.hasClass("tree-leaf")) {
                $(this)
                    .find(".tree-value")
                    .each(
                        function () {
                            $(this)
                                .text($node.data("value"));
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
            if (S.contextMenu("isOpen") ||
                $("body")
                .find("input.in_place_editor")
                .length > 0)
                return true;

            if (hide_values() && $node.hasClass("tree-leaf")) {
                $(this)
                    .find(".tree-value")
                    .each(
                        function () {
                            $(this)
                                .text(obscure_value($node.data("value")));
                        });
            }
            $(this)
                .removeClass("tree-hover")
                .find(".tree-draghandle")
                .first()
                .hide();
        }

        var options = this.options;
        var is_leaf = false;
        var is_root = !options.path;
        var parent, key = "",
            $parent;

        $node.addClass("tree-node");

        if (is_root) {
            cache[""] = $node;
            $node.addClass("tree-root"); // should be there in HTML?
            $node.data("path", []);
        } else {
            parent = options.path.slice();
            key = parent.pop();
            $parent = this.getNodeFromPath(parent);
            $node.data("key", key);

            var $title = $(document.createElement("div"))
                .addClass("tree-title")
                // SMELL: only if screen is wide enough!
                .hover(hoverIn, hoverOut)
                .on("paste", function () {
                    debugger;
                })
                .appendTo($node);

            if (typeof options.value !== "undefined" &&
                options.value !== null) {

                $node
                    .data("value", options.value)
                    .data("is_leaf", true)
                    .addClass("tree-leaf");
                is_leaf = true;
            } else {
                // Add open/close button on running nodes, except the root
                // which is always open
                var $control = $(document.createElement("button"))
                    .addClass("tree-open-close");
                $title.prepend($control);
                $node.addClass("tree-open");
                $control.iconbutton({ icon: "squirrel-icon-folder-closed" })
                    .on($.getTapEvent(),
                        function () {
                            $node.tree("toggle");
                            return false;
                        });
            }

            var $info = $(document.createElement("div"))
                .addClass("tree-info")
                .appendTo($title);

            // Create the key span
            $(document.createElement("span"))
                .appendTo($info)
                .addClass("tree-key")
                .text(key)
                .on($.isTouchCapable && $.isTouchCapable() ?
                    "doubletap" : "dblclick",
                    function (e) {
                        e.preventDefault();
                        self.editKey();
                    });

            if (is_leaf) {
                $(document.createElement("span"))
                    .text(" : ")
                    .addClass("tree-separator")
                    .appendTo($info);
                $(document.createElement("span"))
                    .appendTo($info)
                    .addClass("tree-value")
                    .text(obscure_value(options.value))
                    .on($.isTouchCapable && $.isTouchCapable() ?
                        "doubletap" : "dblclick",
                        function (e) {
                            e.preventDefault();
                            self.editValue();
                        });
            }
        }

        if (!is_leaf) {
            var $ul = $(document.createElement("ul"))
                .addClass("sortable tree-subnodes");
            $node
                .addClass("tree-collection")
                .append($ul);
        }

        // Close to hide the children (or to open the root)
        this.toggle();

        if (!is_root)
            this._makeDraggable();

        if ($parent)
            // Insert-sort into the $parent
            this._insertInto($parent);

        if (typeof options.time !== "undefined")
            this.setModified(options.time);

        if (options.on_create)
            options.on_create.call($node);
    };

    /**
     * Requires edit_in_place. selector may be a jquery selector or
     * an object.
     * @param $span child node to edit
     * ~para, text text to present in the editor
     * @param action 'R'ename or 'E'dit
     */
    tree_widget.edit = function ($span, text, action) {
        var $node = this.element;

        // Fit width to the container
        var w = $node.closest(".tree-root")
            .width();
        w -= $span.position()
            .left;
        $span.parents()
            .each(function () {
                w -= $(this)
                    .position()
                    .left;
            });

        S.contextMenu("disable");

        var nodepath = this.getPath();
        $span.edit_in_place({
            width: w,
            text: text,
            changed: function (s) {
                S.playAction({
                    type: action,
                    path: nodepath,
                    data: s
                });
                return s;
            },
            closed: function () {
                S.contextMenu("enable");
            }
        });
    };

    tree_widget.editKey = function () {
        var $node = this.element;
        this.edit(
            $node.find(".tree-key")
            .first(), $node.data("key"), "R");
    };

    tree_widget.editValue = function () {
        var $node = this.element;
        this.edit(
            $node.find(".tree-value")
            .first(), $node.data("value"), "E");
    };

    tree_widget.ringAlarm = function () {
        this.element
            .find(".tree-alarm")
            .addClass("tree-expired")
            .find(".squirrel-icon-alarm")
            .removeClass("squirrel-icon-alarm")
            .addClass("squirrel-icon-rang");
    };

    tree_widget._makeDraggable = function () {
        var $node = this.element;

        function handleDrag(event) {
            // Need to get from a position to a target element
            var $within = $(".tree-collection")
                .not(".ui-draggable-dragging")
                .filter(function () {
                    if ($(this)
                        .is($node.parent()
                            .closest(".tree-node")))
                        return false;
                    var box = $(this)
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
            var $target = $(".drop-target");
            if ($target.length > 1)
                debugger;
            $target.each(function () {
                var $new_parent = $(this);
                $new_parent.removeClass("drop-target");
                var oldpath = $node.tree("getPath");
                var newpath = $new_parent.tree("getPath");
                S.playAction({
                    type: "M",
                    path: oldpath,
                    data: newpath
                });
            });
        }

        // Drag handle
        var $button = $(document.createElement("div"))
            .addClass("tree-draghandle")
            .iconbutton({ icon: "ui-icon-arrow-2-n-s" })
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
    };

    /**
     * Find the path for a DOM node or jQuery node.
     * @return an array containing the path to the node, one string per key
     */
    tree_widget.getPath = function () {
        var $node = this.element;
        if ($node.hasClass("tree-root"))
            return [];
        if (!$node.hasClass("tree-node"))
            debugger;

        // IMPORTANT: root node MUST NOT have data-path in HTML

        // Lookup shortcut, if set
        var ps = $node.data("path");
        if (!ps) {
            this._addToCaches();
            ps = $node.data("path");
            if (!ps)
                ps = [];
        }
        return ps;
    }

    /**
     * @private
     * Insert-sort the given node as a child of the given parent node
     */
    tree_widget._insertInto = function ($parent) {
        var $node = this.element;

        // First decouple from the old parent
        this._removeFromCaches();
        $node.detach();

        // Now insert in the new parent
        var key = $node.data("key");
        var inserted = false;

        var $ul = $parent.find("ul")
            .first();
        $ul.children(".tree-node")
            .each(function () {
                if (compare(
                        $(this)
                        .data("key"), key) > 0) {
                    $node.insertBefore($(this));
                    inserted = true;
                    return false;
                }
            });
        if (!inserted)
            $ul.append($node);
        this._addToCaches();
    };

    /**
     * @param time optional time in ms, if missing will use now
     */
    tree_widget.setModified = function (time) {
        return this.element
            .addClass("tree-modified")
            .data("last-time-changed", time);
    };

    tree_widget.open = function () {
        var $node = this.element;
        if ($node.hasClass("tree-open"))
            return $node;
        if (!$node.hasClass("tree-root"))
            $node.find(".tree-open-close")
            .first()
            .removeClass("squirrel-icon-folder-closed")
            .addClass("squirrel-icon-folder-open");
        return $node
            .addClass("tree-open")
            .children(".tree-subnodes")
            .show();
    };

    tree_widget.close = function () {
        var $node = this.element;
        if (!$node.hasClass("tree-open"))
            return $node;
        $node.find(".tree-open-close")
            .first()
            .removeClass("squirre-icon-folder-open")
            .addClass("squirrel-icon-folder-closed");
        return $node
            .removeClass("tree-open")
            .children(".tree-subnodes")
            .hide();
    };

    tree_widget.toggle = function () {
        if (this.element.hasClass("tree-open"))
            return this.close();
        return this.open();
    };

    /**
     * @private
     * Action handler for node edit
     */
    tree_widget.action_E = function (action, undoable) {
        var $node = this.element;
        if (undoable) {
            undoable({
                type: "E",
                path: this.getPath(),
                time: action.time,
                data: $node.data("value")
            });
        }

        $node
            .data("value", action.data)
            .find(".tree-value")
            .first()
            .text(obscure_value(action.data));

        this.setModified(action.time);
    };

    /**
     * @private
     * Action handler for node delete
     */
    tree_widget.action_D = function (action, undoable) {
        var $node = this.element;

        if (undoable) {
            // Not enough - all the subtree would need to be
            // regenerated
            undoable({
                type: "N",
                path: this.getPath(),
                time: action.time,
                data: $node.data("value")
            });
        }

        this._removeFromCaches();

        var $parent = $node.parent()
            .closest(".tree-node");
        $parent.tree("setModified", action.time);

        $node.remove();
    };

    /**
     * @private
     * Action handler for alarm add
     */
    tree_widget.action_A = function (action, undoable) {
        var $node = this.element;
        // Check there's an alarm already
        var alarm = $node.data("alarm");
        if (alarm === action.data)
            return; // no change

        if (typeof alarm === "undefined") {
            // No existing alarm, need to create parts
            var $button = $(document.createElement("button"))
                .addClass("tree-alarm");
            $node
                .find(".tree-key")
                .first()
                .before($button);

            $button.iconbutton({ icon: "squirrel-icon-alarm" })
                .on("click", function () {
                    $("#alarm_dlg")
                        .squirrelDialog("open", {
                            $node: $node
                        });
                    return false;
                });

            // Run up the tree, incrementing the alarm count
            $node.parents(".tree-node")
                .each(function () {
                    var c = $(this)
                        .data("alarm-count") || 0;
                    $(this)
                        .data("alarm-count", c + 1);
                    $(this)
                        .addClass("tree-has-alarms");
                });

            // Undo by cancelling the new alarm
            if (undoable)
                undoable({
                    type: "C",
                    path: this.getPath(),
                    time: action.time
                });
        } else {
            // Existing alarm, parts already exist.
            // Undo by rewriting the old alarm.
            if (undoable)
                undoable({
                    type: "A",
                    path: this.getPath(),
                    data: alarm,
                    time: action.time
                });
        }

        $node.data("alarm", action.data);

        this.setModified(action.time);
    };

    /**
     * Action handler for cancelling an alarm
     */
    tree_widget.action_C = function (action, undoable) {
        var $node = this.element;

        var alarm = $node.data("alarm");
        if (!alarm)
            return;

        if (undoable) {
            undoable({
                type: "A",
                path: this.getPath(),
                data: alarm,
                time: action.time
            });
        }

        // run up the tree decrementing the alarm count
        $node.parents(".tree-node")
            .each(function () {
                var c = $(this)
                    .data("alarm-count") || 0;
                c = c - 1;
                $(this)
                    .data("alarm-count", c);
                if (c === 0)
                    $(this)
                    .removeClass("tree-has-alarms");
            });

        $(".tree-alarm")
             .first().remove();

        $node.removeData("alarm");

        this.setModified(action.time);
    };

    /**
     * Action handler for modifying constraints
     */
    tree_widget.action_X = function (action, undoable) {
        var constraints = this.element.data("constraints");
        if (constraints === action.data)
            return; // same constraints already
        if (undoable)
            undoable({
                type: "X",
                path: this.getPath(),
                data: constraints,
                time: action.time
            });

        this.element.data("constraints", action.data);
        this.setModified(action.time);
    };

    /**
     * Action handler for moving a node
     */
    tree_widget.action_M = function (action, undoable) {
        var $node = this.element;
        var oldpath = this.getPath();
        var newpath = action.data.slice();
        var $new_parent = this.getNodeFromPath(newpath);

        // Relocate the node in the DOM
        this._insertInto($new_parent);

        $node.scroll_into_view();

        this.setModified(action.time);

        newpath.push(oldpath.pop());

        if (undoable) {
            undoable({
                type: "M",
                path: newpath,
                data: oldpath,
                time: action.time
            });
        }
    };

    /**
     * Action handler for node rename
     */
    tree_widget.action_R = function (action, undoable) {
        // Detach the li from the DOM
        var $node = this.element;
        var key = action.path[action.path.length - 1]; // record old node name

        $node
            .data("key", action.data)
            .find(".tree-key")
            .first()
            .text(action.data);

        this.setModified(action.time);

        // Re-insert the element in it's sorted position
        this._insertInto($node.parent()
            .closest(".tree-collection"));

        $node.scroll_into_view();

        if (undoable) {
            undoable({
                type: "R",
                path: $node.tree("getPath"), // no need to slice, not re-used
                data: key,
                time: action.time
            });
        }
    };

    /**
     * Callback for use when managing hoards; plays an action that is being
     * played into the hoard into the DOM as well.
     * @param e action to play
     * @param {function} undoable passed the inverse of this action
     * @param chain function to call once the action has been
     * played. Passed the modified node.
     */
    tree_widget.action = function (action, undoable, chain) {
        if (action.type === "N") {
            // Create the new node. Automatically adds it to the right parent.
            $(document.createElement("li"))
                .tree({
                    path: action.path,
                    value: action.data,
                    time: action.time,
                    on_create: function () {
                        // get_path will update the caches on the fly with the
                        // new node
                        var path = this.tree("getPath");
                        if (undoable) {
                            undoable({
                                type: "D",
                                path: path,
                                time: action.time
                            });
                        }
                        if (typeof chain !== "undefined")
                            chain(this);
                    }
                });
        } else {
            var $node = this.getNodeFromPath(action.path);
            $node.tree(
                "action_" + action.type,
                action,
                undoable);
            if (typeof chain !== "undefined")
                chain($node);
        }
    };

    /**
     * Node paths are calculated from the DOM tree and are cached in
     * two ways; in a path->node lookup table called cache[], and in
     * a path->node lookup using a data("path") field on the
     * node, which maps to the PATHSEP separated path string.
     * @param $node jQuery node
     * @param parent optional path to the parent of this node
     */
    tree_widget._addToCaches = function () {

        // Recursively cache node and descendants
        function recache($node, pa) {
            var path = pa.concat($node.data("key"));

            if (global.DEBUG) {
                if (!pa)
                    throw "recache outside tree";
                if (cache[path.join(PATHSEP)])
                    throw "Remapping path -> node";
                if ($node.data("path"))
                    throw "Remapping node -> path";
            }

            // node->path mapping
            $node.data("path", path);

            // path->node mapping
            cache[path.join(PATHSEP)] = $node;

            // Repeat for subnodes
            $node
                .find("ul")
                .first()
                .children(".tree-node")
                .each(function () {
                    recache($(this), path);
                });
        }

        var $el = this.element;

        // Find the path to the parent of this node
        var $parent = $el.parent();
        if (!$parent || $parent.length == 0)
            debugger;
        $parent = $parent
            .closest(".tree-node")
        if (!$parent || $parent.length == 0)
            debugger;
        var parent = $parent.tree("getPath");

        recache($el, parent);
    };

    /**
     * @private
     * Remove the node (and all subnodes) from the node->path->node mappings
     * @param $node node to remove
     */
    tree_widget._removeFromCaches = function () {
        var $node = this.element;
        if (!$node.hasClass("tree-node"))
            $node = $node.closest(".tree-node");

        if ($node.data("path"))
            delete cache[$node.data("path")
                .join(PATHSEP)];

        $node
            .removeData("path")
            // Reset the path of all subnodes
            .find(".tree-node")
            .each(function () {
                var $s = $(this);
                delete cache[$s.data("path")
                    .join(PATHSEP)];
                $s.removeData("path");
            });
    };

    /**
     * Find the jQuery node for a path. Callable on any node.
     * @param path array of keys representing the path
     * @return a JQuery element
     */
    tree_widget.getNodeFromPath = function (path) {
        var $node = cache[path.join(PATHSEP)];
        if (global.DEBUG && $node && $node.length === 0)
            // Not in the cache, was something not been through get_path?
            debugger;
        return $node;
    };

    $.widget("squirrel.tree", tree_widget);

})(jQuery, Squirrel);
