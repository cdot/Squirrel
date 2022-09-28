/*@preserve Copyright (C) 2015-2019 Crawford Currie http://c-dot.co.uk license MIT*/
/* eslint-env browser,node */

/* global Tree: true */

define("js/Tree", [
	"js/Action", "js/Hoard", "js/Serror", "js/Dialog", "js/Node",
	"jquery", "js/jq/edit_in_place", "js/jq/scroll_into_view",
	"js/jq/icon_button", "jquery-ui"
], (Action, Hoard, Serror, Dialog, Node) => {

  // separator used in Path->node mapping index
  const PATHSEP = String.fromCharCode(1);

  // Character used to hide values
  const HIDE = '※';

  function formatDate(time) {
    const d = new Date(time);
    return `${d.getFullYear()}-`
    + `00${d.getMonth() + 1}`.slice(-2)
		+ '-'
    + `00${d.getDate()}`.slice(-2);
  }

	/**
	 * jQuery tree widget.
	 * Manages the DOM tree that represents the content of the client
	 * hoard cache.
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
	 * services are provided through the functions of the Tree
	 * namespace supporting a static cache mapping node path
	 * names to DOM nodes.
	 * @namespace Tree
	 */
  Tree = {

    /**
     * Static mapping paths to nodes
     */
    path2$node: {},

    // The next few methods reflect global settings that must affect
    // all Tree instances at the same time. They are intended to be
    // overridden once in the calling context.

    /**
     * Compare keys for sorting.
     * Override in calling context.
		 * @name Tree#compareKeys
		 * @function
		 * @param {string} a first key
		 * @param {string} b second key
     */
    compareKeys: (a, b) => {
      if (a == b)
        return 0;
      return (a < b) ? -1 : 1;
    },

    /**
		 * A change has been made to a node. Play the relevant action.
     * Override in calling context
		 * @name Tree#treePlayAction
     * @function
     * @param {Action} act
     */
    treePlayAction: () => {},

    /**
		 * Invoked when the mouse hovers over a node title.
     * Override in calling context
		 * @name Tree#onTitleHoverIn
     * @function
     * @returns {Boolean} true to terminate the hover-in action.
     */
    onTitleHoverIn: () => false,

    /**
		 * Invoked when the mouse hover over a node title ends.
     * Override in calling context
		 * @name Tree#onTitleHoverOut
     * @function
     * @returns {Boolean} true to terminate the hover-out action.
     */
    onTitleHoverOut: () => false,

    /**
		 * Are we to hide values when the tree is opened?
     * Override in calling context.
		 * @name Tree#hidingValues
     * @function
     */
    hidingValues: () => false,

    /**
		 * Are we to hide values when the tree is opened?
     * Override in calling context.
		 * @name Tree#showingChanges
     * @function
     */
    showingChanges: () => false,

    /**
		 * Set to a debug function in the calling context.
		 * @name Tree#debug
     */
    debug: null,
    
    /**
     * Construct a new UI element for a tree node. The created element
     * is a placeholder only until the parent is opened, at which time the
     * element is populated with controls.
     */
    _create: function() {
      const $node = this.element;

      // this.element is the object it's called on
      // This will be a div for the root, and an li for any other node
      // this.options is the options passed

      const is_root = !this.options.path;
      let parent, key = "", $parent;

      $node.addClass("tree");
      // Flag that it hasn't been opened yet, so its child nodes
      // will have no controls.
      $node.addClass("tree-never_opened");

      const $ul = $("<ul></ul>")
				    .addClass("tree_subtree sortable")
            .hide();
      $node.append($ul);

      if (is_root) {
        Tree.path2$node[""] = $node;
        $node
				.addClass("tree-isRoot")
        .data("path", []);
      } else {
        parent = this.options.path.slice();
        key = parent.pop();
        $parent = this.getNodeFromPath(parent);
				Serror.assert($parent && $parent.length === 1);

				$node[0].accessKey = key; // DEBUG HACK

        $node.data("key", key);

        if (typeof this.options.value !== 'undefined' &&
            this.options.value !== null) {

          $node
          .data("value", this.options.value)
          .addClass("tree-isLeaf");
        }
      }

      if ($parent)
        // Insert-sort into the $parent
        this._insertInto($parent);

      if (typeof this.options.time !== 'undefined')
        this.setModified(this.options.time);

      if (this.options.onCreate)
        this.options.onCreate.call($node);
    },

		// called by widget
    _destroy: function() {
      const $node = this.element;

      this._removeFromCaches();

      $node
      .removeClass("tree tree-isRoot tree-isLeaf tree-isModified tree-isOpen tree-hasAlarms")
      .removeData("key")
      .find("ul")
      .remove();
    },
    
    /**
     * Get the current node value for display, obscuring as
     * required
     * @private
     */
    _displayedValue: function() {
      const s = this.element.data("value");
      if (Tree.hidingValues())
        return s.replace(/./g, HIDE);
      return s;
    },

    /**
		 * Change the display of values
		 * @name Tree#hideValues
     * @function
		 * @param {boolean} on hiding on/off
     */
    hideValues: function(on) {
      if (on && Tree.hidingValues() ||
          !on && !Tree.hidingValues())
        return;

      Tree.hidingValues(on);
      $(".tree-isLeaf")
      .each(function() {
        const v = $(this).data("value");
        $(this)
        .find(".tree_t_i_l_value")
        .each(
          function () {
            $(this).text(on ? v.replace(/./g, HIDE) : v);
          });
      });
    },

    /**
		 * Change the display of changes
		 * @name Tree#showChanges
     * @function
		 * @param {boolean} on display on/off
     */
    showChanges: function(on) {
      if (on && Tree.showingChanges() ||
          !on && !Tree.showingChanges())
        return;
      
      $(".tree_t_i_change").toggle(Tree.showingChanges(on));
    },

    /**
     * Requires edit_in_place. selector may be a jquery selector or
     * an object.
     * @param {jQuery} $span child node to edit
     * @param {string} text text to present in the editor
     * @param {string} action 'R'ename or 'E'dit
		 * @param {function=} after post-edit function
     * @return a Promise that resolves to the changed value
		 * @private
     */
    _edit: function($span, text, action, after) {
      const $node = this.element;

			// Size it to use up the rest of the box
			const $box = $span.closest(".tree_title");
			const w = $box.width()-
				    ($span.offset().left - $box.offset().left);

      const nodepath = this.getPath();
      return new Promise((resolve, reject) => {
        $span.edit_in_place({
          width: w,
          text: text,
          onClose: function (s) {
						if (after)
							after(s);
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

		/**
		 * Edit the key in place
		 * @name Tree#editKey
		 * @function
		 */
    editKey: function() {
      const $node = this.element;
			const $leaf = $node.find(".tree_t_i_leaf");
			$leaf.hide();
      return this._edit(
        $node.find(".tree_t_i_key")
        .first(), $node.data("key"), 'R',
				() => $leaf.show());
    },

		/**
		 * Edit the value in place
		 * @name Tree#editValue
		 * @function
		 */
    editValue: function() {
      const $node = this.element;
      return this._edit(
        $node.find(".tree_t_i_l_value")
        .first(), $node.data("value"), 'E');
    },

    /**
		 * Mark the alarm on this node as having rung
		 * @name Tree#ringAlarm
     * @function
     */
    ringAlarm: function() {
      this.element
      .find(".tree_t_i_alarm .tree-icon-alarm")
      .removeClass("tree-icon-alarm")
      .addClass("tree-icon-rang");
    },

    /**
		 * Find the path for a DOM node or jQuery node.
		 * @name Tree#getPath
     * @function
     * @return {string[]} the path to the node, one string per key
     */
    getPath: function() {
      const $node = this.element;
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
		 * @name Tree#getNodeFromPath
     * @function
     * @param {string[]} path list of keys representing the path
     * @return {jQuery} the tree node
     */
    getNodeFromPath: function(path) {
      const $node = Tree.path2$node[path.join(PATHSEP)];
      // Has something not been added to the cache?
      Serror.assert($node && $node.length === 1, path, $node);
      return $node;
    },

    /**
     * Insert-sort the given node as a child of the given parent node
     * @private
     */
    _insertInto: function($parent) {
      Serror.assert($parent.length === 1);
      const $node = this.element;

      // First decouple from the old parent. We have to remove
      // from caches manually because we are detaching, not removing
      // the node, so _destroy won't get called
      this._removeFromCaches();
      $node.detach();

      // Now insert in the new parent
      const key = $node.data("key");
      let inserted = false;

      const $ul = $parent.find("ul").first();
      Serror.assert($ul.length === 1);

      $ul.children(".tree")
      .each((i, el) => {
        if (!inserted && Tree.compareKeys(
          $(el)
          .data("key"), key) > 0) {
          $node.insertBefore($(el));
          inserted = true;
          return false;
        }
				return true;
      });
      if (!inserted)
        $ul.append($node);

      this._addToCaches();
    },

    /**
		 * Set the modified time on the node
		 * @name Tree#setModified
		 * @function
     * @param {number} time optional time in ms, if missing will use now
     */
    setModified: function(time) {
      this.element.find(".tree_t_i_change").first()
      .text(formatDate(time));
      return this.element
      .addClass("tree-isModified")
      .data("last-time-changed", time);
    },

    _decorate_node: function() {
      const $node = this.element;

			// Don't redecorate
			if ($node.hasClass("tree-decorated"))
				return;
			$node.addClass("tree-decorated");

			const self = this;
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
          .find(".tree_t_i_l_value")
          .each(
            function () {
              $(this).text($node.data("value"));
            });
        }

        $(this)
        .addClass("tree-hover");

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
          .find(".tree_t_i_l_value")
          .each(
            function () {
              // Obscure the value
              $(this).text(self._displayedValue());
            });
        }
        $(this)
        .removeClass("tree-hover");
				return false;
      }

      // <title>
      const $title = $("<div></div>");
      $title
      .addClass("tree_title")
      // SMELL: only if screen is wide enough!
      .hover(hoverIn, hoverOut)
      .on("paste", function () {
        //debugger;
      })
      .prependTo($node);

      // Add open/close button, visible on non-leaf nodes
      const $control = $("<button></button>")
				    .addClass("tree_t_toggle");
      $control.appendTo($title);
      $control.icon_button({
        icon: "squirrel-icon-folder-closed"
      })
      .on(Dialog.tapEvent(), () => {
        $node.tree("toggle");
        return false;
      });

      // <info>
      const $info = $("<div></div>")
            .addClass("tree_t_info")
            .appendTo($title);

			// Alarm button
      const $alarm = $("<button></button>")
				    .appendTo($info)
				    .addClass("tree_t_i_alarm")
				    .icon_button({
              icon: "tree-icon-alarm"
            })
            .on(Dialog.tapEvent(), function () {
              Dialog.confirm("alarm", {
                path: $node.tree("getPath"),
                alarm: $node.data("alarm")
              })
              .then(act => {
                if (act.type === 'C') {
                  $node.data("alarm", null);
                } else {
                  $node.data("alarm", {
                    due: act.data.due,
                    repeat:act.data.repeat
                  });
                }
              })
              .catch((/*e*/) => {});
              return false;
            });

			if (!$node.data("alarm"))
				$node.addClass("tree-noAlarm");

      // Create the key span
      $("<span></span>")
      .appendTo($info)
      .addClass("tree_t_i_key")
      .text($node.data("key"))
      .on(Dialog.doubleTapEvent(),
          function (e) {
            if (Tree.debug) Tree.debug("Double-click 1");
            e.preventDefault();
            $(e.target).closest(".tree").tree("editKey")
            .then(a => Tree.treePlayAction(a))
            .catch((/*e*/) => {});
          });

			const $value_parts = $("<span></span>")
				    .addClass("tree_t_i_leaf")
				    .appendTo($info);
			
      $("<span></span>")
      .text(" : ")
      .addClass("tree_t_i_l_separator")
      .appendTo($value_parts);

      $("<span></span>")
      .appendTo($value_parts)
      .addClass("tree_t_i_l_value")
      .text(this._displayedValue())
      .on(Dialog.doubleTapEvent(), e => {
        if (Tree.debug) Tree.debug("Double-click 2");
        e.preventDefault();
        $(e.target).closest(".tree").tree("editValue")
        .then(a => Tree.treePlayAction(a))
        .catch(() => {});
      });

      $info.append("&nbsp;");

      $("<span class='tree_t_i_change'></span>")
      .appendTo($info)
      .text(formatDate($node.data("last-time-changed")))
      .toggle(Tree.showingChanges());
    },

		/**
		 * Widget function to open the node
		 * @name Tree#open
		 * @function
		 */
    open: function(options) {
      const $node = this.element;

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
        const fruitbat = $node.find(".tree_t_toggle")
              .first();
        fruitbat.icon_button("option", "icon", "squirrel-icon-folder-open");
      }
      return $node
      .addClass("tree-isOpen")
      .children("ul")
      .show();
    },

		/**
		 * Widget function to close the node
		 * @name Tree#close
		 * @function
		 */
    close: function() {
      const $node = this.element;
      if (!$node.hasClass("tree-isOpen"))
        return $node;
      $node.find(".tree_t_toggle")
      .first()
      .icon_button("option", "icon", "squirrel-icon-folder-closed");
      return $node
      .removeClass("tree-isOpen")
      .children("ul")
      .hide();
    },

		/**
		 * Widget function to toggle open/closed
		 * @name Tree#toggle
		 * @function
		 */
    toggle: function() {
      if (this.element.hasClass("tree-isOpen"))
        return this.close();
      return this.open();
    },

    /**
     * Action handler for node edit, called via action()
     * @private
     */
    _action_E: function(action) {
      const $node = this.element;
      $node
      .data("value", action.data)
      .find(".tree_t_i_l_value")
      .first()
      .text(this._displayedValue());

      this.setModified(action.time);
    },

    /**
     * Action handler for node delete, called via action()
     * @private
     */
    _action_D: function(action) {
      const $node = this.element;

      const $parent = $node.parent()
            .closest(".tree");
      $parent.tree("setModified", action.time);

      $node.remove();
    },

    /**
     * Action handler for node create, called via action()
     * @private
     */
    _action_N: function(action, open) {
      return new Promise(resolve => {
        const $node = $("<li></li>");
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
     * Action handler for node insert, called via action()
     * @private
     */
    _action_I: function(action, open) {
      const content = JSON.parse(action.data);
			const h = new Hoard({ tree: content });
			const acts  = h.actions_to_recreate(true);
			acts.forEach(a => {
				a.path = action.path.concat(a.path);
				this.action(a);
			});
			// Finally decorate
			this.getNodeFromPath(action.path)
			.tree("instance")._decorate_node();

			return Promise.resolve();
    },
    
    /**
     * Action handler for alarm add, called via action()
     * @private
     */
    _action_A: function(action) {
      const $node = this.element;
      // Check there's an alarm already
      const oldAlarm = $node.data("alarm");
      if (oldAlarm === action.data)
        return; // no change

			if (action.data) {
				$node.data("alarm", action.data);
				$node.removeClass("tree-noAlarm");
				if (typeof oldAlarm === 'undefined') {
					// Run up the tree, incrementing the alarm count
					$node
					.parents(".tree")
					.each(function () {
						const c = $(this).data("alarm-count") || 0;
						$(this)
						.data("alarm-count", c + 1)
						.addClass("tree-hasAlarms");
					});
				}
			} else {
				$node.addClass("tree-noAlarm");
				if (typeof oldAlarm !== 'undefined') {
					$node.removeData("alarm");
					// Run up the tree decrementing the alarm count
					$node
					.parents(".tree")
					.each(function () {
						let c = $(this).data("alarm-count") || 0;
						c = c - 1;
						if (c === 0)
							$(this).removeClass("tree-hasAlarms");
						$(this).data("alarm-count", c);
					});
				}
			}

      this.setModified(action.time);
    },

    /**
     * Action handler for cancelling an alarm, called via action()
		 * Compatibility only: action C has been replaced by A with
		 * undefined data
		 * @private
     */
    _action_C: function(action) {
			// action.data is always undefined, so this is the same as
			// an A with null data
			this._action_A(action);
    },

    /**
     * Action handler for modifying constraints, called via action()
		 * @private
     */
    _action_X: function(action) {
      const constraints = this.element.data("constraints");
      if (constraints === action.data)
        return; // same constraints already

      this.element.data("constraints", action.data);
      this.setModified(action.time);
    },

    /**
     * Action handler for moving a node, called via action()
		 * @private
     */
    _action_M: function(action) {
      const $node = this.element;
      const oldpath = this.getPath();
      const newpath = action.data.slice();
      const $new_parent = this.getNodeFromPath(newpath);

			// Open the new parent, so we can see when it lands
      $new_parent
			.parents('.tree')
			.each(function() {
        $(this)
        .tree("open");
      });
      $new_parent.tree("open");

      // Relocate the node in the DOM
      this._insertInto($new_parent);

      if (typeof $node.scroll_into_view !== 'undefined')
        $node.scroll_into_view();

      this.setModified(action.time);
    },

    /**
     * Action handler for node rename, called via action()
		 * @private
     */
    _action_R: function(action) {
      // Detach the li from the DOM
      const $node = this.element;

			$node[0].accessKey = action.data; // DEBUG HACK
			
      $node
      .data("key", action.data)
      .find(".tree_t_i_key")
      .first()
      .text(action.data);

      this.setModified(action.time);

      // Re-insert the element in it's sorted position
      this._insertInto($node.parent().closest(".tree"));

      if (typeof $node.scroll_into_view !== 'undefined')
        $node.scroll_into_view();
    },
    
    /**
		 * Widget method to play an action that is being
     * played into the hoard into the DOM as well.
		 * @name Tree#action
     * @function
     * @param {Action} action to play
     * @param {boolean} open whether to open the node after the action is applied
     * (only relevant on N and I actions)
     * @return {Promise} Promise that resolves when the UI has been updated.
     */
    action: function(action, open) {
      if (Tree.debug) Tree.debug("Tree.action", action);
      
      // 'N' and 'I' require construction of a new node.
      if (action.type === 'N')
        return this._action_N(action, open);
      
      if (action.type === 'I')
				return this._action_I(action, open);

      // All else requires a pre-existing node
			// Intermediates ought to be created and uiPlayer invoked!
      const $node = this.getNodeFromPath(action.path);
      const widget = $node.tree("instance");
      widget[`_action_${action.type}`].call(widget, action, open);
      return Promise.resolve();
    },

    /**
     * Node paths are calculated from the DOM tree and are cached in
     * two ways; in a path->node lookup table called cache[], and in
     * a path->node lookup using a data("path") field on the
     * node, which maps to the PATHSEP separated path string.
     * @param $node jQuery node
     * @param parent optional path to the parent of this node
		 * @private
     */
    _addToCaches: function() {

      // Recursively cache node and descendants
      function recache($node, pa) {
        const path = pa.concat($node.data("key"));

        if (Tree.debug) {
          Serror.assert(pa);
					const p = path.join(PATHSEP);
          Serror.assert(!Tree.path2$node[p], `Cannot remap '${p}'`);
					Serror.assert(!$node.data("path"),
								        `Node at ${p}already mapped`);
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

      const $el = this.element;

      // Find the path to the parent of this node
      const $parent = $el.parent().closest(".tree");
      Serror.assert($parent && $parent.length === 1);

      const pa = $parent.tree("getPath");
      recache($el, pa);
    },

    /**
     * Remove the node (and all subnodes) from the node->path->node mappings
     * @param $node node to remove
     * @private
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
        const $s = $(this);
        const p = $s.data("path");
        if (p) {
          delete Tree.path2$node[p.join(PATHSEP)];
          $s.removeData("path");
        }
      });
    }
  };

  (function ($) {
    $.widget("squirrel.tree", Tree);
  })(jQuery);

  return Tree;
});

