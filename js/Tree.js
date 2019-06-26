/*@preserve Copyright (C) 2015-2019 Crawford Currie http://c-dot.co.uk license MIT*/
/* eslint-env browser,node */

/* global Tree: true */

/**
 * Functions involved in the management of the DOM tree that represents
 * the content of the client hoard cache.
 *
 * Each node below the root in the hoard is represented in the DOM by an
 * LI node in a UL/LI tree. Elements in the tree are tagged with classes
 * as described in Tree.css and have data:
 *   key: the key name the node is for (simple name, not a path)
 *        NOTE: the root doesn't have a data-key
 *   value: if this is a leaf node
 *   path: the full pathname of the node (array of strings)
 *   alarm: if there is an alarm on the node (structure)
 *   constraints: record of constraints imposed on node (structure)
 *   last_time_changed: last time the node whas modified
 *   alarm-count: a count of the number of active alarms in the subtree
 *
 * The DOM tree is built and maintained through the use of actions sent
 * to the Squirrel client hoard, which are then passed on in a callback to
 * the DOM tree. Nodes in the DOM tree are never manipulated directly outside
 * this namespace (other than to add the 'tree-isModified' class)
 *
 * Nodes are managed using the squirrel.tree widget. Additional
 * services are provided through the functions of the Squirrel.Tree
 * namespace. These functions support a static cache mapping node path
 * names to DOM nodes.
 */

