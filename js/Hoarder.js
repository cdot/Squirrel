/*@preserve Copyright (C) 2015-2019 Crawford Currie http://c-dot.co.uk license MIT*/
/* eslint-env browser,node */

/**
 * Management of two hoards, client and cloud
 */

define("js/Hoarder", ["js/Hoard"], function(Hoard) {

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
            return self.hoard.check_alarms(handler);
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
            if (self.undos.length === 0)
                throw new Error("Nothing to undo");

            let a = self.undos.pop();
            a.time = Date.now();
            if (self.debug) self.debug("Undo " + Hoard.stringify_action(a));
            // Discard the most recent action in the action stream
            this.hoard.pop_action();

            // Replay the reverse of the action
            return this.hoard.play_action(a);
        }
        
        /**
         * Push an undo
         */
        push_undo() {
            this.undos.push(Hoard.new_action.apply(null, arguments));
        }

        /**
         * Return true if there is at least one undoable operation
         */
        can_undo() {
            let self = this;
            return self.undos.length !== 0;
        }

        /** Setter/getter */
        client_mods(inc) {
            if (typeof inc === "number")
                this.changes += inc;
            return this.changes;
        }
        
        /** Setter/getter */
        cloud_path(path) {
            if (path !== this.cloudPath) {
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
         * @param prompt promise to return { user, pass }
         */
        authenticate_client(prompt) {
            
            if (!this.clientStore.option("needs_pass") &&
                typeof this.clientStore.option("user") !== "undefined") {
                if (this.debug) this.debug("...client doesn't need auth");
                return Promise.resolve(); 
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

            let self = this;
            return prompt(poss_user).then((user, pass) => {

                // Propagate to the stores
                self.clientStore.option("user", user);
                self.clientStore.option("pass", pass);

                if (self.cloudStore) {
                    self.cloudStore.option("user", user);
                    self.cloudStore.option("pass", pass);
                }
                if (self.debug) self.debug("...client authenticated");
            });
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
                self.hoard = new Hoard(data.hoard);

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
         * @param {Dialog} progress dialog
         */
        save_client(progress) {
            let self = this;

            if (self.changes === 0) {
                if (self.debug) self.debug("... client unchanged");
                return Promise.resolve(false);
            }

            if (self.debug) self.debug("...save to client");

            // Make a serialisable data block
            let data = { cloud_path: self.cloudPath, hoard: self.hoard };
            let json = JSON.stringify(data);
            self.clientStore.writes(CLIENT_PATH, json)
            .then(() => {
                if (self.debug) self.debug("...client write OK");
                if (progress) progress.push({
                    severity: "notice",
                    message: TX.tx("Saved in browser")
                });
                
                // READBACK CHECK - debug FireFucks, make sure what we wrote is still
                // readable
                return self.clientStore.reads(CLIENT_PATH)
                .then((json2) => {
                    if (json2 !== json)
                        throw "Readback check failed";
                    self.changes = 0;
                    return Promise.resolve(true);
                });
            })
            .catch((e) => {
                if (self.debug) self.debug("...client save failed " + e.stack);
                if (progress) progress.push({
                    severity: "error",
                    message: TX.tx("Failed to save in client store: $1", e)
                });
                return Promise.resolve(false);
            });
        }

        /**
         * Promise to load cloud actions
         * @return a promise that resolves to a list of actions read from
         * the cloud
         */
        load_cloud() {
            let self = this;

            return self.cloudStore.reads(self.cloudPath)
            .then((data) => {
                let actions = [];
                if (data.length > 0) {
                    if (self.debug) self.debug("...parsing cloud actions");
                    try {
                        actions = JSON.parse(data);
                    } catch (e) {
                        if (self.debug)
                            self.debug("...cloud hoard JSON parse failed:", e);
                        return Promise.reject(
                            new Error("Cloud store could not be parsed"));
                    }
                }
                else if (self.debug) self.debug("...cloud is empty");
                
                return Promise.resolve(actions);
            })
        }

        /**
         * Promise to save the given actions list in the cloud
         * @param actions list of actions to save in the cloud
         * @param {Dialog} progress dialog
         * @return a promise that resolves to true if the save succeeded
         */
        save_cloud(actions, progress) {
            let self = this;

            return self.cloudStore.writes(
                self.cloudPath,
                JSON.stringify(self.cloud.actions))
            .then(() => {
                if (self.debug) self.debug("...cloud save OK");

                if (progress) progress.push({
                    severity: "notice",
                    message: TX.tx("Saved in cloud")
                });
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
         * Update (or load) the client hoard with actions from the cloud
         * that were applied since we last updated it. This is used both
         * when loading and when updating before saving.
         * @param {Dialog} progress dialog
         * @param {function} each_action called on each new action
         * played into the hoard
         */
        update_from_cloud(progress, each_action) {
            let self = this;
            let since = self.last_sync;
            if (self.debug) self.debug("Updating client from cloud");
            let prepare;
            // Reload and save the cloud hoard
            self.cloud_actions = null;
            return self.load_cloud()
            .then((actions) => {
                self.last_sync = Date.now();
                if (self.debug) self.debug("...play cloud actions into client");
                self.cloud_actions = actions; // cache
                return self.hoard.play_actions(actions, since, each_action);
            })
            .catch((e) => {
                if (self.debug) self.debug("...cloud synch failed", e);
                if (progress) progress.push({
                    severity: "error",
                    message: TX.tx("Failed to refresh from cloud store")
                });
            });
        }

        /**
         * Synchronise the client and cloud hoards so they reflect the same content.
         */
        synchronise_and_save(progress, on_action) {
            // Pull the latest changes from the cloud
            self.update_from_cloud(
                progress,
                (e) => {
                    // triggered on each event read from the cloud that is not already
                    // reflected in the client.
                    if (e.conflict) {
                        // Conflict can only arise if cloud change predates client
                        // change, but postdates last cloud read
                        progress.push({
                            severity: "warning",
                            message: Hoard.stringify_action(e.event) +
                            ": " + e.conflict
                        });
                    } else {
                        on_action(e.event);
                        self.changes++;
                    }
                })
            .finally(() => {
                return self.save_client(progress);
            })
            .finally(() => {
                // merge client actions into the cloud
                if (self.cloud_actions)
                    // Cloud has existing actions
                    return self.save_cloud(Hoard.merge_actions(
                        self.cloud.actions, self.hoard.actions));
                else {
                    // Cloud has no actions; reconstruct the cloud from
                    // the tree
                    if (self.debug) self.debug("...reconstructing client actions for cloud");
                    return self.save_cloud(
                        Hoard.actions_from_tree(self.hoard.tree, on_action),
                        progress);
                }
            })
            .finally(() => true);
        }
    }

    return Hoarder;
});
