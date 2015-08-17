/**
 * Functions involved in the management of the DOM tree that represents
 * the content of the client hoard cache.
 *
 * Each node in the client hoard cache is represented in the DOM by an
 * LI node (or DIV node for the root) in a UL/LI tree. This node has
 * structure as follows:
 * classes:
 *   node (always)
 *   modified (if UI modified)
 * data:
 *   key, the key name the node is for (simple name, not a path)
 *   path: the full pathname of the node (string)
 * children:
 *   DIV: class=node_div
 *     target for tap-hold events. Target for mousover, taphold, and
 *     click events on collections (open, close subtree)
 *     classes:
 *         treeleaf - if this is a leaf node
 *         treecollection - if this is an intermediate node   
 *     children:
 *        span: class=key target for click events
 *           text: the key name
 *        span: class=kv_separator
 *        span: class=value - if this is a leaf node, text is the leaf value
 *
 * The DOM tree is built and maintained through the use of actions sent
 * to the Squirrel client hoard, which are then passed on in a callback to
 * the DOM tree. Nodes in the DOM tree are never manipulated directly outside
 * this namespace (other than to add the 'modified' class)
 */
Squirrel.Tree = { // Namespace
    cache: {},    // Path->node mapping
    undos: []     // undo stack
};

/**
* Root the DOM tree at the given node
*/
Squirrel.Tree.set_root = function($node) {
    "use strict";

    // Don't do this, or you end up with an invisible path component
    // in path strings
    //$node.data("path", "");
    Squirrel.Tree.cache[""] = $node;
};

/**
 * Generate a message for the last modified time, used in the title of nodes.
 */
