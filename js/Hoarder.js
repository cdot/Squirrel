/*@preserve Copyright (C) 2015-2019 Crawford Currie http://c-dot.co.uk license MIT*/
/* eslint-env browser,node */

define("js/Hoarder", ["js/Hoard", "js/Action", "js/Serror", "js/Translator"], function(Hoard, Action, Serror, Translator) {

    const CLIENT_PATH = "client";
    const TX = Translator.instance();
    
	/**
	 * Management of client and cloud data stores.
	 * Several methods support a `progress` parameter. This is an object that
	 * supports a method `push({severity:string, message:string})'.
	 * See `dialogs/alert.js` for how it is used in a notification dialog.
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
			 */
            this.cloudPath = null;
            /**
			 * URL of steganography image
			 * @member {string}
			 */
            this.imageURL = null;
            /**
			 * Client store interface
			 * @member {AbstractStore}
			 */
            this.clientStore = null;
            /**
			 * Cloud store interface
			 * @member {AbstractStore}
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
            this.hoard = null;
            /**
			 * Record of non-action changes, such as paths and settings
			 * @member {}
			 */
            this.clientChanges = [];
            /**
			 * Flag that indicates if the cloud was changed
			 * @member {boolean}
			 */
            this.cloudChanged = false;
            /**
			 * Flag that indicates if the hoard was just created
			 * @member {boolean}
			 */
            this.clientIsEmpty = true;
            
            for (let k in p) {
                if (Object.prototype.hasOwnProperty.call(p, k))
                    this[k] = p[k];
            }
        }

        /**
         * Return whatever we know about the current user from the
         * stores
         */
        probableUser() {
            return this.cloudStore.option("user")
            || this.clientStore.option("user");
        }
        
        /**
         * @param store an AbstractStore subclass
         */
        cloud_store(store) {
            if (store) {
                this.cloudStore = store;
                let cluser = store.option("user");
                if (cluser && this.debug)
                    this.debug("...cloud suggests user may be", cluser);        
                if (this.debug) this.debug("...cloud initialised");
            }
            return this.cloudStore;
        }
        
        /**
         * @param store an AbstractStore subclass
         */
        client_store(store) {
            if (store)
                this.clientStore = store;
            return this.clientStore;
        }

        /**
         * Setter/getter for cloud store path
         */
        cloud_path(path) {
            if (typeof path !== "undefined" && path !== this.cloudPath) {
                if (this.debug) this.debug("Set cloud path", path);
                this.cloudPath = path;
                this.cloudChanged = !this.clientIsEmpty;
                this.clientChanges.push(TX.tx("Cloud path changed"));
            }
            return this.cloudPath;
        }

        /**
         * Is an image required by the store?
         */
        needs_image() {
            return this.cloudStore.option("needs_image");
        }

        /**
         * Setter/getter for image URL. This is only used for saving;
         * the #stegamage element is used to actually load the image
         */
        image_url(path) {
            if (typeof path !== "undefined" && path !== this.imageURL) {
                if (this.debug) this.debug("Set image url", path);
                this.imageURL = path;
                this.cloudChanged = !this.clientIsEmpty;
                this.clientChanges.push(TX.tx("Image URL changed"));
            }
            return this.imageURL || 'images/GCHQ.png'; // default;
        }

        /**
         * Getter/setter for encryption password
         */
        encryption_pass(pass) {
            if (typeof pass !== "undefined") {
                this.clientStore.option("pass", pass);
                this.clientChanges.push(TX.tx("New encryption details"));
                this.cloudStore.option("pass", pass);
                this.cloudChanged = true;
            }
            return this.clientStore.option("pass");
        }

        /**
         * Getter/setter for client hoard editable JSON text
         */
        tree_json(json) {
            if (json) {
                let parsed = JSON.parse(json);
                this.hoard.clear_history();
                this.hoard.tree = parsed;
                this.clientChanges.push(TX.tx("Bulk content change"));
                this.cloudChanged = true;
            }
            return JSON.stringify(this.hoard.tree, null, " ");
        }
        
        /** Getter */
        user(u) {
            if (typeof u !== "undefined")
                return this.clientStore.option("user", u);
            return this.clientStore.option("user");
        }
        
        check_alarms(handler) {
            return this.hoard.check_alarms(handler)
            .then((changes) => {
                if (changes > 0) {
                    this.clientChanges.push(
                        TX.tx("$1 alarm change$?($1!=1,s,)", changes));
                    this.cloudChanged = true;
                    this.clientIsEmpty = false;
                }
            });
        }

        /**
         * Promise to add an action to the client hoard. This will play
         * the action into the client tree, and add the undo
         * @param {Action} action the action to play
         * @param {boolean} undoable if true and action that undos this action
         * will be added to the undo history. Default is true.
         * @return {Promise} Promise that resolves to a {@link Hoard.Conflict}
         */
        play_action(action, undoable) {
            return this.hoard.play_action(action, undoable);
        }

        /**
         * Get the minimal action stream required to recreate the
         * client tree.
         * @return an array of actions
         */
        tree_actions() {
            return this.hoard.actions_to_recreate();
        }

        /**
         * Return true if there is at least one undoable operation
         * in the client
         */
        can_undo() {
            return this.hoard.can_undo();
        }

        /**
         * Return a message describing the next undo that would be applied.
         */
        next_undo() {
            return this.hoard.history[this.hoard.history.length - 1]
            .undo.verbose();
        }
        
        /**
         * Return true if there is a node in the tree at the given path
         * @param path array of path components
         */
        node_exists(path) {
            return this.hoard.get_node(path) ? true : false;
        }

        /**
         * Get the local action history
         */
        history() {
            return this.hoard.history;
        }
        
        /**
         * Undo the action most recently played
         * @return {Promise} Promise that resolves to the {@link Action} replayed, or rejects
         * to a { message: } object
         */
        undo() {
            return this.hoard.undo()
            .then((e) => {
                if (e.conflict) {
                    if (self.debug) self.debug("undo had conflict", e.conflict);
                    return Promise.reject({ message: e.conflict });
                }
                return Promise.resolve(e.action);
            });
        }
        
        /**
         * Return null if no auth is required, or a structure that may
         * optionally have a user field if one can be determined.
         * @return null or { user }
         */
        auth_required() {
            
            if (!this.clientStore.option("needs_pass") &&
                typeof this.clientStore.option("user") !== "undefined") {
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

            return { user: poss_user }
        }

        /**
         * Propagate auth to the stores
         * @param {object} auth structure {user, pass} 
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

        reset_local() {
            this.hoard = new Hoard({debug: this.debug});
            this.history = [];
            this.clientChanges = [ TX.tx("Local store has been reset") ];
            this.clientIsEmpty = true;
            this.last_sync = 0;
            this.last_save = 0;
            return this.update_from_cloud();
        }
        
        /**
         * Promise to load the client hoard. This reads the hoard from
         * store, but does not play the actions; it is left up to the caller
         * to call actions_to_recreate to build the UI. 
         * @return Promise that resolves to undefined if the load succeeded,
         * or an array of alert messages otherwise
         */
        load_client() {
            if (this.debug) this.debug('...load client');
            this.clientIsEmpty = true;
            let self = this;
            return this.clientStore.reads(CLIENT_PATH)
            .catch((e) => {
                if (self.debug)
                    self.debug("...local store could not be read", e);
                // probably doesn't exist
                self.hoard = new Hoard({debug: self.debug});
                throw [
                    {
                        severity: "error",
                        message: TX.tx("Local store does not exist.")
                    },
                    TX.tx("A new local store will be created.")];
            })
            .then((str) => {
                try {
                    let data = JSON.parse(str);
                    self.cloudPath = data.cloud_path;
                    self.imageURL = data.image_url;
                    self.last_sync = data.last_sync || 0;
                    self.last_save = data.last_save || 0;
                    self.hoard = new Hoard({
                        debug: this.debug,
                        hoard: data.hoard
                    });
                    self.clientIsEmpty = false;
                } catch (e) {
                    if (self.debug) self.debug("...client parse failed", e);
                    self.hoard = new Hoard({debug: self.debug});
                    throw [
                        {
                            severity: "error",
                            message: TX.tx("Local store exists, but can't be read.")
                        },
                        TX.tx("Check that you have the correct password."),
                        TX.tx("If you continue and save, a new local store will be created.")
                    ];
                }
            });
        }

        /**
         * Get a list of actions that have occured since the last
         * sync or save
         */
        get_unsaved_actions() {
            let list = [];
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
                let l = messages.length;
                messages = messages.slice(-max_changes);
                messages.push(TX.tx("... and $1 more change$?($1!=1,s,)",
                                   l - max_changes));
            }
            if (this.debug) this.debug(messages);
            
            return messages;
        }
        
        /**
         * @param progress object, see class def for details
         */
        save_client(progress) {
            let self = this;

            if (this.debug) this.debug("...save to client");

            // Make a serialisable data block
            let data = {
                cloud_path: this.cloudPath,
                image_url: this.imageURL,
                last_sync: this.last_sync,
                last_save: Date.now(),
                hoard: this.hoard
            };
            let json = JSON.stringify(data);
            return this.clientStore.writes(CLIENT_PATH, json)
            .then(() => {
                if (this.debug) this.debug("...client write OK");
                
                // READBACK CHECK - debug, make sure what we
                // wrote is still readable
                //return this.clientStore.reads(CLIENT_PATH)
                //.then((json2) => {
                //    if (json2 !== json) {
                //        throw new Serror(500, "Readback check failed");
                //    }
                    if (progress) progress.push({
                        severity: "notice",
                        message: TX.tx("Saved in local store")
                    });
                    self.last_save = data.last_save;
                    return Promise.resolve();
                //});
            })
            .catch((e) => {
                if (this.debug) this.debug("...client save failed", e);
                if (progress) progress.push({
                    severity: "error",
                    message: TX.tx(
                        "Failed to save in local store: $1", e)
                });
                return Promise.reject(e);
            });
        }

        /**
         * Promise to load cloud actions
         * @return a promise that resolves to the list of actions read from
         * the cloud
         */
        load_cloud() {
            return this.cloudStore.reads(this.cloudPath)
            .then((data) => {
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
                return Promise.resolve(actions.map((act) => new Action(act)));
            });
        }

        /**
         * Update the hoard from the cloud, by examining cloud actions
         * that have been added since we last synched, and
         * interactively selecting those that are to be applied. last_sync is
         * update to reflect the changes.
         * @param selector function that, when given a list of actions
         * to play, returns a promise that resolves to the subset of
         * that list that is selected to be played
         * @param player UI action player
         * @param actions optional list of preloaded actions read from
         * the cloud, saves reloading the cloud
         * @param progress object, see class def for details
         * @return a Promise that resolves to the proposed new contents
         * of the cloud
         */
        update_from_cloud(progress, selector, player, actions) {
            let new_cloud = [];
            let prom = actions ? Promise.resolve(actions) : this.load_cloud();
            return prom.then((cloud_actions) => {

                if (this.debug) this.debug("Last sync was at", this.last_sync);
                
                // Split the actions read from the cloud into "known" and
                // "unknown"
                let new_client = [];
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
                    && selector)
                    return selector(new_client);
                else
                    return Promise.resolve(new_client);
             })
            .then((selected) => {              
                let promise = Promise.resolve();
                for (let act of selected) {
                    promise = promise.then(
                        // Note that the cloud actions are pushed
                        // to the undo queue, so they can be undone, but
                        // not if the client was initially empty (otherwise
                        // this would force a cloud save, which we don't
                        // want)
                        this.hoard.play_action(act, !this.clientIsEmpty)
                        .then((e) => {
                            if (e.conflict) {
                                if (progress) progress.push({
                                    severity: "warning",
                                    message: e.conflict
                                });
                            } else {
                                if (this.debug) this.debug("...played", act);
                                new_cloud.push(act);
                                if (player)
                                    return player(act);
                            }
                            return Promise.resolve();
                        }));
                }
                if (selected.length > 0) {
                    // If we saw changes, and we didn't start from an empty
                    // hoard, then we need to save the client
                    this.last_sync = Date.now();
                    if (!this.clientIsEmpty)
                        this.clientChanges.push(TX.tx("Changes merged from cloud store"));
                    if (this.debug) this.debug("...synced at", this.last_sync);
                    this.clientIsEmpty = false;
                }
                return promise;
            })
            .then(() => {
                // new_cloud contains the right set of actions to
                // rebuild a cloud by taking the cloud actions before
                // the sync and appending the local actions.
                return new_cloud;
            });
        }

        save_stores(progress, selector, player) {
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
                if (progress) progress.push({
                    severity: "notice",
                    message: TX.tx("No changes needed to be saved")
                });
                return Promise.resolve(false);
            }
            
            let promise;
            let self = this;
            let cloud_saved = false;
            let client_saved = false;
            if (saveCloud) {
                promise = this.update_from_cloud(
                    progress, selector, player)
                .then((new_cloud) => {
                    return self.save_cloud(new_cloud, progress)
                    .then(() => {
                        cloud_saved = true;
                    });
                })
                .catch((e) => {
                    if (self.debug) self.debug("cloud update failed", e);
                    progress.push({
                        severity: "error",
                        message: [
                            TX.tx(
                                "Could not update from cloud store '$1'",
                                self.cloudPath),
                            TX.tx("Cloud store could not be saved")
                        ]
                    });
                    if (e instanceof Serror) {
                        if (e.status)
                            progress.push({ severity: "error", http: e.status });
                        if (e.message)
                            progress.push(e.message);
                    }
                    // Resolve, not reject!
                    return Promise.resolve();
                });
            } else
                promise = Promise.resolve();

            if (saveClient) {
                promise = promise
                .then(() => {
                    return self.save_client(progress);
                })
                .then(() => {
                    client_saved = true;
					self.clientChanges = [];
                })
                .catch((e) => {
                    if (self.debug) self.debug("Client save failed", e);
                    progress.push({
                        severity: "error",
                        message: [
                            TX.tx("Local store could not be saved"), e
                        ]
                    });
                });
            }

            return promise
            .then(() => {               
                if ((!saveCloud || cloud_saved)
                    && (!saveClient || client_saved)) {
                    self.hoard.clear_history();
                    return true;
                }
                else
                    return false;
            });
        }
        
        /**
         * Promise to save the given actions list in the cloud
         * @param actions list of actions to save in the cloud
         * @param progress object, see class def for details
         * @return a promise that resolves to true if the save succeeded
         */
        save_cloud(actions, progress) {
            let self = this;

            return self.cloudStore.writes(
                self.cloudPath,
                JSON.stringify(actions))
            .then(() => {
                if (self.debug) self.debug("...cloud save OK");
                self.cloudLength = actions.length;
                if (progress) progress.push({
                    severity: "notice",
                    message: TX.tx("Saved in cloud")
                });
                self.cloudChanged = false;
                return Promise.resolve(true);
            })
            .catch((e) => {
                if (self.debug) self.debug("...cloud save failed", e.stack);
                if (progress) progress.push({
                    severity: "error",
                    message: TX.tx("Failed to save in cloud store: $1", e)
                });
                return Promise.resolve(false);
            });
        }
    }

    return Hoarder;
});