define("js/Tree", ["js/Action", "js/Hoard", "js/Serror", "js/Dialog", "jquery", "js/jq/edit_in_place", "js/jq/scroll_into_view", "js/jq/icon_button", "jquery-ui"], function(Action, Hoard, Serror, Dialog) {

    // separator used in Path->node mapping index
    const PATHSEP = String.fromCharCode(1);

    // Character used to hide values
    const HIDE = "※";

    function formatDate(time) {
        let d = new Date(time);
        return d.getFullYear() + "-"
        + ("00" + (d.getMonth() + 1)).slice(-2) + "-"
        + ("00" + d.getDate()).slice(-2);
    }

    Tree = {

        /**
         * Static mapping paths to nodes
         */
        path2$node: {},

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
         * Are we to hide values when the tree is opened?
         * Override in calling context
         */
        showingChanges: () => false,

        /**
         * Set to a debug function
         */
        debug: null,
        
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
            let parent, key = "", $parent;

            $node.addClass("tree");
            // Flag that it hasn't been opened yet, so its child nodes
            // will have no controls.
            $node.addClass("tree-never_opened");

            if (is_root) {
                Tree.path2$node[""] = $node;
                $node.addClass("tree-isRoot"); // should be there in HTML?
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
                    .addClass("tree-isLeaf");
                    is_leaf = true;
                }
            }

            if (!is_leaf) {
                let $ul = $("<ul></ul>")
                    .addClass("sortable")
                    .hide();
                $node
                .addClass("tree-isColl")
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

        _destroy: function() {
            let $node = this.element;

            this._removeFromCaches();

            $node
            .removeClass("tree tree-isRoot tree-isColl tree-isModified tree-isOpen tree-hasAlarms")
            .removeData("key")
            .find("ul")
            .remove();
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
        hideValues: function(on) {
            if (on && Tree.hidingValues() ||
                !on && !Tree.hidingValues())
                return;

            Tree.hidingValues(on);
            $(".tree-isLeaf")
            .each(function() {
                let v = $(this).data("value");
                $(this)
                .find(".tree__value")
                .each(
                    function () {
                        $(this).text(on ? v.replace(/./g, HIDE) : v);
                    });
            });
        },

        /**
         * Change the display of changes
         */
        showChanges: function(on) {
            if (on && Tree.showingChanges() ||
                !on && !Tree.showingChanges())
                return;
            
            $(".tree__change").toggle(Tree.showingChanges(on));
        },

        /**
         * Requires edit_in_place. selector may be a jquery selector or
         * an object.
         * @param $span child node to edit
         * ~para, text text to present in the editor
         * @param action 'R'ename or 'E'dit
         * @return a Promise that resolves to the changed value
         */
        _edit: function($span, text, action) {
            let $node = this.element;

            // Fit width to the container
            let w = $node.closest(".tree-isRoot")
                .width();
            w -= $span.position()
            .left;
            $span.parents()
            .each(function () {
                w -= $(this)
                .position()
                .left;
            });

            let nodepath = this.getPath();
            return new Promise((resolve, reject) => {
                $span.edit_in_place({
                    width: w,
                    text: text,
                    onClose: function (s) {
                        if (s !== text)
                            resolve(new Action({
                                type: action,
                                path: nodepath,
                                data: s
                            }));
                        else
                            reject();
                    }
                });
            });
        },

        editKey: function() {
            let $node = this.element;
            return this._edit(
                $node.find(".tree__key")
                .first(), $node.data("key"), "R");
        },

        editValue: function() {
            let $node = this.element;
            return this._edit(
                $node.find(".tree__value")
                .first(), $node.data("value"), "E");
        },

        /**
         * Mark the alarm on this node as having rung
         */
        ringAlarm: function() {
            this.element
            .find(".tree__alarm .tree-icon-alarm")
            .removeClass("tree-icon-alarm")
            .addClass("tree-icon-rang");
        },

        _makeDraggable: function($node) {
            function handleDrag(event) {
                // Need to get from a position to a target element
                let $within = $(".tree-isColl")
                    .not(".ui-draggable-dragging")
                    .filter(function () {
                        if ($(this)
                            .is($node.parent()
                                .closest(".tree")))
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
                $(".tree-isDropTarget")
                .removeClass("tree-isDropTarget");
                if ($within.length > 0) {
                    $within = $within.last();
                    $within.addClass("tree-isDropTarget");
                }
            }

            function handleStop() {
                let $target = $(".tree-isDropTarget");
                if ($target.length > 1)
                    debugger;
                $target.each(function () {
                    let $new_parent = $(this);
                    $new_parent.removeClass("tree-isDropTarget");
                    let oldpath = $node.tree("getPath");
                    let newpath = $new_parent.tree("getPath");
                    Tree.playAction(new Action({
                        type: "M",
                        path: oldpath,
                        data: newpath
                    }));
                });
            }

            // Drag handle
            let $button = $("<div></div>")
                .addClass("tree__draghandle")
                .icon_button({
                    icon: "ui-icon-arrow-2-n-s"
                })
                .hide();
            $node
            .children(".tree_title")
            .append($button);

            // Make the node draggable by using the drag handle
            $node.draggable({
                handle: ".tree__draghandle",
                axis: "y",
                containment: ".tree-isColl",
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
            if ($node.hasClass("tree-isRoot"))
                return [];
            Serror.assert($node.hasClass("tree"), "Missing class");

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
            let $node = Tree.path2$node[path.join(PATHSEP)];
            // Has something not been added to the cache?
            Serror.assert($node && $node.length === 1);
            return $node;
        },

        /**
         * @private
         * Insert-sort the given node as a child of the given parent node
         */
        _insertInto: function($parent) {
            Serror.assert($parent.length === 1);
            let $node = this.element;

            // First decouple from the old parent. We have to remove
            // from caches manually because we are detaching, not removing
            // the node, so _destroy won't get called
            this._removeFromCaches();
            $node.detach();

            // Now insert in the new parent
            let key = $node.data("key");
            let inserted = false;

            let $ul = $parent.find("ul").first();
            Serror.assert($ul.length === 1);

            $ul.children(".tree")
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
            this.element.find(".tree__change").first()
            .text(formatDate(time));
            
            return this.element
            .addClass("tree-isModified")
            .data("last-time-changed", time);
        },

        // Add UI components for handling any alarm that may be on
        // the node
        _decorate_with_alarm: function($node) {
            let alarm = $node.data("alarm");
            if (!alarm)
                return; // no alarm
            $node
            .find(".tree__key")
            .first()
            .before(function () {
                let $button = $("<button></button>").addClass("tree__alarm");

                $button.icon_button({
                    icon: "tree-icon-alarm"
                })
                .on(Dialog.tapEvent(), function () {
                    Dialog.confirm("alarm", {
                        path: $node.tree("getPath"),
                        alarm: $node.data("alarm")
                    })
                    .then((act) => {
                        if (act.type === "C") {
                            $node.data("alarm", null);
                        } else {
                            $node.data("alarm", {
                                due: act.data.due,
                                repeat:act.data.repeat
                            });
                        }
                    })
                    .catch((e) => {});
                    return false;
                });
                return $button;
            });
        },

        _decorate_node: function() {
            let self = this;
            let $node = this.element;

            // Invoked on tree_title
            function hoverIn( /*evt*/ ) {
                if (Tree.onTitleHoverIn() || $("body")
                    .find("input.in_place_editor")
                    .length > 0)
                    return true;

                $(".tree-hover")
                .removeClass("tree-hover");

                // Unobscure the value if it's hidden
                if (Tree.hidingValues() && $node.hasClass("tree-isLeaf")) {
                    $(this)
                    .find(".tree__value")
                    .each(
                        function () {
                            $(this).text($node.data("value"));
                        });
                }

                $(this)
                .addClass("tree-hover")
                .find(".tree__draghandle")
                .first()
                .show();

                return false;
            }

            // Invoked on tree_title
            function hoverOut( /*evt*/ ) {
                if (Tree.onTitleHoverOut() ||
                    $("body")
                    .find("input.in_place_editor")
                    .length > 0)
                    return true;

                // Re-obscure the node if required
                if (Tree.hidingValues() && $node.hasClass("tree-isLeaf")) {
                    $(this)
                    .find(".tree__value")
                    .each(
                        function () {
                            // Obscure the value
                            $(this).text(self._displayedValue());
                        });
                }
                $(this)
                .removeClass("tree-hover")
                .find(".tree__draghandle")
                .first()
                .hide();
            }

            // <title>
            let $title = $("<div></div>")
                .addClass("tree_title")
            // SMELL: only if screen is wide enough!
                .hover(hoverIn, hoverOut)
                .on("paste", function () {
                    //debugger;
                })
                .prependTo($node);

            if (!$node.hasClass("tree-isLeaf")) {
                // Add open/close button on child none-leaf nodes
                let $control = $("<button></button>").addClass("tree__toggle");
                $control.appendTo($title);
                $control.icon_button({
                    icon: "squirrel-icon-folder-closed"
                })
                .on(Dialog.tapEvent(),
                    function () {
                        $node.tree("toggle");
                        return false;
                    });
            }

            // <info>
            let $info = $("<div></div>")
                .addClass("tree__info")
                .appendTo($title);

            // Create the key span
            $("<span></span>")
            .appendTo($info)
            .addClass("tree__key")
            .text($node.data("key"))
            .on(Dialog.doubleTapEvent(),
                function (e) {
                    if (Tree.debug) Tree.debug("Double-click 1");
                    e.preventDefault();
                    $(e.target).closest(".tree").tree("editKey")
                    .then((a) => {
                        Tree.playAction(a);
                    })
                    .catch((e) => {});
                });

            if ($node.hasClass("tree-isLeaf")) {
                $("<span></span>")
                .text(" : ")
                .addClass("tree__separator")
                .appendTo($info);
                $("<span></span>")
                .appendTo($info)
                .addClass("tree__value")
                .text(this._displayedValue())
                .on(Dialog.doubleTapEvent(),
                    function (e) {
                        if (Tree.debug) Tree.debug("Double-click 2");
                        e.preventDefault();
                        $(e.target).closest(".tree").tree("editValue")
                        .then((a) => {
                            Tree.playAction(a);
                        })
                        .catch((e) => {});
                    });
            }

            $info.append(" ");
            $("<span class='tree__change'></span>")
            .appendTo($info)
            .text(formatDate($node.data("last-time-changed")))
            .toggle(Tree.showingChanges());

            this._makeDraggable($node);
            this._decorate_with_alarm($node);
        },

        open: function(options) {
            let $node = this.element;

            if (options && options.decorate)
                this._decorate_node();

            if ($node.hasClass("tree-isOpen"))
                return $node;

            if ($node.hasClass("tree-never_opened")) {
                // Expand children for display, if this is the
                // first time this node has been opened
                $node.removeClass("tree-never_opened");
                $node.children("ul").children().each(function () {
                    $(this).tree("instance")._decorate_node();
                });
            }

            if (!$node.hasClass("tree-isRoot")) {
                let fruitbat = $node.find(".tree__toggle")
                    .first();
                fruitbat.icon_button("option", "icon", "squirrel-icon-folder-open");
            }
            return $node
            .addClass("tree-isOpen")
            .children("ul")
            .show();
        },

        close: function() {
            let $node = this.element;
            if (!$node.hasClass("tree-isOpen"))
                return $node;
            $node.find(".tree_toggle")
            .first()
            .icon_button("option", "icon", "squirrel-icon-folder-closed");
            return $node
            .removeClass("tree-isOpen")
            .children("ul")
            .hide();
        },

        toggle: function() {
            if (this.element.hasClass("tree-isOpen"))
                return this.close();
            return this.open();
        },

        /**
         * @private
         * Action handler for node edit
         */
        _action_E: function(action) {
            let $node = this.element;
            $node
            .data("value", action.data)
            .find(".tree__value")
            .first()
            .text(this._displayedValue());

            this.setModified(action.time);
        },

        /**
         * @private
         * Action handler for node delete
         */
        _action_D: function(action) {
            let $node = this.element;

            let $parent = $node.parent()
                .closest(".tree");
            $parent.tree("setModified", action.time);

            $node.remove();
        },

        /**
         * @private
         * Action handler for node create
         */
        _action_N: function(action, open) {
            return new Promise((resolve) => {
                let $node = $("<li></li>");
                // _create automatically adds it to the right parent.
                $node.tree($.extend(
                    {},
                    this.options,
                    {
                        path: action.path,
                        value: action.data,
                        time: action.time,
                        onCreate: function () {
                            // getPath will update the caches on the fly
                            // with the new node
                            resolve();
                        }
                    }));
                $node.tree("getPath");
                if (open)
                    $node.tree("open", {
                        decorate: true
                    });
            });
        },
        
        /**
         * @private
         * Action handler for node insert
         */
        _action_I: function(action, open) {
            let content = JSON.parse(action.data);
            let val;
            let acts = [];
            if (typeof content.data === "object") {               
                let h = new Hoard({ tree: content });
                acts = h.actions_to_recreate();
                content.data = undefined;
            } else
                val = content.data;

            // Create the node at the root of the insert
            let self = this;
            return this._action_N(new Action({
                type: "N",
                path: action.path,
                time: content.time,
                data: content.data
            }), open)
            .then(() => {
                for (let act of acts) {
                    // Paths recorded in the action are relative
                    act.path = action.path.concat(act.path);
                    self.action(act);
                }
                
                // Finally decorate
                self.getNodeFromPath(action.path)
                .tree("instance")._decorate_node();
            });
        },
        
        /**
         * @private
         * Action handler for alarm add
         */
        _action_A: function(action) {
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
                $node.parents(".tree")
                .each(function () {
                    let c = $(this)
                        .data("alarm-count") || 0;
                    $(this)
                    .data("alarm-count", c + 1);
                    $(this)
                    .addClass("tree-hasAlarms");
                });
            }

            this.setModified(action.time);
        },

        /**
         * Action handler for cancelling an alarm
         */
        _action_C: function(action) {
            let $node = this.element;

            let alarm = $node.data("alarm");
            if (!alarm)
                return;

            // run up the tree decrementing the alarm count
            $node.parents(".tree").each(function () {
                let c = $(this).data("alarm-count") || 0;
                c = c - 1;
                $(this).data("alarm-count", c);
                if (c === 0)
                    $(this).removeClass("tree-hasAlarms");
            });

            $(".tree__alarm").first().remove();

            $node.removeData("alarm");

            this.setModified(action.time);
        },

        /**
         * Action handler for modifying constraints
         */
        _action_X: function(action) {
            let constraints = this.element.data("constraints");
            if (constraints === action.data)
                return; // same constraints already

            this.element.data("constraints", action.data);
            this.setModified(action.time);
        },

        /**
         * Action handler for moving a node
         */
        _action_M: function(action) {
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
        },

        /**
         * Action handler for node rename
         */
        _action_R: function(action) {
            // Detach the li from the DOM
            let $node = this.element;
            let key = action.path[action.path.length - 1]; // record old node name

            $node
            .data("key", action.data)
            .find(".tree__key")
            .first()
            .text(action.data);

            this.setModified(action.time);

            // Re-insert the element in it's sorted position
            this._insertInto($node.parent()
                             .closest(".tree-isColl"));

            if (typeof $node.scroll_into_view !== "undefined")
                $node.scroll_into_view();
        },
        
        /**
         * Plays an action that is being
         * played into the hoard into the DOM as well.
         * @param e action to play
         * @param open whether to open the node after the action is applied
         * (only relevant on N and I actions)
         * @return a promise that resolves when the UI has been updated.
         */
        action: function(action, open) {
            if (Tree.debug) Tree.debug("$action",action);
            
            // "N" and "I" require construction of a new node.
            if (action.type === "N")
                return this._action_N(action, open);
            
            if (action.type === "I")
                return this._action_I(action, open);

            // All else requires a pre-existing node
            let $node = this.getNodeFromPath(action.path);
            let widget = $node.tree("instance");
            widget["_action_" + action.type].call(widget, action, open);
            return Promise.resolve();
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

                if (Tree.debug) {
                    if (!pa)
                        throw "recache outside tree";
                    if (Tree.path2$node[path.join(PATHSEP)]) {
                        throw "Remapping path -> node";
                    }
                    if ($node.data("path"))
                        throw "Remapping node -> path";
                }

                // node->path mapping
                $node.data("path", path);

                // path->node mapping
                Tree.path2$node[path.join(PATHSEP)] = $node;

                // Repeat for subnodes
                $node
                .find("ul")
                .first()
                .children(".tree")
                .each(function () {
                    recache($(this), path);
                });
            }

            let $el = this.element;

            // Find the path to the parent of this node
            let $parent = $el.parent().closest(".tree");
            Serror.assert($parent && $parent.length === 1);

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
            if (!$node.hasClass("tree"))
                $node = $node.closest(".tree");

            if ($node.data("path"))
                delete Tree.path2$node[$node.data("path")
                                  .join(PATHSEP)];

            $node
            .removeData("path")
            // Reset the path of all subnodes
            .find(".tree")
            .each(function () {
                let $s = $(this);
                delete Tree.path2$node[$s.data("path").join(PATHSEP)];
                $s.removeData("path");
            });
        }
    };

    (function ($) {
        $.widget("squirrel.tree", Tree);
    })(jQuery);

    return Tree;
});