Squirrel.Tree.set_modified = function($node, time) {
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
Squirrel.Tree.path = function($node) {
    "use strict";

    if (!$node.hasClass("node"))
        $node = $node.closest(".node");

    if (DEBUG && (!$node || $node.length === 0))
        debugger; // Internal error: Failed to find node in tree

    // IMPORTANT: root node MUST NOT have data-path or data-key in HTML
    var ps = $node.data("path"), path;
    if (typeof ps !== "undefined" && ps !== null)
        return ps.split(Squirrel.PATHSEP);

    if (typeof $node.data("key") !== "undefined") {
        path = Squirrel.Tree.path($node.parent().closest(".node"));

        path.push($node.data("key"));

        ps = path.join(Squirrel.PATHSEP);

        // node->path mapping
        $node.data("path", ps);

        // path->node mapping
        if (DEBUG && Squirrel.Tree.cache[ps] && Squirrel.Tree.cache[ps] !== $node)
            debugger; // Bad mapping
        Squirrel.Tree.cache[ps] = $node;
    } else
        path = [];

    return path;
};

/**
 * Find the DOM node for a path
 * @param path arry of keys representing the path
 * @return a JQuery element
 */
Squirrel.Tree.node = function(path) {
    "use strict";

    var $node = Squirrel.Tree.cache[path.join(Squirrel.PATHSEP)];
    if (DEBUG && $node && $node.length === 0) debugger;
    return $node;
};

/**
 * Custom key comparison, such that "User" and "Pass" always bubble
 * to the top of the keys
 */
Squirrel.Tree.compare = function(a, b) {
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
Squirrel.Tree.action_N = function(action, undoable) {
    "use strict";

    var parent = action.path.slice();
    var key = parent.pop();

    // Get the container
    var $parent = Squirrel.Tree.node(parent);
    if (!$parent) debugger;
    var $container = $parent.children("ul");
    if (DEBUG && $container.length !== 1) debugger;

    // Create the new node
    var $node = $("<li class='node'></li>")
        .data("key", key);

    // Create the div that supports mousover and taphold events
    var $div = $("<div class='node_div'></div>")
        .appendTo($node);

    // Create the key span
    $("<span class='key'></span>")
        .text(key)
        .appendTo($div);

    if (typeof action.data !== "undefined" && action.data !== null) {
        // Leaf node
        $div.addClass("treeleaf");
        $("<span class='kv_separator'> : </span>")
            .appendTo($div);
        $("<span class='value'></span>")
            .text(action.data)
            .appendTo($div);
    } else {
        // Intermediate node
        $div.addClass("treecollection");
        $("<ul></ul>")
            .appendTo($node);
    }

    // Insert-sort into the $container
    var inserted = false;
    $container.children("li.node").each(function() {
        if (Squirrel.Tree.compare($(this).data("key"), key) > 0) {
            $node.insertBefore($(this));
            inserted = true;
            return false;
        }
    });
    if (!inserted)
        $container.append($node);

    // Make sure the cache is updated with the new node
    var p = Squirrel.Tree.path($node);

    if (undoable) {
        Squirrel.Tree.undos.push({
            type: "D",
            path: p
        });
    }

    Squirrel.Tree.set_modified($node, action.time);

    Squirrel.attach_node_handlers($node);

    return $node;
};

/**
 * Action handler for node rename
 */
Squirrel.Tree.action_R = function(action, undoable) {
    "use strict";

    // Detach the li from the DOM
    var $node = Squirrel.Tree.node(action.path);
    var key = action.path[action.path.length - 1]; // record old node name
    var $container = $node.closest("ul");

    Squirrel.Tree.demap($node);

    $node
        .detach()
        .data("key", action.data)
        .children(".node_div")
        .children("span.key")
        .text(action.data);

    // Re-insert the element in it's sorted position
    var inserted = false;
    $container.children("li.node").each(function() {
        if (Squirrel.Tree.compare($(this).data("key"), action.data) > 0) {
            $node.insertBefore($(this));
            inserted = true;
            return false;
        }
    });
    if (!inserted)
        $container.append($node);

    // Reset the path of all subnodes. We have to do this so
    // they get added to Squirrel.Tree.cache. This will also update
    // the mapping for $node.
    $node
        .find(".node")
        .each(function() {
            Squirrel.Tree.path($(this));
        });

    // refresh data-path and update fragment ID
    var p = Squirrel.Tree.path($node); // get new path
    $node.scroll_into_view();

    Squirrel.Tree.set_modified($node, action.time);

    if (undoable) {
        Squirrel.Tree.undos.push({
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
Squirrel.Tree.action_E = function(action, undoable) {
    "use strict";

    var $node = Squirrel.Tree.node(action.path);

    if (undoable) {
        Squirrel.Tree.undos.push({
            type: "E",
            path: action.path.slice(),
            data: $node.children(".node_div")
                .children("span.value")
                .text()
        });
    }

    $node
        .children(".node_div")
        .children("span.value")
        .text(action.data);

    Squirrel.Tree.set_modified($node, action.time);
};

/**
 * Action handler for node delete
 */
Squirrel.Tree.action_D = function(action, undoable) {
    "use strict";

    var $node = Squirrel.Tree.node(action.path);

    Squirrel.Tree.demap($node);

    if (undoable) {
        // Not enough - all the subtree would need to be
        // regenerated
        Squirrel.Tree.undos.push({
            type: "N",
            path: action.path.slice(),
            data: $node.children(".node_div")
                .children("span.value")
                .text()
        });
    }
    var $parent = $node.parent().closest(".node");

    Squirrel.Tree.set_modified($parent, action.time);

    $node.remove();

    return $parent;
};

/**
 * Action handler for alarm add
 */
Squirrel.Tree.action_A = function(action, undoable) {
    "use strict";

    var $node = Squirrel.Tree.node(action.path);

    // Check there's an alarm already
    var $alarm = $node.children(".alarm");
    if ($alarm.length > 0) {
        if ($alarm.data("alarm") !== action.data) {
            if (undoable) {
                Squirrel.Tree.undos.push({
                    type: "A",
                    path: action.path.slice(),
                    data: $alarm.data("alarm")
                });
            }
            Squirrel.Tree.set_modified($node, action.time);
            $alarm.data("alarm", action.data);
        }
    } else {
        Squirrel.Tree.set_modified($node, action.time);
        $("<button></button>")
            .addClass("alarm")
            .data("alarm", action.data)
            .button(
                {
                    icons: {
                        primary: "squirrel-icon-alarm"
                    },
                    text: false
                })
            .prependTo($node);
        if (undoable) {
            Squirrel.Tree.undos.push({
                type: "C",
                path: action.path.slice()
            });
        }
        Squirrel.attach_alarm_handlers($node);
    }

    return $node;
};

/**
 * Action handler for cancelling an alarm
 */
Squirrel.Tree.action_C = function(action, undoable) {
    "use strict";

    var $node = Squirrel.Tree.node(action.path);
    var $alarm = $node.children(".alarm");
    if ($alarm.length > 0) {
        if (undoable) {
            Squirrel.Tree.undos.push({
                type: "A",
                path: action.path.slice(),
                data: $alarm.data("alarm")
            });
        }
        $alarm.remove();
        Squirrel.Tree.set_modified($node, action.time);
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
Squirrel.Tree.action = function(action, chain, undoable) {
    "use strict";

    var $node = Squirrel.Tree["action_" + action.type](action, undoable);

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
Squirrel.Tree.demap = function($node) {
    "use strict";

    if (!$node.hasClass("node"))
        $node = $node.closest(".node");

    delete Squirrel.Tree.cache[$node.data("path")];
    $node
        .data("path", null)
        // Reset the path of all subnodes
        .find(".node")
        .each(function() {
            var $s = $(this);
            delete Squirrel.Tree.cache[$s.data("path")];
            $s.data("path", null);
        });
};

/**
 * Return true if there is at least one undoable operation
 */
Squirrel.Tree.can_undo = function() {
    "use strict";

    return Squirrel.Tree.undos.length !== 0;
};

/**
 * Undo the most recent action
 */
Squirrel.Tree.undo = function() {
    "use strict";

    if (DEBUG && Squirrel.Tree.undos.length === 0) debugger;

    var a = Squirrel.Tree.undos.pop();
    a.time = Date.now();
    if (DEBUG) console.debug("Undo " + Hoard.stringify_action(a));
    var res = Squirrel.client.hoard.record_action(
        a,
        function(e) {
            Squirrel.Tree.action(
                e,
                function() {
                    // If there are no undos, there can be no modifications.
                    // The hoard status will not be changed, though, so a
                    // save may still be required.
                    if (Squirrel.Tree.undos.length === 0)
                        $(".modified").removeClass("modified");
                    Utils.sometime("update_save");
                    Utils.sometime("update_tree");
                });
        });
    if (res !== null)
        Squirrel.Dialog.squeak(res.message);
};
