/**
 * Functions involved in the management of the DOM tree that represents
 * the content of the client hoard cache.
 *
  * The DOM tree is built and maintained through the use of actions sent
 * to the Squirrel client hoard, which are then passed on in a callback to
 * the DOM tree. Nodes in the DOM tree are never manipulated directly outside
 * this namespace (other than to add the 'modified' class)
 */

/*
 * Massively simplified list view / tree view widget, specific to
 * this application
 */
$.widget("squirrel.treenode", {
    _create: function() {
        // this.element is the object it's called on
        // This will be a div for the root, and an li for any other node
        // this.options is the options passed
        var $node = $(this.element);
        if (!$node.hasClass("treeroot")) {
            // Add open/close button, except on root which is
            // always open.
            var $control = $("<button></button>");
            $control
                .appendTo($node)
                .addClass("open-close")
                .button({
                    mini: true,
                    inline: true,
                    icon: "carat-r",
                    iconpos: "notext"
                });
            $control.parent().on("vclick", function() {
                $node.treenode("toggle");
                return false;
            });
            $node.data("treenode-open", true);
        }
        // Add the children
        $node.append("<ul class='treenode-subnodes'></ul>");
        // Toggle to close, which will hide the ul
        $node.treenode("toggle");
    },

    // Switch from open to closed or vice versa
    toggle: function() {
        var $node = $(this.element);
        if ($node.data("treenode-open")) {
            $node.treenode("close");
        } else {
            $node.treenode("open");
        }
    },

    // Force the node open
    open: function () {
        var $node = $(this.element);
        $node
            .find(".open-close")
            .first()
            .button("option", "icon", "carat-d");
        $node.children(".treenode-subnodes").show();
        $node.data("treenode-open", true);
    },

    // Force the node closed
    close: function () {
        var $node = $(this.element);
        $node
            .find(".open-close")
            .first()
            .button("option", "icon","carat-r");
        $node.children(".treenode-subnodes").hide();
        $node.data("treenode-open", false);
    },

    // Do we need this any more?
    refresh: function() {
        console.debug("Called treenode.refresh");
    }
});

Tree = { // Namespace
    menu: null,
    cache: {},    // Path->node mapping
    undos: []     // undo stack
};

/**
* Root the DOM tree at the given node
*/
Tree.set_root = function($node) {
    "use strict";

    // Don't do this, or you end up with an invisible path component
    // in path strings
    //$node.data("path", "");
    Tree.cache[""] = $node;
};

/**
 * Generate a message for the last modified time, used in the title of nodes.
 */
Tree.set_modified = function($node, time) {
    "use strict";

    var d = new Date(time);
    $node
        .addClass("modified")
        .data("last-time", time)
        .data("last-mod", d.toLocaleString());
};

/**
 * Reconstruct the path for an item from the DOM, populating the
 * node->path->node mappings in the process
 * @param $node a JQuery element. This may be a node, or an element
 * within a node.
 * @return an array containing the path to the node, one string per key
 */
Tree.path = function($node) {
    "use strict";

    if (!$node.hasClass("node"))
        // Get the closest enclosing node
        $node = $node.closest(".node");

    if (DEBUG && (!$node || $node.length === 0))
        debugger; // Internal error: Failed to find node in tree

    // IMPORTANT: root node MUST NOT have data-path or data-key in HTML

    // Lookup shortcut, if set
    var ps = $node.data("path"), path;
    if (typeof ps !== "undefined" && ps !== null)
        return ps.split(Squirrel.PATHSEP);

    // No shortcut, recurse up the tree
    if (typeof $node.data("key") !== "undefined") {
        path = Tree.path($node.parent().closest(".node"));

        path.push($node.data("key"));

        ps = path.join(Squirrel.PATHSEP);

        // node->path shortcut
        $node.data("path", ps);

        // path->node mapping
        if (DEBUG && Tree.cache[ps]
            && Tree.cache[ps] !== $node)
            debugger; // Bad mapping
        Tree.cache[ps] = $node;
    } else
        path = [];

    return path;
};

