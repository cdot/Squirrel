/*@preserve Copyright (C) 2015 Crawford Currie http://c-dot.co.uk license MIT*/

/**
 * Functions involved in the management of the DOM tree that represents
 * the content of the client hoard cache.
 *
 * Each node in the client hoard cache is represented in the DOM by an
 * LI node in a UL/LI tree. A node has structure as follows:
 * classes:
 *   treenode (always)
 *   treenode-leaf - if this is a leaf node
 *   treenode-collection - if this is an intermediate node   
 *   modified (if UI modified)
 *   treenode-root - only on the root of the tree (which need not be an LI)
 * data:
 *   data-key: the key name the node is for (simple name, not a path)
 *        NOTE: the root doesn't have a data-key
 *   data-value: if this is a leaf node
 *   data-path: the full pathname of the node (string)
 *   data-alarm: if there is an alarm on the node
 * children:
 *   various buttons used to open/close nodes
 *   div.treenode-info:
 *      span.key: target for click events
 *          text: the key name
 *      span.kv_separator: if treenode-leaf
 *      span.value: if this is a leaf node, text is the leaf value,
 *          should be same as data-value
 *   ul: child treenode, if treenode-collection
 *
 * The DOM tree is built and maintained through the use of actions sent
 * to the Squirrel client hoard, which are then passed on in a callback to
 * the DOM tree. Nodes in the DOM tree are never manipulated directly outside
 * this namespace (other than to add the 'modified' class)
 *
 * Nodes are managed using the squirrel.treenode widget. Additional
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

    /**
     * Baseclass of treenode widgets. These are customised for different
     * environments e.g. desktop with raw jQuery, mobile wih jQuery mobile.
     */
    $.widget("squirrel.treenode", {
        _create: function() {

            // this.element is the object it's called on
            // This will be a div for the root, and an li for any other node
            // this.options is the options passed
            var $node = $(this.element);
            var is_leaf = false;
            var is_root = !this.options.path;
            var parent, key = "", $parent;

            if (!is_root) {
                parent = this.options.path;
                key = parent.pop();
                $parent = ST.get_node(parent);
                $node.data("key", key);
            }

            $node.addClass("treenode");

            if (is_root) {
                ST.cache[""] = $node;
                $node.addClass("treenode-root");
            }
            else if (typeof this.options.value !== "undefined"
                     && this.options.value !== null) {

                $node
                    .data("value", this.options.value)
                    .data("is_leaf", true)
                    .addClass("treenode-leaf");
                is_leaf = true;
            }
            else { 
                // Add open/close button on running nodes, except the root
                // which is always open
                var $control = $("<button></button>")
                    .addClass("open-close");
                $node
                    .prepend($control)
                    .treenode("icon_button",
                              "create",
                              $control,
                              "closed",
                              function() {
                                  $node.treenode("toggle");
                                  return false;
                              })
                    .addClass("treenode-open");
            }

            if (!is_root) {
                // Create the key span
                var $key = $("<span></span>")
                    .addClass("key")
                    .text(key);

                var $div = $("<div></div>")
                    .addClass("treenode-info")
                    .appendTo($node)
                    .append($key);
                
                if (is_leaf) {
                    $("<span> : </span>")
                        .addClass("kv_separator")
                        .appendTo($div);
                    $("<span></span>")
                        .appendTo($div)
                        .addClass("value")
                        .text(this.options.value);
                }
            }

            if (!is_leaf) {
                $node
                    .addClass("treenode-collection")
                    .append("<ul class='treenode-subnodes'></ul>");
            }

            // Close to hide the children (or to open the root)
            $node.treenode("toggle");

            if ($parent) {
                // Insert-sort into the $parent
                var inserted = false;
                var $container = $parent.find("ul").first();
                $container.children(".treenode").each(function() {
                    if (ST.compare(
                        $(this).data("key"), key) > 0) {
                        $node.insertBefore($(this));
                        inserted = true;
                        return false;
                    }
                });
                if (!inserted)
                    $container.append($node);
            }

            // Platform-specific subclass provides handlers
            $node.treenode("attach_handlers");

            if (typeof this.options.time !== "undefined")
                $node.treenode("set_modified", this.options.time);

            if (this.options.on_create)
                this.options.on_create.call($node);
        },

        // Switch from open to closed or vice versa
        toggle: function() {

            var $node = $(this.element);
            if ($node.hasClass("treenode-open"))
                return $node.treenode("close");
            return $node.treenode("open");
        },

        // Force the node open
        open: function () {

            var $node = $(this.element);
            if ($node.hasClass("treenode-open"))
                return $node;
            return $node
                .addClass("treenode-open")
                .treenode("icon_button", "change", ".open-close:first", "open")
                .children(".treenode-subnodes")
                .scroll_into_view()
                .show();
        },

        // Force the node closed
        close: function () {

            var $node = $(this.element);
            if (!$node.hasClass("treenode-open"))
                return $node;
            return $node
                .removeClass("treenode-open")
                .treenode("icon_button", "change", ".open-close:first", "closed")
                .children(".treenode-subnodes")
                .hide();
        },

        /**
         * Abstract method for manipulating buttons. Subclasses are expected
         * to override this method.
         * @param action one of"create", "change", or "destroy".
         * @param selector may be a string selector or a jQuery object,
         * and should uniquely identify the button to be manipulated.
         * @param icon is the abstract name of the icon to use, one
         * of "open", "closed" or "alarm".
         * @param on_click may be a function to handle click events,
         * and is only used when action is "create".
         */
        icon_button: function(action, selector, icon, on_click) {
            throw "Expected icon_button to be subclassed";
        },

        /**
         * Attach platforms-specific handlers to parts of the node.
         * This has to be platform-specific because different platforms
         * handle nodes differently.
         */
        attach_handlers: function() {
            throw "Expected attach_handlers to be subclassed";
        },

        /**
         * Edit a node in place, used for renaming and revaluing.
         * @param what either "key" or "value" depending on what is to be
         * edited.
         */
        /**
         * Implements superclass edit.
         * Requires edit_in_place.
         */
        edit: function(what) {
            var $node = $(this.element);

            var $span = $node.find("." + what).first();

            // Fit width to the container
            var w = $("#sites-node").width();
            $span.parents().each(function() {
                w -= $(this).position().left;
            });

            $span.edit_in_place({
                width: w,
                changed: function(s) {
                    var e = S.client.hoard.record_action(
                        { type: what === "key" ? "R" : "E",
                          path: $node.treenode("get_path"),
                          data: s },
                        function(ea) {
                            ST.action(
                                ea,
                                function(/*$newnode*/) {
                                    Utils.sometime("update_save");
                                }, true);
                        });
                    if (e !== null)
                        SD.squeak(e.message);
                }
            });
        },

        // Do we need this any more?
        refresh: function() {
            //console.debug("Called treenode.refresh");
        },

        set_alarm: function(data) {
            var $node = $(this.element);
            if (typeof $node.data("alarm") === "undefined") {
                var $button = $("<button></button>")
                    .addClass("alarm");
                $node
                    .find(".key")
                    .first()
                    .before($button);

                $node
                    .treenode(
                        "icon_button",
                        "create",
                        $button,
                        "alarm",
                        function() {
                            SD.alarm($node);
                            return false;
                        });
            }
            $node.data("alarm", data);
        },

        cancel_alarm: function() {
            return $(this.element)
                .removeData("alarm")
                .treenode("icon_button", "destroy", ".alarm:first");
        },

        ring_alarm: function() {
            return $(this.element)
                .find(".alarm")
                .addClass("expired")
                .find(".ui-icon-squirrel-alarm")
                .removeClass("ui-icon-squirrel-alarm")
                .addClass("ui-icon-squirrel-rang");
        },

        /**
         * Generate a message for the last modified time, used in
         * the title of nodes.
         */
        set_modified: function(time) {
            var d = new Date(time);
            return $(this.element)
                .addClass("modified")
                .data("last-time", time);
        },

        /**
         * Reconstruct the path for an item from the DOM, populating the
         * node->path->node mappings in the process
         * @param $node a JQuery element. This may be a node, or an element
         * within a node.
         * @return an array containing the path to the node, one string per key
         */
        get_path: function() {
            var $node = $(this.element);

            if (!$node.hasClass("treenode"))
                // Get the closest enclosing node
                $node = $node.closest(".treenode");
            
            if (DEBUG && (!$node || $node.length === 0))
                debugger; // Internal error: Failed to find node in tree
            
            // IMPORTANT: root node MUST NOT have data-path or data-key in HTML
            
            // Lookup shortcut, if set
            var ps = $node.data("path"), path;
            if (typeof ps !== "undefined" && ps !== null)
                return ps.split(S.PATHSEP);
            
            // No shortcut, recurse up the tree
            if (typeof $node.data("key") !== "undefined") {
                path = $node.parent().closest(".treenode").treenode("get_path");
                
                path.push($node.data("key"));
                
                ps = path.join(S.PATHSEP);
                
                // node->path shortcut
                $node.data("path", ps);
                
                // path->node mapping
                if (DEBUG && ST.cache[ps]
                    && ST.cache[ps] !== $node)
                    debugger; // Bad mapping
                ST.cache[ps] = $node;
            } else
                path = [];
            
            return path;
        }
    });

    /**
     * Find the DOM node for a path
     * @param path array of keys representing the path
     * @return a JQuery element
     */
    ST.get_node = function(path) {
        var $node = ST.cache[path.join(S.PATHSEP)];
        if (DEBUG && $node && $node.length === 0) debugger;
        return $node;
    };

    /**
     * @private
     * Custom key comparison, such that "User" and "Pass" always bubble
     * to the top of the keys
     */
    ST.compare = function(a, b) {
        a = a.toLowerCase(); b = b.toLowerCase();
        if (a === "user") // the lowest possible key
            return (b === "user") ? 0 : -1;
        if (b === "user")
            return 1;
        if (a === "pass") // The next lowest key
            return (b === "pass") ? 0 : -1;
        if (b === "pass")
            return 1;
        return (a === b) ? 0 : (a < b) ? -1 : 1;
    };

    /**
     * @private
     * Action handler to construct new node
     */
    ST.action_N = function(action, undoable, follow) {
        // Create the new node. Automatically adds it to the right parent.
        $("<li></li>")
            .treenode({
                path: action.path,
                value: action.data,
                time: action.time,
                on_create: function() {
                    // This is a new node, this lookup will side-effect add it
                    // to the cache, so do it outside the condition
                    var path = $(this).treenode("get_path");

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
                    .find(".value")
                    .first()
                    .text()
            });
        }

        $node
            .find(".value")
            .first()
            .text(action.data);

        $node.treenode("set_modified", action.time);

        follow.call($node);
    };

    /**
     * @private
     * Action handler for node delete
     */
    ST.action_D = function(action, undoable, follow) {
        var $node = ST.get_node(action.path);

        ST.demap($node);

        if (undoable) {
            // Not enough - all the subtree would need to be
            // regenerated
            ST.undos.push({
                type: "N",
                path: action.path.slice(),
                data: $node
                    .find(".value")
                    .first()
                    .text()
            });
        }
        var $parent = $node.parent().closest(".treenode");

        $parent.treenode("set_modified", action.time);

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
                $node.treenode("set_modified", action.time);
            }
        } else {
            $node.treenode("set_modified", action.time);
            if (undoable) {
                ST.undos.push({
                    type: "C",
                    path: action.path.slice()
                });
            }
        }
        $node.treenode("set_alarm", action.data);

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
            $node.treenode("cancel_alarm");
            $node.treenode("set_modified", action.time);
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
        var $container = $node.closest("ul");

        ST.demap($node);

        $node
            .detach()
            .data("key", action.data)
            .find(".key")
            .first()
            .text(action.data);

        // Re-insert the element in it's sorted position
        var inserted = false;
        $container.children(".treenode").each(function() {
            if (ST.compare($(this).data("key"), action.data) > 0) {
                $node.insertBefore($(this));
                inserted = true;
                return false;
            }
        });
        if (!inserted)
            $container.append($node);

        // Reset the path of all subnodes. We have to do this so
        // they get added to ST.cache. This will also update
        // the mapping for $node.
        $node
            .find(".treenode")
            .each(function() {
                $(this).treenode("get_path");
            });

        // refresh data-path and update fragment ID
        var p = $node.treenode("get_path"); // get new path
        $node.scroll_into_view();

        $node.treenode("set_modified", action.time);

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
     * @param chain function to call once the action has been played. May
     * be undefined. Passed the modified node.
     * @param undoable set true if the inverse of this action is to be added
     * to the undo chain.
     */
    ST.action = function(action, chain, undoable) {
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
     * @private
     * Remove the node (and all subnodes) from the node->path->node mappings
     * @param $node node to remove
     */
    ST.demap = function($node) {
        if (!$node.hasClass("treenode"))
            $node = $node.closest(".treenode");

        delete ST.cache[$node.data("path")];
        $node
            .data("path", null)
        // Reset the path of all subnodes
            .find(".treenode")
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
                    e,
                    function() {
                        // If there are no undos, there can be no modifications.
                        // The hoard status will not be changed, though, so a
                        // save may still be required.
                        if (ST.length === 0)
                            $(".modified").removeClass("modified");
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
