/*@preserve Copyright (C) 2015-2023 Crawford Currie http://c-dot.co.uk license MIT*/
/* eslint-env browser,node */

import { Hoard } from "./Hoard.js";
import { Action } from "./Action.js";
import { Serror } from "./Serror.js";

const CLIENT_PATH = "client";

/**
 * @callback Hoarder.Selector
 * @param {Action[]} actions - actions
 * to play
 * @return {Promise} returns a promise that resolves to the subset of
 * actions that are selected to be played
 */

/**
 * Management of client and cloud data stores.  Several methods
 * support a `progress` parameter. This is an object that supports
 * a method `push({severity:string, message:string})'.  See
 * `js/dialogs/alert.js` for how it is used in a notification dialog.
 */
class Hoarder {

	/**
	 * @param {object} p can override any of the members
	 */
  constructor(p) {
    p = p || {};

    /**
		 * pathname of the cloud store
		 * @member {string}
		 * @private
		 */
    this.cloudPath = null;
    /**
		 * URL of steganography image
		 * @member {string}
		 * @private
		 */
    this.imageURL = null;
    /**
		 * Client store interface
		 * @member {AbstractStore}
		 * @private
		 */
    this.clientStore = null;
    /**
		 * Cloud store interface
		 * @member {AbstractStore}
		 * @private
		 */
    this.cloudStore = null;
    /**
		 * Number of actions last read from cloud
		 * @member {number}
		 */
    this.cloudLength = 0;
    /**
		 * When was the last sync?
		 * @member {number}
		 */
    this.last_sync = 0;
    /**
		 * When was the client last saved?
		 * @member {number}
		 */
    this.last_save = 0;
    /**
		 * The client Hoard
		 * @member {Hoard}
		 */
    this.hoard = new Hoard();
    /**
		 * Record of non-action changes, such as paths and settings
		 * @member {}
		 */
    this.clientChanges = [];
    /**
		 * Flag that indicates if the cloud was changed. This applies
		 * only to the meta-data and not to the action stream; the
		 * stream can change without the cloudChanged flag being set
		 * (it's rebuilt from the client tree).
		 * @member {boolean}
		 * @private
		 */
    this.cloudChanged = false;
    /**
		 * Flag that indicates if the hoard was just created. When
		 * we open on a new store, the client will be emptied and
		 * this flag set. It will be cleared when the client has been
		 * populated from the cloud.
		 * @member {boolean}
		 * @private
		 */
    this.clientIsEmpty = true;
    
    for (let k in p) {
      if (Object.prototype.hasOwnProperty.call(p, k))
        this[k] = p[k];
    }
  }

  /**
   * Return whatever we know about the current user from the
   * stores, looking first in the cloud store and if that is
	 * null, in the client store.
	 * @return {string?}
   */
  probableUser() {
    return this.cloudStore.option("user")
    || this.clientStore.option("user");
  }
  
  /**
	 * Getter/setter for the cloud store
   * @param {AbstractStore=} store the store
   * @return {AbstractStore} the store
   */
  cloud_store(store) {
    if (store) {
      this.cloudStore = store;
      const cluser = store.option("user");
      if (cluser && this.debug)
        this.debug("...cloud suggests user may be", cluser);        
      if (this.debug) this.debug("...cloud initialised");
    }
    return this.cloudStore;
  }
  
  /**
	 * Getter/setter for the client store
   * @param {AbstractStore=} store the store
   * @return {AbstractStore} the store
   */
  client_store(store) {
    if (store)
      this.clientStore = store;
    return this.clientStore;
  }

  /**
   * Setter/getter for cloud store path
	 * @param {string=} path
   * @return {string} the path
   */
  cloud_path(path) {
    if (typeof path !== 'undefined' && path !== this.cloudPath) {
      if (this.debug) this.debug("Set cloud path", path);
      this.cloudPath = path;
      this.cloudChanged = !this.clientIsEmpty;
      this.clientChanges.push($.i18n("cloud_path_change"));
    }
    return this.cloudPath;
  }

  /**
   * Is an image required by the store?
	 * @return {boolean}
   */
  needs_image() {
    return this.cloudStore.option("needs_image");
  }

  /**
   * Setter/getter for image URL.
	 * @param {string=} path path to set
	 * @return {string}
   */
  image_url(path) {
    if (typeof path !== 'undefined' && path !== this.imageURL) {
      if (this.debug) this.debug("Set image url", path);
      this.imageURL = path;
      this.cloudChanged = !this.clientIsEmpty;
      this.clientChanges.push($.i18n("img_changed"));
    }
    return this.imageURL || 'images/GCHQ.png'; // default;
  }

