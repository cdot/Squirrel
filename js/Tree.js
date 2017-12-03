/*@preserve Copyright (C) 2015-2017 Crawford Currie http://c-dot.co.uk license MIT*/

/* global DEBUG:true */
/* global Utils */
/* global TX */
/* global Hoard */
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
 * names to DOM nodes, and an undo stack. There is also a set of functions
 * that perform hoard actions on the DOM.
 */

(function($, S) {
    "use strict";

    var ST = S.Tree;
    var SD = S.Dialog;

    ST.cache = {};    // Path->node mapping
    ST.undos = [];    // undo stack

    // Built the UI widget
    var widget = {};
    
    widget._create = function() {

        // this.element is the object it's called on
        // This will be a div for the root, and an li for any other node
        // this.options is the options passed

        // Invoked on tree-title
        function hoverIn(/*evt*/) {            
            if ($(this).find(".in_place_editor").length !== 0)
                return true;

            $(this).addClass("tree-hover")

            /* SMELL: takes too much space on mobile
            var $status = $("<div></div>");
            $status.addClass("tree-lastmod");
            $(this).append($status);
            var $node = $(this).closest(".tree-node");
            var mod = new Date($node.data("last-time-changed"))
                .toLocaleString();
            $status.append("<span>" + mod + " </span");
            if (typeof $node.data("alarm") !== "undefined") {
                $status.append(
                    '<div class="inline-icon ui-icon-squirrel-alarm"></div>');
                $status.append(
                    '<div class="tree-info">'
                        + Utils.deltaTimeString(
                            new Date($node.data("last-time-changed")
                                     + $node.data("alarm")
                                     * Utils.MSPERDAY))
                        + "</div>");
            }
            */
            return false;
        }
        
        // Invoked on tree-title
        function hoverOut(/*evt*/) {
            $(this)
                .removeClass("tree-hover")
                .find(".tree-lastmod")
                .remove();
        }

        var $node = $(this.element);
        var options = this.options;
        var is_leaf = false;
        var is_root = !options.path;
        var parent, key = "", $parent;

        $node.addClass("tree-node");

        if (is_root) {
            ST.cache[""] = $node;
            $node.addClass("tree-root"); // should be there in HTML?
            $node.data("path", "");
        }
        else {
            parent = options.path;
            key = parent.pop();
            $parent = ST.getNodeFromPath(parent);
            $node.data("key", key);

            var $title = $("<div></div>")
                .addClass("tree-title")
            // SMELL: only if screen is wide enough!
                .hover(hoverIn, hoverOut)
                .on("paste", function(e) {
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
                this._createIconButton($control,
                                       "folder-closed",
                                       function() {
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
                    $node.tree("edit", ".tree-key", "R");
                });

            if (is_leaf) {
                $("<span> : </span>")
                    .addClass("tree-separator")
                    .appendTo($info);
                $("<span></span>")
                    .appendTo($info)
                    .addClass("tree-value")
                    .text(options.value)
                    .on($.isTouchCapable() ?
                        "doubletap" : "dblclick", function(e) {
                            e.preventDefault();
                            $node.tree("edit", ".tree-value", "E");
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
            $button.on($.getTapEvent(), on_click);
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
     * @param selector object of selector string
     * @param action 'R'ename or 'E'dit
     */
    widget.edit = function(selector, action) {
        var nodepath = this.getPath();
        var $node = this.element;
        var $span = (typeof selector === "string") ?
            $node.find(selector).first() : selector;

        // Fit width to the container
        var w = $node.closest(".tree-root").width();
        $span.parents().each(function() {
            w -= $(this).position().left;
        });

        $span.edit_in_place({
            width: w / 2,
            changed: function(s) {
                var e = S.client.hoard.record_action(
                    { type: action,
                      path: nodepath,
                      data: s },
                    function(ea) {
                        ST.action(
                            ea, true,
                            function(/*$newnode*/) {
                                Utils.sometime("update_save");
                            });
                    });
                if (e !== null)
                    S.Dialog.squeak(e.message);
            }
        });
    };
    
    widget.setAlarm = function(data) {
        var $node = this.element;
        if (typeof $node.data("alarm") === "undefined") {
            var $button = $("<button></button>")
                .addClass("tree-alarm");
            $node
                .find(".tree-key")
                .first()
                .before($button);

            this._createIconButton($button,
                                   "alarm",
                                   function() {
                                       SD.alarm($node);
                                       return false;
                                   });

            // Run up the tree, incrementing the alarm count
            $node.parents(".tree-node").each(function($n) {
                var c = $(this).data("alarm-count") || 0;
                $(this).data("alarm-count", c + 1);
                $(this).addClass("tree-has-alarms");
            });
        }
        $node.data("alarm", data);
    };
    
    widget.cancelAlarm = function() {
        var $node = this.element;
        
        // Run up the tree decrementing the alarm count
        $node.parents(".tree-node").each(function($n) {
            var c = $(this).data("alarm-count") || 0;
            c = c - 1;
            $(this).data("alarm-count", c);
            if (c === 0)
                $(this).removeClass("tree-has-alarms");
        });

        this._destroyIconButton($node.find(".tree-alarm").first());
        
        return $node.removeData("alarm");
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
        var widge = this;
        var $node = this.element;
        
        function handleDrag(event, ui) {
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

        function handleStop(event, ui) {
            var $target = $(".drop-target");
            if ($target.length > 1)
                debugger;
            $target.each(function() {
                var $new_parent = $(this);
                $new_parent.removeClass("drop-target");
                var oldpath = $node.tree("getPath");
                var newpath = $new_parent.tree("getPath");
                var e = S.client.hoard.record_action(
                    { type: 'M',
                      path: oldpath,
                      data: newpath
                    },
                    function(ea) {
                        widge.action_M(ea, true);
                        Utils.sometime("update_save");
                    });
                if (e !== null)
                    S.Dialog.squeak(e.message);
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
     * Custom key comparison, such that these keys always bubble
     * to the top of the keys
     */
    ST.sort_prio = [
        TX.tx("A new folder"),
        TX.tx("A new value"),
        TX.tx("User"),
        TX.tx("Pass")
    ];
    
    ST.compare = function(a, b) {
        if (a == b)
            return 0;
        for (var i = 0; i < ST.sort_prio.length; i++) {
            if (a == ST.sort_prio[i])
                return -1;
            if (b == ST.sort_prio[i])
                return 1;
        }
        return (a < b) ? -1 : 1;
    };

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
            if (ST.compare(
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
    
    widget.toggle = function($node) {
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
            ST.undos.push({
                type: "E",
                path: this.getPath(),
                data: $node
                    .find(".tree-value")
                    .first()
                    .text()
            });
        }

        $node
            .find(".tree-value")
            .first()
            .text(action.data);

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
            ST.undos.push({
                type: "N",
                path: this.getPath(),
                data: $node
                    .find(".tree-value")
                    .first()
                    .text()
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
        if (typeof alarm !== "undefined") {
            if (alarm !== action.data) {
                if (undoable) {
                    ST.undos.push({
                        type: "A",
                        path: this.getPath(),
                        data: $node.data("alarm")
                    });
                }
                this.setModified(action.time);
            }
        } else {
            this.setModified(action.time);
            if (undoable) {
                ST.undos.push({
                    type: "C",
                    path: this.getPath()
                });
            }
        }
        this.setAlarm(action.data);
    };

    /**
     * Action handler for cancelling an alarm
     */
    widget.action_C = function(action, undoable) {
        var alarm = this.element.data("alarm");
        if (typeof alarm !== "undefined") {
            if (undoable) {
                ST.undos.push({
                    type: "A",
                    path: this.getPath(),
                    data: alarm
                });
            }
            this.cancelAlarm();
            this.setModified(action.time);
        }
    };

    /**
     * Action handler for moving a node
     */
    widget.action_M = function(action, undoable) {
        var $node = this.element;
        var oldpath = this.getPath();
        var newpath = action.data.slice();
        var $new_parent = ST.getNodeFromPath(newpath);

        // Relocate the node in the DOM
        this._insertInto($new_parent);

        // refresh data-path and update fragment ID
        this.getPath(); // get new path
        $node.scroll_into_view();

        this.setModified(action.time);

        newpath.push(oldpath.pop());
        
        if (undoable) {
            ST.undos.push({
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
            ST.undos.push({
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
    ST.action = function(action, undoable, chain) {
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
                            ST.undos.push({
                                type: "D",
                                path: path
                            });
                        }
                        if (typeof chain !== "undefined")
                            chain(this);
                    }
                });
        } else {
            var $node = ST.getNodeFromPath(action.path);
            $node.tree(
                "action_" + action.type,
                action,
                undoable,
                function () {
                    var $node = this;
                    Utils.sometime("update_save");

                    if (typeof chain !== "undefined") {
                        Utils.soon(function() {
                            chain($node);
                        });
                    }
                });
        }
    };

    /**
     * Node paths are calculated from the DOM tree and are cached in
     * two ways; in a path->node lookup table called ST.cache[], and in
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
        ST.cache[ps] = $node;
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

        delete ST.cache[$node.data("path")];
        $node
            .removeData("path")
        // Reset the path of all subnodes
            .find(".tree-node")
            .each(function() {
                var $s = $(this);
                delete ST.cache[$s.data("path")];
                $s.data("path", null);
            });
    };

    $.widget("squirrel.tree", widget);

    /**
     * Find the jQuery node for a path
     * @param path array of keys representing the path
     * @return a JQuery element
     */
    ST.getNodeFromPath = function(path) {
        var $node = ST.cache[path.join(S.PATHSEP)];
        if (DEBUG && $node && $node.length === 0)
            // Not in the cache, was something not been through get_path?
            debugger;
        return $node;
    };

    /**
     * Return true if there is at least one undoable operation
     */
    ST.can_undo = function() {
        return ST.undos.length !== 0;
    };

    /**
     * Undo the most recent action
     */
    ST.undo = function() {
        if (DEBUG && ST.undos.length === 0) debugger;

        var a = ST.undos.pop();
        a.time = Date.now();
        if (DEBUG) console.debug("Undo " + Hoard.stringify_action(a));
        var res = S.client.hoard.record_action(
            a,
            function(e) {
                ST.action(
                    e, false,
                    function() {
                        // If there are no undos, there can be no modifications.
                        // The hoard status will not be changed, though, so a
                        // save may still be required.
                        if (ST.length === 0)
                            $(".tree-modified").removeClass("tree-modified");
                        Utils.sometime("update_save");
                    });
            });
        if (res !== null)
            SD.squeak({
                title: TX.error(),
                severity: "error",
                message: res.message
            });
    };

})(jQuery, Squirrel);
