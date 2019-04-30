/*@preserve Copyright (C) 2015-2019 Crawford Currie http://c-dot.co.uk license MIT*/
/* eslint-env browser,node */

/**
 * Management of two hoards, client and cloud
 * Several methods support a `progress' parameter. This is an object that
 * supports a method `push({severity, message})' (both parameters strings)
 * See dialogs/alert.js for how it is used in a notification dialog.
 */

define("js/Hoarder", ["js/Hoard", "js/Serror", "js/Translator"], function(Hoard, Serror, Translator) {

    const CLIENT_PATH = "client";

    class Hoarder {

        constructor(p) {
            p = p || {};
            
            this.cloudPath = null;  // pathname of the cloud store
            this.clientStore = null;
            this.cloudStore = null;
            this.hoard = null;
            this.changes = 0;
            this.last_sync = 0;

            for (let k in p) {
                if (p.hasOwnProperty(k))
                    this[k] = p[k];
            }
            
            // undo stack
            this.undos = [];
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

        encryption_pass(pass) {
            if (typeof pass !== "undefined") {
                this.clientStore.option("pass", pass);
                this.changes++;
                this.cloudStore.option("pass", pass);
            }
            return this.clientStore.option("pass");
        }

        /** Getter */
        user(u) {
            if (typeof u !== "undefined")
                return this.clientStore.option("user", u);
            return this.clientStore.option("user");
        }
        
        check_alarms(handler) {
            return this.hoard.check_alarms(handler);
        }

        /**
         * Promise to add an action to the client hoard. This will play
         * the action into the client tree, and also add the action
         * to the client actions list. It will not touch the cloud,
         * and does not save the client.
         * @param action the action to add
         */
        add_action(action) {
            this.changes++;
            this.hoard.push_action(action);
            return this.hoard.play_action(action);
        }

        undo() {
            Serror.assert(self.undos.length > 0);
            let a = self.undos.pop();
            a.time = Date.now();
            if (self.debug) self.debug("Undo", a);
            // Discard the most recent action in the action stream
            this.hoard.pop_action();

            // Replay the reverse of the action
            return this.hoard.play_action(a);
        }
        
        /**
         * Push an undo
         */
        push_undo(act) {
            this.undos.push(act);
        }

        /**
         * Return true if there is at least one undoable operation
         */
        can_undo() {
            let self = this;
            return self.undos.length !== 0;
        }

        /** Setter/getter */
        cloud_path(path) {
            if (typeof path !== "undefined" && path !== this.cloudPath) {
                if (this.debug) this.debug("Set cloud path", path);
                this.cloudPath = path;
                this.changes++;
            }
            return this.cloudPath;
        }

        /**
         * Iterate over pending actions
         */
        each_pending_action(handler) {
            for (let a of this.hoard.actions)
                handler(a);
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
         * store, then recreates the actions necessary to recreate the
         * hoard from the tree, playing them for the benefit of the caller. 
         * Does *not* play any explicit actions stored in the hoard.
         * @param on_action listener invoked on each action
         * @return Promise that resolves to {ok: true} if the load succeeded,
         * or {ok: false, reason:} otherwise
         */
        load_client(on_action) {
            let self = this;
            if (self.debug) self.debug('...load client');

            self.changes = 0;
            return self.clientStore.reads(CLIENT_PATH)
            .then((str) => {
                let data = JSON.parse(str);
                self.cloudPath = data.cloud_path;
                self.hoard = new Hoard(data.hoard, self.debug);

                // Reconstruct the actions and call on_action to
                // construct a UI representation
                if (typeof on_action === "function")
                    Hoard.actions_from_tree(self.hoard.tree, on_action);

                return Promise.resolve({ ok: true });
            })
            .catch((e) => {
                if (self.debug) self.debug("...client load failed", e);
                self.hoard = new Hoard();
                return Promise.resolve({ ok: false, reason: e });
            });
        }

        /**
         * @param progress object, see class def for details
         */
        save_client(progress) {
            let self = this;

            if (this.changes === 0) {
                if (this.debug) this.debug("... client unchanged");
                return Promise.resolve();
            }

            if (this.debug) this.debug("...save to client");

            // Make a serialisable data block
            let data = { cloud_path: this.cloudPath, hoard: this.hoard };
            let json = JSON.stringify(data);
            return this.clientStore.writes(CLIENT_PATH, json)
            .then(() => {
                if (this.debug) this.debug("...client write OK");
                if (progress) progress.push({
                    severity: "notice",
                    message: Translator.instance().tx("Saved in browser")
                });
                
                // READBACK CHECK - debug FireFucks, make sure what we wrote is still
                // readable
                return this.clientStore.reads(CLIENT_PATH)
                .then((json2) => {
                    if (json2 !== json) {
                        throw new Serror(500, "Readback check failed");
                    }
                    this.changes = 0;
                    return Promise.resolve();
                });
            })
            .catch((e) => {
                if (this.debug) this.debug("...client save failed", e);
                if (progress) progress.push({
                    severity: "error",
                    message: Translator.instance().tx("Failed to save in client store: $1", e)
                });
                return Promise.reject(e);
            });
        }

        /**
         * Promise to load cloud actions
         * @return a promise that resolves to a list of actions read from
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
                return Promise.resolve(actions);
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
                    message: Translator.instance().tx("Saved in cloud")
                });
                return Promise.resolve(true);
            })
            .catch((e) => {
                if (self.debug) self.debug("...cloud save failed " + e.stack);
                if (progress) progress.push({
                    severity: "error",
                    message: Translator.instance().tx("Failed to save in cloud store: $1", e)
                });
                return Promise.resolve(false);
            });
        }

        /**
         * Update (or load) the client hoard with actions from the cloud
         * that were applied since we last updated it. This is used both
         * when loading and when updating before saving.
         * @param progress object, see class def for details
         * @param {function} each_played called on each new action
         * played into the hoard. Not called on conflicts or skipped
         * actions.
         * @return a Promise that resolves to the list of actions read
         * from the cloud (and played into the hoard). Skipped actions are
         * included, but conflicting actions are not.
         */
        update_from_cloud(progress, each_played) {
            let self = this;
            let since = self.last_sync;
            if (self.debug) self.debug("Updating client from cloud");
            let prepare;
            // Reload and save the cloud hoard
            return self.load_cloud()
            .then((actions) => {
                self.last_sync = Date.now();
                if (self.debug) self.debug("...play cloud actions into client");
                let promise = Promise.resolve();
                let clean = [];
                for (let act of actions) {
                    if (act.time > since) {
                        promise = promise
                        .then(() => {
                            return self.hoard.play_action(act);
                        })
                        .then((ac) => {
                            if (ac.conflict) {
                                // Conflict can only arise if cloud change
                                // predates client change, but postdates last
                                // cloud read
                                progress.push({
                                    severity: "warning",
                                    message: ac.conflict
                                });
                                return;
                            }
                            each_played(ac.action);
                            clean.push(ac.action);
                            self.changes++;
                        });
                    }
                    else {
                        // Skipped action
                        clean.push(act);
                    }
                }
                return promise.then(() => { return Promise.resolve(clean); });
            })
            .catch((e) => {
                if (self.debug) self.debug("...cloud synch failed", e);
                if (progress) progress.push({
                    severity: "error",
                    message: Translator.instance().tx("Failed to refresh from cloud store")
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
            let actions = [];
            Hoard.actions_from_tree(
                self.hoard.tree,
                (a) => { actions.push(a) });
            return this.save_cloud(actions, progress);
        }
        
        /**
         * Synchronise the client and cloud so they reflect the
         * same content.
         * @param progress object, see class def for details
         * @param on_action listener invoked on each action that is
         * played into the client.
         * @return a Promise that resolves to the merged list of actions
         * that must be saved in the cloud.
         */
        synchronise(progress, on_action) {
            let self = this;
            
            // Pull the latest changes from the cloud. This will set
            // set this.cloud_actions if the update succeeds
            return this.update_from_cloud(
                progress,
                (act) => {
                    on_action(act);
                    this.changes++;
                })
            .then((actions) => {
                // 'actions' contains all actions form the cloud except
                // conflicting and duplicate actions.
                // Since these actions were already reflected in the tree
                // BEFORE the cloud was merged, there should be no conflicts
                // caused by these actions.
                actions = Hoard.merge_actions(
                    actions, this.hoard.actions);
                return actions;
            });
        }
    }

    return Hoarder;
});