  /**
   * Getter/setter for encryption password
	 * @param {string=} pass pass to set
	 * @return {string}
   */
  encryption_pass(pass) {
    if (typeof pass !== 'undefined') {
      this.clientStore.option("pass", pass);
      this.clientChanges.push($.i18n("chepass_log"));
      this.cloudStore.option("pass", pass);
      this.cloudChanged = true;
    }
    return this.clientStore.option("pass");
  }

  /**
   * Getter/setter for client hoard editable JSON text
	 * @param {string=} json editable JSON text
	 * @return {string} JSON text
	 tree_json(json) {
   if (json) {
   const parsed = JSON.parse(json);
   this.hoard.clear_history();
   this.hoard.tree = parsed;
   this.clientChanges.push($.i18n("bulk_change"));
   this.cloudChanged = true;
   }
   return JSON.stringify(this.hoard.tree, null, " ");
   }*/
  
  /**
	 * Getter/setter for the current user
	 * @param {string=} u the user
	 * @return {string} the user
	 */
  user(u) {
    if (typeof u !== 'undefined')
      return this.clientStore.option("user", u);
    return this.clientStore.option("user");
  }

	/**
	 * Check alarms, calling the handler.
   * @param {Hoard.Ringer} ringfn ring function([], Date)
	 * @return {Promise}
	 */
  check_alarms(ringfn) {
    return this.hoard.check_alarms(ringfn)
    .then(changes => {
      if (changes > 0) {
        this.clientChanges.push(
          $.i18n("alarm_changes", changes));
        this.cloudChanged = true;
        this.clientIsEmpty = false;
      }
    });
  }

  /**
   * Promise to add an action to the client hoard. This will play
   * the action into the client tree, and add the undo
   * @param {Action} action the action to play
   * @param {object} options see {@link Hoard#play_action}
   * @return {Promise} Promise that resolves to undefined
   */
  play_action(action, options) {
    return this.hoard.play_action(action, options);
  }

  /**
   * Get the minimal action stream required to recreate the
   * client tree.
   * @return an array of actions
   */
  action_stream() {
    return this.hoard.actions_to_recreate();
  }

  /**
   * Return true if there is at least one undoable operation
   * in the client
	 * @return {boolean} 
   */
  can_undo() {
    return this.hoard.can_undo();
  }

  /**
   * Return a message describing the next undo that would be applied.
	 * @return {string}
   */
  next_undo() {
    return this.hoard.history[this.hoard.history.length - 1]
    .undo.verbose();
  }
  
  /**
   * Return true if there is a node in the tree at the given path
   * @param {string[]} path array of path components
	 * @return {boolean}
   */
  node_exists(path) {
    return this.hoard.get_node(path) ? true : false;
  }

	/**
	 * Get a list of the contents of the node at the given
	 * path.
	 * @param {string[]} path the path to the node of interest
	 * @return {Object.<string,boolean>} map from node name to
	 * a boolean that is true if the child is a folder.
	 */
	nodeContents(path) {
		const n = this.hoard.get_node(path);
		const kids = {};
		n.eachChild((name, node) => {
			kids[name] = !node.isLeaf();
		});
		return kids;
	}

  /**
   * Get the local action history
	 * @return {Action[]}
   */
  history() {
    return this.hoard.history;
  }
  
  /**
   * Undo the action most recently played
	 * @param {object=} options options passed to {@link Hoard#play_action}.
	 * `undoable` is forced to `false`
   * @return {Promise} Promise that resolves to undefined.
   */
  undo(options) {
		options = options || {};
		options.undoable = false;
    return this.hoard.undo(options);
  }
  
  /**
   * Return null if no auth is required, or a structure that may
   * optionally have a user field if one can be determined.
   * @return {{user: string}?} {user:} or null
   */
  auth_required() {
    
    if (!this.clientStore.option("needs_pass") &&
        typeof this.clientStore.option("user") !== 'undefined') {
      if (this.debug) this.debug("...client doesn't need auth");
      return null; 
    }
    
    if (this.debug) this.debug("...client needs auth");
    let poss_user;
    if (this.cloudStore) {
      poss_user = this.cloudStore.option("user")
      || this.cloudStore.option("net_user");
    }
    if (!poss_user)
      poss_user = this.clientStore.option("user");

    if (this.debug) this.debug("...user may be", poss_user);

    return { user: poss_user };
  }

