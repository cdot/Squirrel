/*@preserve Copyright (C) 2015-2019 Crawford Currie http://c-dot.co.uk license MIT*/
/* eslint-env browser,node */

/**
 * Management of client and cloud
 * Several methods support a `progress' parameter. This is an object that
 * supports a method `push({severity, message})' (both parameters strings)
 * See dialogs/alert.js for how it is used in a notification dialog.
 */

define("js/Hoarder", ["js/Hoard", "js/Action", "js/Serror", "js/Translator"], function(Hoard, Action, Serror, Translator) {

    const CLIENT_PATH = "client";
    const TX = Translator.instance();
    
    class Hoarder {

        constructor(p) {
            p = p || {};

            // pathname of the cloud store
            this.cloudPath = null;
            // URL of steganography image
            this.imageURL = null;
            // store interfaces
            this.clientStore = null;
            this.cloudStore = null;
            // When was the last sync?
            this.last_sync = 0;
            // The client Hoard
            this.hoard = null;
            // Record of non-action changes, such as paths and settings
            this.clientChanges = 0;
            this.cloudChanges = 0;
            // Flag that indicates if the hoard was just created
            this.clientIsEmpty;
            
            for (let k in p) {
                if (p.hasOwnProperty(k))
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
                if (!this.clientIsEmpty)
                    this.cloudChanges++;
                this.clientChanges++; // path is saved in the client
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
                if (!this.clientIsEmpty)
                    this.cloudChanges++;
                this.clientChanges++; // path is saved in the client
            }
            return this.imageURL || 'images/GCHQ.png'; // default;
        }

        /**
         * Getter/setter for encryption password
         */
        encryption_pass(pass) {
            if (typeof pass !== "undefined") {
                this.clientStore.option("pass", pass);
                this.clientChanges++;
                this.cloudStore.option("pass", pass);
                this.cloudChanges++;
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
                this.clientChanges++;
                this.cloudChanges++;
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
                this.cloudChanges += changes;
                this.clientChanges += changes;
                if (changes > 0)
                    this.clientIsEmpty = false;
            });
        }

        /**
         * Promise to add an action to the client hoard. This will play
         * the action into the client tree, and add the undo
         * @param action the action to play
         * @param undo optional action to undo the one being added
         */
        play_action(action, undoable) {
            return this.hoard.play_action(action, undoable);
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
         * @param auth structure {user, pass} 
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
         * Promise to load the client hoard. This reads the hoard from
         * store, but does not play the actions; it is left up to the caller
         * to call actions_to_recreate to build the UI. 
         * @return Promise that resolves to undefined if the load succeeded,
         * or an array of alert messages otherwise
         */
        load_client() {
            let self = this;
            if (self.debug) self.debug('...load client');
            self.clientIsEmpty = true;
            return self.clientStore.reads(CLIENT_PATH)
            .catch((e) => {
                if (self.debug)
                    self.debug("...client store could not be read", e);
                // probably doesn't exist
                self.hoard = new Hoard({debug: self.debug});
                throw [
                    {
                        severity: "error",
                        message: TX.tx("Browser store does not exist.")
                    },
                    TX.tx("A new browser store will be created.")];
            })
            .then((str) => {
                try {
                    let data = JSON.parse(str);
                    self.cloudPath = data.cloud_path;
                    self.imageURL = data.image_url;
                    self.last_sync = data.last_sync;
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
                            message: TX.tx("Client store exists, but can't be read.")
                        },
                        TX.tx("Check that you have the correct password."),
                        TX.tx("If you continue and save, a new browser store will be created.")
                    ];
                }
            });
        }

        /**
         * Determine if the cloud has changes that need saving
         * @return true if changes need to be saved
         */
        cloudHasChanges() {
            // No need to save the cloud unless there are actions in
            // the local history
            return this.cloudChanges > 0 || this.hoard.history.length > 0;
        }
        
        /**
         * Determine if the client has changes that need saving
         * @return true if changes need to be saved
         */
        clientHasChanges() {
            // No need to save the client unless there are actions in
            // the local history
            return this.clientChanges > 0 || this.hoard.history.length > 0;
        }

        /**
         * Get a list of changes reflected in the client history. Note that
         * we only need one of these, because the same data is saved in
         * the cloud as in the client, but the client has more because it
         * also carries settings (such as the cloud path)
         * @param max_changes the maximum number of changes to reflect
         * in the list 
         */
        getChanges(max_changes) {
            let message = [];
            let seen = {};
            
            for (let act of this.hoard.history) {
                let changed = act.redo.path.join("↘");
                if (!seen[changed]) {
                    message.push(changed);
                    seen[changed] = true;
                    if (max_changes > 0 && message.length > max_changes)
                        break;
                }
            }

            message = message.map((p) => TX.tx("$1 has changed", p));
                
            // the client may have settings changes
            if (this.clientChanges > message.length)
                message.unshift(TX.tx(
                    "The browser has $1 change$?($1!=1,s,) to settings",
                    this.clientChanges - message.length));

            // Cap the return length at max_changes
            if (max_changes > 0 && message.length > max_changes) {
                let l = message.length;
                message = message.slice(0, max_changes);
                message.push(TX.tx("... and $1 more change$?($1!=1,s,)",
                                   l - max_changes));
            }

            return message;
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
                hoard: this.hoard
            };
            let json = JSON.stringify(data);
            return this.clientStore.writes(CLIENT_PATH, json)
            .then(() => {
                if (this.debug) this.debug("...client write OK");
                
                // READBACK CHECK - debug FireFucks, make sure what we
                // wrote is still readable
                return this.clientStore.reads(CLIENT_PATH)
                .then((json2) => {
                    if (json2 !== json) {
                        throw new Serror(500, "Readback check failed");
                    }
                    if (progress) progress.push({
                        severity: "notice",
                        message: TX.tx("Saved in browser")
                    });
                    return Promise.resolve();
                });
            })
            .catch((e) => {
                if (this.debug) this.debug("...client save failed", e);
                if (progress) progress.push({
                    severity: "error",
                    message: TX.tx(
                        "Failed to save in client store: $1", e)
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

                // Split the actions read from the cloud into "known" and
                // "unknown"
                let new_client = [];
                for (let act of cloud_actions) {
                    if (act.time > this.last_sync)
                        // This is new, not reflected in the local tree
                        new_client.push(act);
                    else
                        // This is old, already reflected in local tree
                        new_cloud.push(act);
                }

                // Push local actions into the cloud change set *before*
                // the changes we just pulled from the cloud. These changes
                // are already reflected in the local tree, and are part of
                // the context the cloud changes will be applied to.
                for (let record of this.hoard.history)
                    new_cloud.push(record.redo);

                // Select the cloud changes to apply, interactively if
                // the client actions list isn't initially empty
                if (new_client.length > 0 && this.hoard.history.length > 0)
                    return selector(new_client);
                else
                    return Promise.resolve(new_client);
             })
            .then((selected) => {
                this.last_sync = Date.now();
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
                                return Promise.resolve();
                            } else {
                                new_cloud.push(act);
                                return player(act);
                            }
                        }));
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

                if (progress) progress.push({
                    severity: "notice",
                    message: TX.tx("Saved in cloud")
                });
                self.cloudChanges = 0;
                return Promise.resolve(true);
            })
            .catch((e) => {
                if (self.debug) self.debug("...cloud save failed " + e.stack);
                if (progress) progress.push({
                    severity: "error",
                    message: TX.tx("Failed to save in cloud store: $1", e)
                });
                return Promise.resolve(false);
            });
        }

        /**
         * Automatic synchronisation.
         *
         * Update (or load) the client hoard with actions from the cloud
         * that were applied since we last updated it. This is used both
         * when loading and when updating before saving.
         * The update algorithm is as follows:
         * Download the lastest cloud
         * If the cloud has changes since the last synch:
         *    unwind the local changes in the client (if any)
         *    play the cloud changes
         *    rewind the client changes
         * The new cloud is then the existing cloud actions with the local
         * actions appended.
         * @param progress object, see class def for details
         * @param {function} player called for all actions that do not generate
         * conflicts.
         * @return a Promise that resolves to the list of actions that make
         * up the updated the cloud.
         */
        synchronise(progress, player) {
            let since = this.last_sync;
            if (this.debug) this.debug("Synchronise since", since);
            let self = this;
            let prepare;
            // Reload the cloud hoard to detect any recent changes
            return this.load_cloud()
            .then((cloud_actions) => {
                self.last_sync = Date.now();
                if (self.debug) self.debug("...read", cloud_actions.length,
                                           "actions from cloud");

                let promise = Promise.resolve();
                
                // Determine cloud actions since the last sync
                let act, new_cloud_actions = [], old_cloud_actions;
                while (true) {
                    act = cloud_actions.pop();
                    if (act.time > since) {
                        act.time = since;
                        new_cloud_actions.push(act);
                    } else {
                        cloud_actions.push(act);
                        break;
                    }
                }
                
                if (new_cloud_actions.length === 0)
                    return promise;
                
                if (self.debug) self.debug(
                    "...playing", new_cloud_actions.length,
                    "new actions into client");

                // Undo client actions performed since last sync
                let history = this.hoard.clear_history();
                let undos = [], redos = [];
                for (act of history) {
                    // First undo
                    undos.unshift(act.undo);
                    // Then do cloud actions
                    // Finally redo client action
                    redos.push(act.redo);
                }

                let acts = undos.concat(new_cloud_actions, redos);
                for (act of acts) {
                    let prom = this.hoard.play_action(act, false)
                        .then((e) => {
                            if (e.conflict) {
                                if (this.debug) this.debug("...conflict", e);
                                if (progress) progress.push({
                                    severity: "warning",
                                    message: e.conflict
                                });
                            }
                            else if (player)
                                return player(e.action);
                        });
                    promise = promise.then(prom);
                }
                    
                return promise.then(() => {
                    return cloud_actions.concat(new_cloud_actions, redos);
                });
            })
            .catch((e) => {
                if (self.debug) self.debug("...cloud synch failed", e);
                if (progress) progress.push({
                    severity: "error",
                    message: TX.tx("Failed to refresh from cloud store")
                });
                return Promise.reject(e);
            });
        }

        /**
         * Construct a new cloud from the tree in the client
         * @param progress object, see class def for details
         * @return a Promise
         */
        construct_new_cloud(progress) {
            // Cloud has no actions; reconstruct the cloud from
            // the client tree
            if (self.debug) self.debug("...reconstructing cloud");
            let actions = self.hoard.actions_to_recreate();
            return this.save_cloud(actions, progress);
        }
        
    }

    return Hoarder;
});
