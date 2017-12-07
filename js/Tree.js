/*@preserve Copyright (C) 2015-2017 Crawford Currie http://c-dot.co.uk license MIT*/

/* global DEBUG:true */
/* global Utils */
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

(function($, S) {
    "use strict";

    var cache = {};    // Path->node mapping

    var compare; // compare function
    
    // Built the UI widget
    var widget = {};
    
    widget._create = function() {

        if (this.options.compare)
            compare = this.options.compare;
        
        // this.element is the object it's called on
        // This will be a div for the root, and an li for any other node
        // this.options is the options passed

        // Invoked on tree-title
        function hoverIn(/*evt*/) {            
            $("body").contextmenu("close");
            
            if ($("body").find("input.in_place_editor").length > 0)
                return true;
            console.log("hoverin");
            $(".tree-hover").removeClass("tree-hover");
            
            if (S.hideValues() && $node.hasClass("tree-leaf")) {
                $(this).find(".tree-value").each(
                    function() {
                        $(this).text($node.data("value"));
                    });
            }

            $(this).addClass("tree-hover")

            return false;
        }
        
        // Invoked on tree-title
        function hoverOut(/*evt*/) {
            if ($("body").contextmenu("isOpen") ||
                $(body).find("input.in_place_editor").length > 0)
                return true;
            console.log("hoverout");
            
            if (S.hideValues() && $node.hasClass("tree-leaf")) {
                $(this).find(".tree-value").each(
                    function() {
                        $(this).text(S.mask($node.data("value")));
                    });
            }
            $(this).removeClass("tree-hover");
        }

        var self = this;
        var $node = this.element;
        var options = this.options;
        var is_leaf = false;
        var is_root = !options.path;
        var parent, key = "", $parent;

        $node.addClass("tree-node");

        if (is_root) {
            cache[""] = $node;
            $node.addClass("tree-root"); // should be there in HTML?
            $node.data("path", "");
        }
        else {
            parent = options.path.slice();
            key = parent.pop();
            $parent = this.getNodeFromPath(parent);
            $node.data("key", key);

            var $title = $("<div></div>")
                .addClass("tree-title")
            // SMELL: only if screen is wide enough!
                .hover(hoverIn, hoverOut)
                .on("paste", function() {
                    debugger;
                })
                .appendTo($node);
            
            if (typeof options.value !== "undefined"
                && options.value !== null) {

                $node
                    .data("value", options.value)
                    .data("is_leaf", true)
                    .addClass("tree-leaf");
                is_leaf = true;
            }
            else { 
                // Add open/close button on running nodes, except the root
                // which is always open
                var $control = $("<button></button>")
                    .addClass("tree-open-close");
                $title.prepend($control);
                $node.addClass("tree-open");
                this._createIconButton(
                    $control,
                    "folder-closed",
                    function(e) {
//                        e.preventDefault();
//                        e.stopPropagation();
                        $node.tree("toggle");
                        return false;
                    });
            }

            var $info = $("<div></div>")
                .addClass("tree-info")
                .appendTo($title);

            // Create the key span
            $("<span></span>")
                .appendTo($info)
                .addClass("tree-key")
                .text(key)
                .on($.isTouchCapable() ? "doubletap" : "dblclick", function(e) {
                    e.preventDefault();
                    self.editKey();
                });

            if (is_leaf) {
                $("<span> : </span>")
                    .addClass("tree-separator")
                    .appendTo($info);
                $("<span></span>")
                    .appendTo($info)
                    .addClass("tree-value")
                    .text(S.hideValues() ?
                          S.mask(options.value) : options.value)
                    .on($.isTouchCapable() ?
                        "doubletap" : "dblclick", function(e) {
                            e.preventDefault();
                            self.editValue();
                        });
            }
        }
        
        if (!is_leaf) {
            $node
                .addClass("tree-collection")
                .append("<ul class='sortable tree-subnodes'></ul>");
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
     * @param $control jQuery object,
     * @param icon is the abstract name of the icon to use, one
     * of "open", "closed" or "alarm".
     * @param on_click may be a function to handle click events
     */
    widget._createIconButton = function($control, icon, on_click) {
        var $button = $control.button({
            icons: {
                primary: "ui-icon-squirrel-" + icon
            },
            classes: {
                "ui-button-icon": "squirrel-icon"
            },
            text: false
        });
        if (on_click)
            // Click works a lot better than tap! tap was always being
            // followed by taphold on android, even when it was clearly
            // a single tap. And you get click events there anyway.
            // $button.on($.getTapEvent(), on_click);
            $button.on("click", on_click);
    };

    widget._changeIconButton = function($control, icon) {
        if ($control.length > 0)
            $control.button(
                "option", "icons", {
                    primary: "ui-icon-squirrel-" + icon });
    };

    widget._destroyIconButton = function($control) {
        $control.remove();
    };
    
    /**
     * Requires edit_in_place. selector may be a jquery selector or
     * an object.
     * @param $span child node to edit
     * ~para, text text to present in the editor
     * @param action 'R'ename or 'E'dit
     */
    widget.edit = function($span, text, action) {
        var $node = this.element;

        // Fit width to the container
        var w = $node.closest(".tree-root").width();
        w -= $span.position().left;
        $span.parents().each(function() {
            w -= $(this).position().left;
        });

        S.enableContextMenu(false);
        
        var nodepath = this.getPath();
        $span.edit_in_place({
            width: w,
            text: text,
            changed: function(s) {
                S.playAction({
                    type: action,
                    path: nodepath,
                    data: s
                });
                return s;
            },
            closed: function() {
                S.enableContextMenu(true);
            }
        });
    };

    widget.editKey = function() {
        var $node = this.element;
        this.edit(
            $node.find(".tree-key:first"), $node.data("key"), "R");
    };
    
    widget.editValue = function() {
        var $node = this.element;
        this.edit(
            $node.find(".tree-value:first"), $node.data("value"), "E");
    };
    
    widget.ringAlarm = function() {
        this.element
            .find(".tree-alarm")
            .addClass("tree-expired")
            .find(".ui-icon-squirrel-alarm")
            .removeClass("ui-icon-squirrel-alarm")
            .addClass("ui-icon-squirrel-rang");
    };

    widget._makeDraggable = function() {
        var $node = this.element;
        
        function handleDrag(event) {
            // Need to get from a position to a target element
            var $within = $(".tree-collection")
                .not(".ui-draggable-dragging")
                .filter(function() {
                    if ($(this).is($node.parent().closest(".tree-node")))
                        return false;
                    var box = $(this).offset();
                    if (event.pageX < box.left ||
                        event.pageY < box.top)
                        return false;
                    if (event.pageX >
                        box.left + $(this).outerWidth(true) ||
                        event.pageY >
                        box.top + $(this).outerHeight(true))
                        return false
                    return true;
                });
            // inside $this
            $(".drop-target").removeClass("drop-target");
            if ($within.length > 0) {
                $within = $within.last();
                $within.addClass("drop-target");
                console.log("drop on " + $within.data("key"));
            }
        }

        function handleStop() {
            var $target = $(".drop-target");
            if ($target.length > 1)
                debugger;
            $target.each(function() {
                var $new_parent = $(this);
                $new_parent.removeClass("drop-target");
                var oldpath = $node.tree("getPath");
                var newpath = $new_parent.tree("getPath");
                S.playAction(
                    {
                        type: 'M',
                        path: oldpath,
                        data: newpath
                    });
            });
        }
        
        $node.draggable({
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
    widget.getPath = function() {
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
                ps = "";
        }
        return ps.split(S.PATHSEP);
    }

    /**
     * @private
     * Insert-sort the given node as a child of the given parent node
     */
    widget._insertInto = function($parent) {
        var $node = this.element;
        
        // First decouple from the old parent
        this._removeFromCaches();
        $node.detach();

        // Now insert in the new parent
        var key = $node.data("key");
        var inserted = false;

        var $ul = $parent.find("ul:first");
        $ul.children(".tree-node").each(function() {
            if (compare(
                $(this).data("key"), key) > 0) {
                $node.insertBefore($(this));
                inserted = true;
                return false;
            }
        });
        if (!inserted)
            $ul.append($node);
    };

    /**
     * @param time optional time in ms, if missing will use now
     */
    widget.setModified = function(time) {
        return this.element
            .addClass("tree-modified")
            .data("last-time-changed", time);
    };

    widget.open = function() {
        var $node = this.element;
        if ($node.hasClass("tree-open"))
            return $node;
        if (!$node.hasClass("tree-root"))
            this._changeIconButton(
                $node.find(".tree-open-close").first(), "folder-open");
        return $node
            .addClass("tree-open")
            .children(".tree-subnodes")
            .scroll_into_view()
            .show();
    };

    widget.close = function() {
        var $node = this.element;
        if (!$node.hasClass("tree-open"))
            return $node;
        this._changeIconButton(
            $node.find(".tree-open-close").first(), "folder-closed");
        return $node
            .removeClass("tree-open")
            .children(".tree-subnodes")
            .hide();
    };
    
    widget.toggle = function() {
        if (this.element.hasClass("tree-open"))
            return this.close();
        return this.open();
    };

    /**
     * @private
     * Action handler for node edit
     */
    widget.action_E = function(action, undoable) {
        var $node = this.element;
        if (undoable) {
            S.pushUndo({
                type: "E",
                path: this.getPath(),
                data: $node.data("value")
            });
        }

        $node
            .data("value", action.data)
            .find(".tree-value:first")
            .text(S.hideValues() ? S.mask(action.data) : action.data);

        this.setModified(action.time);
    };

    /**
     * @private
     * Action handler for node delete
     */
    widget.action_D = function(action, undoable) {
        var $node = this.element;

        if (undoable) {
            // Not enough - all the subtree would need to be
            // regenerated
            S.pushUndo({
                type: "N",
                path: this.getPath(),
                data: $node.data("value")
            });
        }

        this._removeFromCaches();

        var $parent = $node.parent().closest(".tree-node");
        $parent.tree("setModified", action.time);

        $node.remove();
    };

    /**
     * @private
     * Action handler for alarm add
     */
    widget.action_A = function(action, undoable) {
        var $node = this.element;
        // Check there's an alarm already
        var alarm = $node.data("alarm");
        if (alarm === action.data)
            return; // no change

        if (typeof alarm === "undefined") {
            // No existing alarm, need to create parts
            var $button = $("<button></button>")
                .addClass("tree-alarm");
            $node
                .find(".tree-key")
                .first()
                .before($button);

            this._createIconButton(
                $button,
                "alarm",
                function() {
                    $("#alarm_dlg").squirrelDialog("open", {$node: $node});
                    return false;
                });

            // Run up the tree, incrementing the alarm count
            $node.parents(".tree-node").each(function() {
                var c = $(this).data("alarm-count") || 0;
                $(this).data("alarm-count", c + 1);
                $(this).addClass("tree-has-alarms");
            });

            // Undo by cancelling the new alarm
            if (undoable)
                S.pushUndo({
                    type: "C",
                    path: this.getPath()
                });
        } else {
            // Existing alarm, parts already exist.
            // Undo by rewriting the old alarm.
            if (undoable)
                S.pushUndo({
                    type: "A",
                    path: this.getPath(),
                    data: alarm
                });
        }
        
        $node.data("alarm", action.data);

        this.setModified(action.time);
    };

    /**
     * Action handler for cancelling an alarm
     */
    widget.action_C = function(action, undoable) {
        var $node = this.element;
        
        var alarm = $node.data("alarm");
        if (!alarm)
            return;
        
        if (undoable) {
            S.pushUndo({
                type: "A",
                path: this.getPath(),
                data: alarm
            });
        }
        
        // run up the tree decrementing the alarm count
        $node.parents(".tree-node").each(function() {
            var c = $(this).data("alarm-count") || 0;
            c = c - 1;
            $(this).data("alarm-count", c);
            if (c === 0)
                $(this).removeClass("tree-has-alarms");
        });

        this._destroyIconButton($node.find(".tree-alarm").first());
        
        $node.removeData("alarm");

        this.setModified(action.time);
    };

    /**
     * Action handler for modifying constraints
     */
    widget.action_X = function(action, undoable) {
        var constraints = this.element.data("constraints");
        if (constraints === action.data)
            return; // same constraints already
        if (undoable)
            S.pushUndo({
                type: "X",
                path: this.getPath(),
                data: constraints
            });

        this.element.data("constraints", action.data);
        this.setModified(action.time);
    };

    /**
     * Action handler for moving a node
     */
    widget.action_M = function(action, undoable) {
        var $node = this.element;
        var oldpath = this.getPath();
        var newpath = action.data.slice();
        var $new_parent = this.getNodeFromPath(newpath);

        // Relocate the node in the DOM
        this._insertInto($new_parent);

        // refresh data-path and update fragment ID
        this.getPath(); // get new path
        $node.scroll_into_view();

        this.setModified(action.time);

        newpath.push(oldpath.pop());
        
        if (undoable) {
            S.pushUndo({
                type: "M",
                path: newpath,
                data: oldpath
            });
        }
    };

    /**
     * Action handler for node rename
     */
    widget.action_R = function(action, undoable) {
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
        this._insertInto($node.parent().closest(".tree-collection"));

        $node.scroll_into_view();

        // refresh data-path and update fragment ID
        var p = $node.tree("getPath"); // get new path

        if (undoable) {
            S.pushUndo({
                type: "R",
                path: p, // no need to slice, not re-used
                data: key
            });
        }

        Utils.sometime("update_save");
    };

    /**
     * Callback for use when managing hoards; plays an action that is being
     * played into the hoard into the DOM as well.
     * @param e action to play
     * @param undoable set true if the inverse of this action is to be
     * added to the undo chain.
     * @param chain function to call once the action has been
     * played. Passed the modified node.
     */
    widget.action = function(action, undoable, chain) {
        if (action.type === "N") {
            // Create the new node. Automatically adds it to the right parent.
            $("<li></li>")
                .tree({
                    path: action.path,
                    value: action.data,
                    time: action.time,
                    on_create: function() {
                        // get_path will update the caches on the fly with the
                        // new node
                        var path = this.tree("getPath");
                        if (undoable) {
                            S.pushUndo({
                                type: "D",
                                path: path
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
     * node, which maps to the S.PATHSEP separated path string.
     * @param $node either DOM node or jQuery node
     */
    widget._addToCaches = function(path) {
        var $node = this.element;
        if (!path)
            path = $node.parent().closest(".tree-node").tree("getPath");

        path.push($node.data("key"));
                
        var ps = path.join(S.PATHSEP);
                
        // node->path shortcut
        $node.data("path", ps);
                
        // path->node mapping
        cache[ps] = $node;
    };

    /**
     * @private
     * Remove the node (and all subnodes) from the node->path->node mappings
     * @param $node node to remove
     */
    widget._removeFromCaches = function() {
        var $node = this.element;
        if (!$node.hasClass("tree-node"))
            $node = $node.closest(".tree-node");

        delete cache[$node.data("path")];
        $node
            .removeData("path")
        // Reset the path of all subnodes
            .find(".tree-node")
            .each(function() {
                var $s = $(this);
                delete cache[$s.data("path")];
                $s.data("path", null);
            });
    };

    /**
     * Find the jQuery node for a path. Callable on any node.
     * @param path array of keys representing the path
     * @return a JQuery element
     */
    widget.getNodeFromPath = function(path) {
        var $node = cache[path.join(S.PATHSEP)];
        if (DEBUG && $node && $node.length === 0)
            // Not in the cache, was something not been through get_path?
            debugger;
        return $node;
    };
    
    $.widget("squirrel.tree", widget);

})(jQuery, Squirrel);