  /**
   * Propagate auth to the stores
   * @param {object} auth user info
	 * @param {string} auth.user - username
	 * @param {string} auth.pass - password
   */
  authenticate(auth) {
    // Propagate to the stores
    this.clientStore.option("user", auth.user);
    this.clientStore.option("pass", auth.pass);

    // Don't really need to propagate user, it's not used
    // on the cloudStore side
    this.cloudStore.option("user", auth.user);
    this.cloudStore.option("pass", auth.pass);
  }

	/**
	 * Clear the local store
	 */
  reset_local() {
    this.hoard = new Hoard({debug: this.debug});
    this.history = [];
    this.clientChanges = [ $.i18n("local_reset") ];
    this.clientIsEmpty = true;
    this.last_sync = 0;
    this.last_save = 0;
    return this.update_from_cloud();
  }
  
  /**
   * Get a list of actions that have occured since the last
   * sync or save
	 * @return {Action[]} list of actions
   */
  get_unsaved_actions() {
    const list = [];
    for (let record of this.hoard.history) {
      if (record.redo.time > this.last_save)
        list.push(record);
    }
    return list;
  }
  
  /**
   * Get a list of changes reflected in the history. Only changes since
   * the last sync or the last client save are returned.
   * @param max_changes the maximum number of changes to reflect
   * in the list 
	 * @return {string[]} list of change messages
   */
  get_changes(max_changes) {
    let messages = [];
    for (let record of this.get_unsaved_actions())
      messages.push(record.redo.verbose());

    // the client may have settings changes
    if (this.clientChanges.length > 0)
      messages = messages.concat(this.clientChanges);

    // Cap the return length at max_changes
    if (max_changes > 0 && messages.length > max_changes) {
      const l = messages.length;
      messages = messages.slice(-max_changes);
      messages.push(
				$.i18n("more_changes",
               l - max_changes));
    }
    if (this.debug) this.debug(messages);
    
    return messages;
  }
  
  /**
   * Promise to load the client hoard. This reads the hoard from
   * store, but does not play the actions; it is left up to the
   * caller to call `actions_to_recreate()` to build the UI.
   * @return {Promise} Promise that resolves to undefined if the
   * load succeeded, or an array of alert messages otherwise
   */
  load_client() {
    if (this.debug) this.debug('...load client');
    this.clientIsEmpty = true;
    return this.clientStore.reads(CLIENT_PATH)
    .catch(e => {
      if (this.debug)
        this.debug("...local store could not be read", e);
      // probably doesn't exist
      this.hoard = new Hoard({debug: this.debug});
      throw [
        {
          severity: "error",
          message: $.i18n("no_local")
        },
        $.i18n("new_local")];
    })
    .then(str => {
      try {
        const data = JSON.parse(str);
        this.cloudPath = data.cloud_path;
        this.imageURL = data.image_url;
        this.last_sync = data.last_sync || 0;
        this.last_save = data.last_save || 0;
        this.hoard = new Hoard({
          debug: this.debug,
          hoard: data.hoard
        });
        this.clientIsEmpty = false;
      } catch (e) {
        if (this.debug) this.debug("...client parse failed", e);
        this.hoard = new Hoard({debug: this.debug});
        throw [
          {
            severity: "error",
            message: $.i18n("unreadable_local")
          },
          $.i18n("chk-pass"),
          $.i18n("cont-to-local")
        ];
      }
    });
  }

  /**
	 * Save the client store
   * @param {Progress} progress reporter
	 * @return {Promise} Promise to save the store
   */
  save_client(progress) {
    if (this.debug) this.debug("...save to client");

    // Make a serialisable data block
    const data = {
      cloud_path: this.cloudPath,
      image_url: this.imageURL,
      last_sync: this.last_sync,
      last_save: Date.now(),
      hoard: this.hoard
    };
    const json = JSON.stringify(data);
    return this.clientStore.writes(CLIENT_PATH, json)
    .then(() => {
      if (this.debug) this.debug("...client write OK");
      
      // READBACK CHECK - debug, make sure what we
      // wrote is still readable
      //return this.clientStore.reads(CLIENT_PATH)
      //.then(json2 => {
      //    if (json2 !== json) {
      //        throw new Serror(500, "Readback check failed");
      //    }
      if (progress) progress.push({
        severity: "notice",
        message: $.i18n("local_saved")
      });
      this.last_save = data.last_save;
      return Promise.resolve();
      //});
    })
    .catch(e => {
      if (this.debug) this.debug("...client save failed", e);
      if (progress) progress.push({
        severity: "error",
        message: $.i18n(
          "loc-save-f", e)
      });
      return Promise.reject(e);
    });
  }