/**
 * Find the DOM node for a path
 * @param path array of keys representing the path
 * @return a JQuery element
 */
Tree.node = function(path) {
    "use strict";

    var $node = Tree.cache[path.join(Squirrel.PATHSEP)];
    if (DEBUG && $node && $node.length === 0) debugger;
    return $node;
};

/**
 * Custom key comparison, such that "User" and "Pass" always bubble
 * to the top of the keys
 */
Tree.compare = function(a, b) {
    "use strict";

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
* Action handler to construct new node
*/
Tree.action_N = function(action, undoable) {
    "use strict";

    var parent = action.path.slice();
    var key = parent.pop();
    var is_leaf = (typeof action.data !== "undefined" && action.data !== null);

    // Get the container
    var $parent = Tree.node(parent);
    if (!$parent) debugger;
    var $container = $parent.children("ul");
    if (DEBUG && $container.length !== 1) debugger;

    // Create the new node
    var $node = $("<li class='node'></li>")
        .data("key", key);
    var value;

    $("<span class='key'></span>")
        .text(key)
        .appendTo($node);
    if (is_leaf) {
        // Leaf node
        $node.addClass("treeleaf");
        $node.data("is_leaf", true);
        $("<span class='kv_separator'> : </span>")
            .appendTo($node);
        value = action.data;
        $("<span class='value'></span>")
            .text(value)
            .appendTo($node);
    } else {
        // Intermediate node
        $node.data("is_leaf", false);
        $node.addClass("treecollection");
        $node.treenode();
    }

    // Insert-sort into the $container
    var inserted = false;
    $container.children(".node").each(function() {
        if (Tree.compare($(this).data("key"), key) > 0) {
            $node.insertBefore($(this));
            inserted = true;
            return false;
        }
    });
    if (!inserted)
        $container.append($node);


    $node.on("vclick", function() {
        Squirrel.open_menu($node);
        return false;
    });

    // This is a new node, this lookup will side-effect add it to the cache
    var path = Tree.path($node);

    if (undoable) {
        Tree.undos.push({
            type: "D",
            path: path
        });
    }

    Tree.set_modified($node, action.time);

    return $node;
};

/**
 * Action handler for node rename
 */
Tree.action_R = function(action, undoable) {
    "use strict";

    // Detach the li from the DOM
    var $node = Tree.node(action.path);
    var key = action.path[action.path.length - 1]; // record old node name
    var $container = $node.closest("ul");

    Tree.demap($node);

    $node
        .detach()
        .data("key", action.data)
        .find(".key")
        .first()
        .text(action.data);

    // Re-insert the element in it's sorted position
    var inserted = false;
    $container.children("li.node").each(function() {
        if (Tree.compare($(this).data("key"), action.data) > 0) {
            $node.insertBefore($(this));
            inserted = true;
            return false;
        }
    });
    if (!inserted)
        $container.append($node);

    // Reset the path of all subnodes. We have to do this so
    // they get added to Tree.cache. This will also update
    // the mapping for $node.
    $node
        .find(".node")
        .each(function() {
            Tree.path($(this));
        });

    // refresh data-path and update fragment ID
    var p = Tree.path($node); // get new path
    $node.scroll_into_view();

    Tree.set_modified($node, action.time);

    if (undoable) {
        Tree.undos.push({
            type: "R",
            path: p, // no need to slice, not re-used
            data: key
        });
    }

    return $node;
};

/**
 * Action handle for value edit
 */
Tree.action_E = function(action, undoable) {
    "use strict";

    var $node = Tree.node(action.path);

    if (undoable) {
        Tree.undos.push({
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

    Tree.set_modified($node, action.time);
};

/**
 * Action handler for node delete
 */
Tree.action_D = function(action, undoable) {
    "use strict";

    var $node = Tree.node(action.path);

    Tree.demap($node);

    if (undoable) {
        // Not enough - all the subtree would need to be
        // regenerated
        Tree.undos.push({
            type: "N",
            path: action.path.slice(),
            data: $node
                .find(".value")
                .first()
                .text()
        });
    }
    var $parent = $node.parent().closest(".node");

    Tree.set_modified($parent, action.time);

    $node.remove();

    return $parent;
};

/**
 * Action handler for alarm add
 */
Tree.action_A = function(action, undoable) {
    "use strict";

    var $node = Tree.node(action.path);

    // Check there's an alarm already
    var $alarm = $node.children(".alarm");
    if ($alarm.length > 0) {
        if ($alarm.data("alarm") !== action.data) {
            if (undoable) {
                Tree.undos.push({
                    type: "A",
                    path: action.path.slice(),
                    data: $alarm.data("alarm")
                });
            }
            Tree.set_modified($node, action.time);
            $alarm.data("alarm", action.data);
        }
    } else {
        Tree.set_modified($node, action.time);
        var $button = $("<button 'ui-btn-inline'></button>");
        $node.prepend($button);
        var $enhanced_button = $button
            .button(
                {
                    icon: "clock",
                    iconpos: "notext",
                    mini: true,
                    inline: true
                })
            .parent();
        if (undoable) {
            Tree.undos.push({
                type: "C",
                path: action.path.slice()
            });
        }
        $enhanced_button
            .data("alarm", action.data)
            .addClass("alarm")
            .on("vclick", function() {
                Page_get("alarm").open({ node: $node, path: Tree.path($node) });
                return false;
            });
    }

    return $node;
};

/**
 * Action handler for cancelling an alarm
 */
Tree.action_C = function(action, undoable) {
    "use strict";

    var $node = Tree.node(action.path);
    var $alarm = $node.children(".alarm");
    if ($alarm.length > 0) {
        if (undoable) {
            Tree.undos.push({
                type: "A",
                path: action.path.slice(),
                data: $alarm.data("alarm")
            });
        }
        $alarm.children("button").button("destroy").remove();
        Tree.set_modified($node, action.time);
    }

    return $node;
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
Tree.action = function(action, chain, undoable) {
    "use strict";

    var $node = Tree["action_" + action.type](action, undoable);

    Utils.sometime("update_save");

    if (typeof chain !== "undefined") {
        Utils.soon(function() {
            chain($node);
        });
    }
};

/**
 * @private
 * Remove the node (and all subnodes) from the node->path->node mappings
 * @param $node node to remove
 */
Tree.demap = function($node) {
    "use strict";

    if (!$node.hasClass("node"))
        $node = $node.closest(".node");

    delete Tree.cache[$node.data("path")];
    $node
        .data("path", null)
        // Reset the path of all subnodes
        .find(".node")
        .each(function() {
            var $s = $(this);
            delete Tree.cache[$s.data("path")];
            $s.data("path", null);
        });
};

/**
 * Return true if there is at least one undoable operation
 */
Tree.can_undo = function() {
    "use strict";

    return Tree.undos.length !== 0;
};

/**
 * Undo the most recent action
 */
Tree.undo = function() {
    "use strict";

    if (DEBUG && Tree.undos.length === 0) debugger;

    var a = Tree.undos.pop();
    a.time = Date.now();
    if (DEBUG) console.debug("Undo " + Hoard.stringify_action(a));
    var res = Squirrel.client.hoard.record_action(
        a,
        function(e) {
            Tree.action(
                e,
                function() {
                    // If there are no undos, there can be no modifications.
                    // The hoard status will not be changed, though, so a
                    // save may still be required.
                    if (Tree.undos.length === 0)
                        $(".modified").removeClass("modified");
                    Utils.sometime("update_save");
                    Utils.sometime("update_tree");
                });
        });
    if (res !== null)
        Page_get("activity").open({
            title: TX.tx("Error"),
            message: res.message
        });
};
