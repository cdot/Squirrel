/*@preserve Copyright (C) 2015 Crawford Currie http://c-dot.co.uk license MIT*/

/* global DEBUG */
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
    var map_icon = {
        "closed": "ui-icon-squirrel-folder-closed",
        "open": "ui-icon-squirrel-folder-open",
        "alarm": "ui-icon-squirrel-alarm"
    };

    ST.cache = {};    // Path->node mapping
    ST.undos = [];    // undo stack

    $.widget("squirrel.tree", {
        _create: function() {

            // this.element is the object it's called on
            // This will be a div for the root, and an li for any other node
            // this.options is the options passed
            ST.create($(this.element), this.options);
        }
    });

    ST.create = function($node, options) {
        var is_leaf = false;
        var is_root = !options.path;
        var parent, key = "", $parent;

        if (!is_root) {
            parent = options.path;
            key = parent.pop();
            $parent = ST.get_node(parent);
            $node.data("key", key);
        }

        $node.addClass("tree-node");

        if (is_root) {
            ST.cache[""] = $node;
            $node.addClass("tree-root");
            $node.data("path", "");
        }
        else if (typeof options.value !== "undefined"
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
            $node
                .prepend($control)
                .addClass("tree-open");
            ST.icon_button($node,
                           "create",
                           $control,
                           "folder-closed",
                           function() {
                               ST.toggle($node);
                               return false;
                           });
        }

        if (!is_root) {
            var $info = $("<div></div>")
                .addClass("tree-info")
                .appendTo($node);
            
            // Create the key span
            $("<span></span>")
                .appendTo($info)
                .addClass("tree-key")
                .text(key)
                .on($.isTouchCapable() ? "doubletap" : "dblclick", function(e) {
                    e.preventDefault();
                    ST.edit($node, ".tree-key", "R");
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
                            ST.edit($node, ".tree-value", "E");
                        });
            }
            
            $info.hover(
                function(/*evt*/) {
                    if ($(this).find(".in_place_editor").length === 0) {
                        var $status = $("<div></div>");
                        $status
                            .addClass("tree-lastmod");
                        $(this)
                            .addClass("tree-hover")
                            .append($status);
                        
                        var mod = new Date($node.data("last-time"))
                            .toLocaleString();
                        $status.append("<span>" + mod + " </span");
                        
                        if (typeof $node.data("alarm") !== "undefined") {
                            $status.append(
                                '<div class="inline-icon ui-icon-squirrel-alarm"></div>');
                            $status.append(
                                '<div class="tree-info">'
                                    + Utils.deltaTimeString(
                                        new Date($node.data("last-time")
                                                 + $node.data("alarm")
                                                 * Utils.MSPERDAY))
                                    + "</div>");
                        }
                        return false;
                    }
                },
                function(/*evt*/) {
                    $(this)
                        .removeClass("tree-hover")
                        .find(".tree-lastmod")
                        .remove();
                });
        }
        
        if (!is_leaf) {
            $node
                .addClass("tree-collection")
                .append("<ul class='sortable tree-subnodes'></ul>");
        }

        // Close to hide the children (or to open the root)
        ST.toggle($node);

        if (!is_root)
            ST.makeDraggable($node);
        
        if ($parent)
            // Insert-sort into the $parent
            ST.relocate($node, $parent);

        if (typeof options.time !== "undefined")
            ST.set_modified($node, options.time);

        if (options.on_create)
            options.on_create.call($node);
    }

    /**
     * @param action one of"create", "change", or "destroy".
     * @param selector may be a string selector or a jQuery object,
     * and should uniquely identify the button to be manipulated.
     * @param icon is the abstract name of the icon to use, one
     * of "open", "closed" or "alarm".
     * @param on_click may be a function to handle click events,
     * and is only used when action is "create".
     */
    ST.icon_button = function($node, action, selector, icon, on_click) {
        var $control = (typeof selector === "string") ?
            $node.find(selector) : selector;

        switch (action) {
        case "create":
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
            break;
        case "change":
            if ($control.length > 0)
                $control.button(
                    "option", "icons", {
                        primary: "ui-icon-squirrel-" + icon });
            break;
        case "destroy":
            $control.remove();
            break;
        }
        return $node;
    };
    
    /**
     * Requires edit_in_place. selector may be a jquery selector or
     * an object.
     * @param selector object of selector string
     * @param action 'R'ename or 'E'dit
     */
    ST.edit = function($node, selector, action) {
        var $span = (typeof selector === "string") ?
            $node.find(selector).first() : selector;

        // Fit width to the container
        var w = $("#sites-node").width();
        $span.parents().each(function() {
            w -= $(this).position().left;
        });

        $span.edit_in_place({
            width: w / 2,
            changed: function(s) {
                var e = S.client.hoard.record_action(
                    { type: action,
                      path: ST.get_path($node),
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
    
    ST.set_alarm = function($node, data) {
        if (typeof $node.data("alarm") === "undefined") {
            var $button = $("<button></button>")
                .addClass("tree-alarm");
            $node
                .find(".tree-key")
                .first()
                .before($button);

            ST.icon_button($node,
                           "create",
                           $button,
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
    
    ST.cancel_alarm = function($node) {
        // Run up the tree decrementing the alarm count
        $node.parents(".tree-node").each(function($n) {
            var c = $(this).data("alarm-count") || 0;
            c = c - 1;
            $(this).data("alarm-count", c);
            if (c === 0)
                $(this).removeClass("tree-has-alarms");
        });

        ST.icon_button($node, "destroy", ".tree-alarm:first");
        
        return $node.removeData("alarm");
    };

    ST.ring_alarm = function($node) {
        $node
            .find(".tree-alarm")
            .addClass("tree-expired")
            .find(".ui-icon-squirrel-alarm")
            .removeClass("ui-icon-squirrel-alarm")
            .addClass("ui-icon-squirrel-rang");
    };
    
    ST.makeDraggable = function($node) {
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
                var oldpath = ST.get_path($node);
                var newpath = ST.get_path($new_parent);
                var e = S.client.hoard.record_action(
                    { type: 'M',
                      path: oldpath,
                      data: newpath
                    },
                    function(ea) {
                        ST.action(
                            ea, true,
                            function() {
                                Utils.sometime("update_save");
                            });
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
     * Find the jQuery node for a path
     * @param path array of keys representing the path
     * @return a JQuery element
     */
    ST.get_node = function(path) {
        var $node = ST.cache[path.join(S.PATHSEP)];
        if (DEBUG && $node && $node.length === 0)
            // Not in the cache, was something not been through get_path?
            debugger;
        return $node;
    };

    /**
     * Find the path for a DOM node or jQuery node.
     * @return an array containing the path to the node, one string per key
     */
    ST.get_path = function($node) {       
        if ($node.hasClass("tree-root"))
            return [];
        if (!$node.hasClass("tree-node"))
            debugger;

        // IMPORTANT: root node MUST NOT have data-path in HTML
            
        // Lookup shortcut, if set
        var ps = $node.data("path");
        if (!ps) {
            ST.addToCaches($node);
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
    ST.relocate = function($node, $parent) {
        // First decouple from the old parent
        ST.removeFromCaches($node);
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
    ST.set_modified = function($node, time) {
        var d = new Date(time);
        return $node
            .addClass("tree-modified")
            .data("last-time", time);
    };

    ST.open = function($node) {
        if ($node.hasClass("tree-open"))
            return $node;
        ST.icon_button($node, "change",
                       ".tree-open-close:first", "folder-open");
        return $node
            .addClass("tree-open")
            .children(".tree-subnodes")
            .scroll_into_view()
            .show();
    };

    ST.close = function($node) {
        if (!$node.hasClass("tree-open"))
            return $node;
        ST.icon_button($node, "change",
                       ".tree-open-close:first", "folder-closed");
        return $node
            .removeClass("tree-open")
            .children(".tree-subnodes")
            .hide();
    };
    
    ST.toggle = function($node) {
        if ($node.hasClass("tree-open"))
            return ST.close($node);
        return ST.open($node);
    };

    /**
     * @private
     * Action handler to construct new node
     */
    ST.action_N = function(action, undoable, follow) {
        // Create the new node. Automatically adds it to the right parent.
        $("<li></li>")
            .tree({
                path: action.path,
                value: action.data,
                time: action.time,
                on_create: function() {
                    // get_path will update the caches on the fly with the
                    // new node
                    var path = ST.get_path(this);
                    if (undoable) {
                        ST.undos.push({
                            type: "D",
                            path: path
                        });
                    }
                    follow.call(this);
                }
            });
    };

    /**
     * @private
     * Action handle for value edit
     */
    ST.action_E = function(action, undoable, follow) {
        var $node = ST.get_node(action.path);

        if (undoable) {
            ST.undos.push({
                type: "E",
                path: action.path.slice(),
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

        ST.set_modified($node, action.time);

        follow.call($node);
    };

    /**
     * @private
     * Action handler for node delete
     */
    ST.action_D = function(action, undoable, follow) {
        var $node = ST.get_node(action.path);

        ST.removeFromCaches($node);

        if (undoable) {
            // Not enough - all the subtree would need to be
            // regenerated
            ST.undos.push({
                type: "N",
                path: action.path.slice(),
                data: $node
                    .find(".tree-value")
                    .first()
                    .text()
            });
        }

        var $parent = $node.parent().closest(".tree-node");
        ST.set_modified($parent, action.time);

        $node.remove();

        follow.call($node);
    };

    /**
     * @private
     * Action handler for alarm add
     */
    ST.action_A = function(action, undoable, follow) {
        var $node = ST.get_node(action.path);

        // Check there's an alarm already
        var alarm = $node.data("alarm");
        if (typeof alarm !== "undefined") {
            if (alarm !== action.data) {
                if (undoable) {
                    ST.undos.push({
                        type: "A",
                        path: action.path.slice(),
                        data: $node.data("alarm")
                    });
                }
                ST.set_modified($node, action.time);
            }
        } else {
            ST.set_modified($node, action.time);
            if (undoable) {
                ST.undos.push({
                    type: "C",
                    path: action.path.slice()
                });
            }
        }
        ST.set_alarm($node, action.data);

        follow.call($node);
    };

    /**
     * Action handler for cancelling an alarm
     */
    ST.action_C = function(action, undoable, follow) {
        var $node = ST.get_node(action.path);
        var alarm = $node.data("alarm");
        if (typeof alarm !== "undefined") {
            if (undoable) {
                ST.undos.push({
                    type: "A",
                    path: action.path.slice(),
                    data: alarm
                });
            }
            ST.cancel_alarm($node);
            ST.set_modified($node, action.time);
        }

        follow.call($node);
    };

    /**
     * Action handler for moving a node
     */
    ST.action_M = function(action, undoable, follow) {
        var oldpath = action.path.slice();
        var newpath = action.data.slice();

        var $node = ST.get_node(oldpath);
        var $new_parent = ST.get_node(newpath);

        // Relocate the node in the DOM
        ST.relocate($node, $new_parent);

        // refresh data-path and update fragment ID
        var p = ST.get_path($node); // get new path
        $node.scroll_into_view();

        ST.set_modified($node, action.time);

        newpath.push(oldpath.pop());
        
        if (undoable) {
            ST.undos.push({
                type: "M",
                path: newpath,
                data: oldpath
            });
        }

        follow.call($node);
    };

    /**
     * Action handler for node rename
     */
    ST.action_R = function(action, undoable, follow) {
        // Detach the li from the DOM
        var $node = ST.get_node(action.path);
        var key = action.path[action.path.length - 1]; // record old node name

        $node
            .data("key", action.data)
            .find(".tree-key")
            .first()
            .text(action.data);

        // Re-insert the element in it's sorted position
        ST.relocate($node, $node.parent().closest(".tree-collection"));

        // refresh data-path and update fragment ID
        var p = ST.get_path($node); // get new path
        $node.scroll_into_view();

        ST.set_modified($node, action.time);

        if (undoable) {
            ST.undos.push({
                type: "R",
                path: p, // no need to slice, not re-used
                data: key
            });
        }

        follow.call($node);
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
        ST["action_" + action.type](
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
    };

    /**
     * Node paths are calculated from the DOM tree and are cached in
     * two ways; in a path->node lookup table called ST.cache[], and in
     * a path->node lookup using a data("path") field on the
     * node, which maps to the S.PATHSEP separated path string.
     * @param $node either DOM node or jQuery node
     */
    ST.addToCaches = function($node, path) {
        if (!path)
            path = ST.get_path($node.parent().closest(".tree-node"));

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
    ST.removeFromCaches = function($node) {
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