  /**
   * Promise to load cloud actions
   * @return {Promise} Promise that resolves to the list of
   * actions read from the cloud
   */
  load_cloud() {
    return this.cloudStore.reads(this.cloudPath)
    .then(data => {
      let actions = [];
      if (data && data.length > 0) {
        if (this.debug) this.debug("...parsing cloud actions");
        try {
          actions = JSON.parse(data);
          if ('actions' in actions) {
            // Old hoard format
            actions = actions.actions;
          }
        } catch (e) {
          if (this.debug)
            this.debug("...cloud hoard JSON parse failed:", e);
          return Promise.reject(
            new Serror(400, "Cloud store could not be parsed"));
        }
        this.cloudLength = actions.length;
      }
      else if (this.debug) this.debug("...cloud is empty");
      return Promise.resolve(actions.map(act => new Action(act)));
    });
  }

  /**
   * Update the hoard from the cloud, by examining cloud actions
   * that have been added since we last synched, and
   * interactively selecting those that are to be applied. last_sync is
   * update to reflect the changes.
	 * @param {object=} options options
   * @param {Progress=} options.progress reporter
   * @param {Hoarder.Selector=} options.selector function that, when
   * given a list of actions to play, returns a promise that
   * resolves to the subset of that list that is selected to be
   * played. Intended for gathering feedback from the user as to
	 * what actions are to be accepted. If undefined, all actions
	 * will be kept.
   * @param {Hoard.UIPlayer=} options.uiPlayer UI action player
   * @param {Array.<Action>=} options.actions list of preloaded
	 * actions, saves reloading the cloud
   * @return {Promise} Promise that resolves to the proposed new contents
   * of the cloud (a list of {@link Action}
   */
  update_from_cloud(options) {
		options = options || {};

    const new_cloud = []; // list of actions
    let prom;

    if (options.actions)
			prom = Promise.resolve(options.actions);
    else {
      prom = this.load_cloud()
      .catch(se => {
        if (se instanceof Serror && se.status === 404)
          // cloud "file not found"
          return [];
        throw se;
      });
    }

    return prom.then(cloud_actions => {

      if (this.debug) this.debug("Last sync was at", this.last_sync);
      
      // Split the actions read from the cloud into "known" and
      // "unknown"
      const new_client = [];
      for (let act of cloud_actions) {
        if (act.time > this.last_sync) {
          // This is new, not reflected in the local tree
          new_client.push(act);
          if (this.debug) this.debug("...new action from cloud",
                                     act);
        } else
          // This is old, already reflected in local tree
          new_cloud.push(act);
      }

      // Push local actions into the cloud change set *before*
      // the changes we just pulled from the cloud. These changes
      // are already reflected in the local tree, and are part of
      // the context the cloud changes will be applied to.
      for (let record of this.hoard.history) {
        if (record.redo.time > this.last_sync) {
          new_cloud.push(record.redo);
          if (this.debug) this.debug("...action from history",
                                     record.redo);
        }
      }

      // Select the cloud changes to apply, interactively if
      // the client actions list isn't initially empty
      if (new_client.length > 0 && this.hoard.history.length > 0
          && options.selector)
        return options.selector(new_client);
      else
        return Promise.resolve(new_client);
    })
    .then(selected => {
      let promise = Promise.resolve();
			const freshStart = this.clientIsEmpty;
      for (let act of selected) {
        promise = promise
				.then(() => this.hoard.play_action(
          act,
					{
						// Note that the cloud actions are pushed
						// to the undo queue, so they can be undone, but
						// not if the client was initially empty (otherwise
						// this would force a cloud save, which we don't
						// want)
						undoable: !freshStart,
						autocreate: freshStart,
						uiPlayer: act => {
							new_cloud.push(act);
							return options.uiPlayer
							? options.uiPlayer(act) : Promise.resolve();
						}
					}))
				.then(() => {
          if (this.debug) this.debug("...played", act);
        })
				.catch(e => {
					debugger;
          if (this.debug) this.debug("FAILED", act, e);
          if (options.progress) options.progress.push({
            severity: "warning",
            message: e
          });
					return Promise.resolve();
        });
      }

			if (this.clientIsEmpty) {
				// if the client was empty, we want to store in the client
				// but NOT in the cloud
        this.last_sync = Date.now();
        this.clientIsEmpty = false;
			}
      else if (selected.length > 0) {
        // If changes were selected, and we didn't start from
				// an empty client, then we need to remember the sync
        this.clientChanges.push(
					$.i18n("changes_merged"));
        if (this.debug) this.debug("...synced at", this.last_sync);
        this.clientIsEmpty = false;

        this.last_sync = Date.now();
      }
      return promise;
    })
    // new_cloud contains the right set of actions
    .then(() => new_cloud);
  }

	/**
	 * Analyse the number of different types of action.
	 * @return {Object.<string,number>} a map from the code of each
	 * action type to the number of times it is used when recreating
	 * the action stream.
	 */
	analyse() {
    const counts = {
      cloud: this.hoarder.cloudLength,
      N: 0,
      A: 0,
      X: 0
    };
    const acts = this.hoard.actions_to_recreate();
    for (let act of acts)
      counts[act.type]++;
    return counts;
  }

  /**
   * Promise to save the given actions list in the cloud
   * @param {Action[]} actions list of actions to save in the cloud
   * @param {Progress} progress reporter
   */
  save_cloud(actions, progress) {
    return this.cloudStore.writes(
      this.cloudPath,
      JSON.stringify(actions))
    .then(() => {
      if (this.debug) this.debug("...cloud save OK");
      this.cloudLength = actions.length;
      if (progress) progress.push({
        severity: "notice",
        message: $.i18n("cloud_saved")
      });
      this.cloudChanged = false;
      return Promise.resolve(true);
    })
    .catch(e => {
      if (this.debug) this.debug("...cloud save failed", e.stack);
      if (progress) progress.push({
        severity: "error",
        message: $.i18n("cloud_save_fail", e)
      });
      return Promise.resolve(false);
    });
  }

	/**
	 * Save both stores as required by current change state.
	 * @param {object=} options options
	 * @param {Progress} options.progress reporter
	 * @param {Hoarder.Selector} options.selector
	 * @param {Hoard.UIPlayer=} options.uiPlayer
	 * @return {Promise} Promise to save both stores
	 */
  save_stores(options) {
		options = options || {};
    let saveClient = this.clientChanges.length > 0;
    let saveCloud = this.cloudChanged;

    // See if there's anything new in the history since
    // we last synched/saved
    for (let record of this.hoard.history) {
      if (record.redo.time > this.last_sync)
        saveCloud = true;
      if (record.redo.time > this.last_save)
        saveClient = true;
    }

    if (!(saveCloud || saveClient)) {
      if (options.progress) options.progress.push({
        severity: "notice",
        message: $.i18n("no_changes")
      });
      return Promise.resolve(false);
    }
    
    let promise; // order is important!
    let cloud_saved = false;
    let client_saved = false;
    if (saveCloud) {
      promise = this.update_from_cloud(options)
      .then(new_cloud => this.save_cloud(new_cloud, options.progress))
      .then(() => cloud_saved = true)
			.catch(e => {
        if (this.debug) this.debug("cloud update failed", e);
        if (options.progress)
					options.progress.push({
            severity: "error",
            message: [
              $.i18n(
                "update-fail",
                this.cloudPath),
              $.i18n("cloud_save_fail")
            ]
          });
        if (e instanceof Serror) {
          if (e.status && options.progress)
            options.progress.push({ severity: "error", http: e.status });
          if (e.message && options.progress)
            options.progress.push(e.message);
        }
        // Resolve, not reject!
        return Promise.resolve();
      });
    } else
      promise = Promise.resolve();

    if (saveClient) {
      promise = promise
      .then(() => {
				this.last_sync = Date.now();
        return this.save_client(options.progress);
      })
      .then(() => {
        client_saved = true;
				this.clientChanges = [];
      })
      .catch(e => {
        if (this.debug) this.debug("Client save failed", e);
        if (options.progress) options.progress.push({
          severity: "error",
          message: [
            $.i18n("local_save_fail"), e
          ]
        });
      });
    }

    return promise
    .then(() => {               
      if ((!saveCloud || cloud_saved)
          && (!saveClient || client_saved)) {
        this.hoard.clear_history();
        return true;
      }
      else
        return false;
    });
  }
}

export { Hoarder }
