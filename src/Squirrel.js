/*@preserve Copyright (C) 2015-2019 Crawford Currie http://c-dot.co.uk license MIT*/
/* eslint-env browser,jquery */

define(['js/Serror', 'js/Utils', "js/Dialog", "js/Hoard", "js/LocalStorageStore", "js/EncryptedStore", "js/Translator", "js/Tree", "clipboard", "cookie", "jsjq/simulated_password", "jsjq/scroll_into_view", "jsjq/icon_button", "jsjq/styling", "jsjq/template", "jsjq/twisted", "jquery", "jquery-ui", "mobile-events", "contextmenu" ], function(Serror, Utils, Dialog, Hoard, LocalStorageStore, EncryptedStore, Translator, Tree, ClipboardJS, Cookies) {
    let TX = Translator.instance();

    /*
     * The application startup process proceeds from "init_application" though
     * a sequence of chained functions called 'step_*'. These functions are
     * mostly run asynchronously. Once the final step is reached, control is
     * handed off to the Tree module, which governs most interaction.
     * reached
     */

    // Store statii
    // TX.tx("has new settings")
    const NEW_SETTINGS = "has new settings";
    // TX.tx("is loading")
    const IS_LOADING = "is loading";
    // TX.tx("is loaded")
    const IS_LOADED = "is loaded";
    // TX.tx("is corrupt")
    const IS_CORRUPT = "is corrupt";
    // TX.tx("is empty")
    const IS_EMPTY = "is empty";

    class Squirrel {

        // Internal clipboard
        constructor(options) {
            let self = this;

            self.options = options || {};

            if (options.debug) {
                self.debug = console.debug;
                self.debug("Debug enabled");
                // Option to dump the JSON for the cloud database on load.
                // Requires debug.
                self.dumpCloud = options.dump_cloud;
            }

            self.cloudStorageProvider = options.cloudStore;

            self.clipboard = null;

            self.$DOMtree = null;

            // undo stack
            self.undos = [];

            // Pointer to tree widget at root of DOM tree
            //self.DOMtree;

            // Node that is the target of a context menu operation
            self.$menuTarget;

            // For unknown reasons, we get a taphold event on mobile devices
            // even when a taphold hasn't happened. So we have to selectively
            // disable the context menu :-(
            self.contextMenuDisables = 0;

            // The user currently engaged with us
            self.user = null;
            
            // pathname of the cloud store
            self.cloud_path = null;
            
            // status may be one of IS_EMPTY, IS_CORRUPT, IS_LOADED or
            // NEW_SETTINGself. If the status is anything but IS_LOADED
            // then it is a candidate for saving.
            self.client = {
                store: null, // The store used actively
                hoard: null, // The hoard in that store
                status: IS_EMPTY
            };

            self.cloud = {
                store: null, // Temporary memory used during load
                hoard: null, // The hoard in that store
                status: IS_EMPTY
            };

            // Special keys in sort ordering
            self.sort_prio = [
                TX.tx("A new folder"),
                TX.tx("A new value"),
                TX.tx("User"),
                TX.tx("Pass")
            ];

            self.client_ok = true;
            self.cloud_ok = true;

            self.last_search = "";
            self.picked_hit = 0;
        }

        hideValues(on) {
            if (typeof on !== undefined)
                Tree.hidingValues = on;
            return Tree.hidingValues;
        }
        
        encryptionPass(p) {
            this.client.store.option("pass", p);
            this.client.status = NEW_SETTINGS;
            this.cloud.store.option("pass", p);
            this.cloud.status = NEW_SETTINGS;
            this.trigger("update_save");
        }
        
        // Event handler code for "check_alarms" event
        _handle_alarms( /* event */ ) {
            let self = this;
            self.client.hoard.check_alarms(
                function (path, expired) {
                    let $node = self.$DOMtree.tree("getNodeFromPath", path);
                    $node.tree("ringAlarm");
                    return Dialog.confirm("alert").then((dlg) => {
                        dlg.add({
                            severity: "warning",
                            message:
                            "<div class='ui-icon squirrel-icon-rang'></div>" +
                                TX.tx("Reminder on '$1' was due on $2",
                                      path.join("↘"),
                                      expired.toLocaleDateString())
                        });
                    });
                });
        }

        // Determine if there are unsaved changes, and generate a warning
        // message for the caller to use.
        _unsaved_changes(max_changes) {
            let self = this;
            let message = [];

            $(".tree-modified")
                .each(function () {
                    if (!$(this)
                        .tree("getPath") &&
                        !$(this)
                        .hasClass("tree-root")) {
                        throw new Error("ASSERT: Missing data-path");
                    }
                    let path = $(this)
                        .data("path") || [];
                    message.push(TX.tx("$1 has changed",
                                       path.join("↘")));
                });

            if (message.length > max_changes) {
                let l = message.length;
                message = message.slice(0, max_changes);
                message.push(TX.tx("... and $1 more change$?($1!=1,s,)", l - 5));
            }

            if (self.cloud.status !== IS_LOADED) {
                message.unshift(TX.tx("The $1 hoard $2",
                                      self.cloud.store ?
                                      self.cloud.store.option("type") :
                                      TX.tx("Cloud"),
                                      TX.tx(self.cloud.status)));
            }
            if (self.client.status !== IS_LOADED) {
                message.unshift(TX.tx("The $1 hoard $2",
                                      self.client.store.option("type"),
                                      TX.tx(self.client.status)));
            }

            if (message.length === 0)
                return null;

            return message.join("\n");
        }

        _finished_save(progress) {
            let self = this;
            if (self.debug) self.debug("...save finished");
            $(document).trigger("update_save");
            if (self.client_ok && self.cloud_ok) {
                if (progress) {
                    if (Cookies.get("ui_autosave") === "on")
                        progress.close();
                    else
                        // Otherwise leave alert open
                        progress.add({
                            severity: "notice",
                            message: TX.tx("Save complete")
                        });
                }

            } else {
                if (progress) progress.add({
                    severity: "error",
                    message: TX.tx("Save encountered errors")
                });
                Cookies.set("ui_autosave", "off", {
                    expires: 365
                });
            }
        }

        _write_client_store(progress) {
            let self = this;

            // Make a serialisable data block
            let client = {};
            for (let f in self.client) {
                // We don't want to serialize the store
                if (self.client.hasOwnProperty(f) && f !== "store")
                    client[f] = self.client[f];
            }
            
            let p = self.client.store.writes(
                self.user,
                JSON.stringify(client))
                .then(() => {
                    if (self.debug) self.debug("...client save OK");
                    $(".tree-modified")
                        .removeClass("tree-modified");
                    self.client.status = IS_LOADED;
                    if (progress) progress.add({
                        severity: "notice",
                        message: TX.tx("Saved in $1", self.client.store.option("type"))
                    });
                })
                .catch((e) => {
                    if (self.debug) self.debug("...client save failed " + e);
                    if (progress) progress.add({
                        severity: "error",
                        message: TX.tx("Failed to save in $1: $2",
                                       self.client.store.option("type"), e)
                    });
                    self.client_ok = false;
                });
            return p.then(() => { return self._finished_save(progress); });
        }

        _save_client(progress) {
            let self = this;
            if (self.debug) self.debug("...save to client");

            if (self.client.status === IS_LOADED &&
                $(".tree-modified")
                .length === 0) {
                self._finished_save(progress);
                return Promise.resolve();
            }

            self.client.status = self.PENDING_SAVE;

            return self._write_client_store(progress);
        }

        _write_cloud_store(progress) {
            // Cloud doesn't need the cache. Could kill it, but it's
            // small and there's not much advantage to doing so.
            let self = this;

            return self.cloud.store.writes(
                self.cloud_path,
                JSON.stringify(self.cloud.hoard))
                .then(() => {
                    if (self.debug) self.debug("...cloud save OK");
                    self.client.hoard.actions = [];
                    self.client.hoard.last_sync = Date.now();
                    // Can  no longer undo
                    self.undos = [];
                    if (progress) progress.add({
                        severity: "notice",
                        message: TX.tx("Saved in $1", self.cloud.store.option("type"))
                    });
                    self.cloud.status = IS_LOADED;
                })
                .catch((e) => {
                    if (self.debug) self.debug("...cloud save failed " + e);
                    if (progress) progress.add({
                        severity: "error",
                        message: TX.tx("Failed to save in $1: $2",
                                       self.cloud.store.option("type"), e)
                    });
                    self.cloud_ok = false;
                });
        }

        // Save into the cloud.
        _update_cloud_store(progress) {
            let self = this;

            self.cloud.hoard.merge_actions(self.client.hoard.actions);

            if (!self.cloud.store) {
                if (self.debug) self.debug("...no cloud store");
                return Promise.resolve();
            }

            if (self.debug) self.debug("...save to cloud");

            self.cloud.status = self.PENDING_SAVE;

            return self._write_cloud_store(progress)
                .then(() => {
                    return self._save_client(progress);
                });
        }

        // Promise to construct a new cloud hoard from data in the
        // client. This will happen if the cloud is read and found to
        // be empty or corrupt, but not if the read failed.
        // Public because it will be called form the optimise dialog.
        construct_new_cloud(progress) {
            let self = this;
            if (self.debug) self.debug("...construct cloud ");
            self.cloud.hoard = new Hoard({name: "new Cloud"});
            return self.client.hoard.reconstruct_actions(
                function (a, next) {
                    // this:Hoard, a:Action, next:function
                    self.cloud.hoard.push_action(a);
                    if (next)
                        next();
                })
                .then(() => {
                    return self._update_cloud_store(progress);
                });
        }

        // Promise to handle the cloud store being reloaded prior to a
        // save action.  The actions read from the cloud have to be
        // merged into the client before the save is completed. SMELL:
        // There's a risk of a race condition here if the cloud is
        // updated while we are still updating the client. Some sort
        // of locking could be done, but strikes me as overkill.
        _cloud_store_reloaded_ok(data, progress) {
            let self = this;
            if (self.debug) self.debug("...cloud read OK ");
            let p;
            try {
                self.cloud.hoard = new Hoard({name: "reloaded Cloud", data: data});
                self.cloud.status = IS_LOADED;
                p = Promise.resolve();
            } catch (e) {
                // We'll get here if decryption failed....
                if (self.debug) self.debug("Cloud hoard JSON parse failed: " + e);
                if (progress) progress.add({
                    severity: "error",
                    message: TX.tx("$1 hoard can't be read for update",
                                   self.cloud.store.option("type"))
                });
                self.cloud.status = IS_CORRUPT;
                self.cloud_ok = false;
                p = self.construct_new_cloud(progress);
            }
            return p.then(() => {
                if (self.cloud.status === IS_LOADED) {
                    if (self.debug) self.debug("...merge cloud ");
                    /*let conflicts = */
                    return self.client.hoard.play_actions(
                        self.cloud.hoard.actions,
                        function (e) {
                            // asynchronous listener
                            // this:Hoard, e:Action
                            self.$DOMtree.tree("action",e);
                        },
                        function (percent) {
                            $("#merge_progress")
                                .text(percent + "%");
                        });
                }
            }).then(() => {
                // Only save if there area actually some changes
                if (self.cloud.status !== IS_LOADED ||
                    self.client.hoard.actions.length !== 0) {
                    if (self.debug) self.debug("...update from cloud: " + self.cloud.status);
                    return self._update_cloud_store(progress);
                }
                return Promise.resolve();
            });
        }

        _save_hoards(progress) {
            let self = this;

            self.client_ok = true;
            self.cloud_ok = true;

            if (self.debug) self.debug("Saving; client " + self.client.status +
                                       "; cloud " + self.cloud.status);
            if (self.cloud.status === NEW_SETTINGS ||
                self.cloud.status === IS_EMPTY) {
                // Don't attempt to resync out before saving, simply
                // overwrite the cloud.
                if (self.debug) self.debug("...constructing new cloud because settings");
                return self.construct_new_cloud(progress);
            } else {
                // Reload and save the cloud hoard
                if (self.debug) self.debug("...reloading cloud");
                return self.cloud.store.reads(self.cloud_path)
                    .then(() => {
                        return self._cloud_store_reloaded_ok(progress);
                    })
                    .catch((e) => {
                        if (self.debug) self.debug("...cloud read failed " + e);
                        if (progress) progress.add({
                            severity: "error",
                            message: TX.tx("Failed to refresh from $1: $2",
                                           self.cloud.store.option("type"), e)
                        });
                        self.cloud_ok = false;
                        return Promise.resolve();
                    });
            }
        }

        /// Evemnt handler for "update_save" event
        _handle_update_save( /*event*/ ) {
            let self = this;
            $("#undo_button").toggle(self.can_undo());
            let $sb = $("#save_button");
            let autosave = (Cookies.get("ui_autosave") === "on");
            let us = self._unsaved_changes(3);

            if (us === null)
                $sb.hide(); // nothing to save
            else if (autosave) {
                $sb.hide();
                self._save_hoards(false).then(() => {
                    return self._save_client(false)
                });
            } else {
                $sb.attr(
                    "title",
                    TX.tx("Save is required because") + ": " + us);
                $sb.show();
            }
        }

        /**
         * Public as it's used from dialogs/extras.js
         * @param force true to force the dialog even if there is nothing to
         * prompt for
         */
        get_store_settings(force) {
            let self = this;
            
            let needs_path = (this.cloud.store.option("needs_path") &&
                              !this.cloud_path) || force;
            let needs_image = this.cloud.store.option("needs_image") || force;

            if (!(needs_path || needs_image))
                return Promise.resolve();

            return Dialog.confirm("store_settings", {
                needs_image: needs_image,
                needs_path: needs_path,
                path: this.cloud_path
            })
            .then((dlg) => {
                if (needs_path) {
                    let path = dlg.control("path").val();
                    if (self.cloud_path !== path) {
                        self.cloud_path = path;
                        if (self.client.status === IS_LOADED)
                            self.client.status = NEW_SETTINGS;
                    }
                    if (needs_image) {
                        if (self.client.status === IS_LOADED)
                            self.client.status = NEW_SETTINGS;
                        if (self.cloud.status === IS_LOADED)
                            self.cloud.status = NEW_SETTINGS;
                    }
                    $(document).trigger("update_save");
                }
            });
        }
        
        // Final step before allowing interaction
        step_7_interact() {
            let self = this;
            return new Promise((resolve) => {
                if (self.debug) self.debug('step_7_interact');
                $("#whoami")
                    .text(self.user);
                $("#unauthenticated")
                    .hide();
                $("#authenticated")
                    .show();

                // Open the root node
                $("#sites-node").tree("open");
                resolve();
            });
        }

        // Last in the initial hoard load sequence
        step_6_hoards_loaded() {
            let self = this;
            return new Promise((resolve) => {
                if (self.debug) self.debug('step_6_hoards_loaded');
                $(window)
                    .on("beforeunload", function () {
                        let us = self._unsaved_changes(10);
                        if (us !== null) {
                            us = TX.tx("You have unsaved changes") +
                                "\n" + us +
                                "\n" + TX.tx("Are you really sure?");
                            return us;
                        }
                    });
                $(document).trigger("update_save");
                $(document).trigger("check_alarms");
                resolve();
            });
        }

        // Optional initialisation step, executed when both hoards are
        // known to have loaded successfully.
        step_5a_merge_from_cloud() {
            let self = this;
            if (self.debug) self.debug('step_5a_merge_from_cloud');
            return self.client.hoard.play_actions(
                self.cloud.hoard.actions,
                function (e, c, p) {
                    $("#merge_progress")
                        .text(p + "%");

                    // e:Action [, c: Conflict]
                    if (c) {
                        Dialog.open("alert", {
                            alert: {
                                severity: "warning",
                                message: Hoard.stringify_action(e) +
                                    ": " + c.message
                            }
                        });
                    } else
                        self.$DOMtree.tree("action",e);
                })
                .then((conflicts) => {
                    if (!conflicts || conflicts.length === 0)
                        return;
                    Dialog.open("alert", {
                        title: TX.tx("Warning"),
                        alert: {
                            severity: "warning",
                            message: TX.tx("Conflicts were detected while merging actions from the Cloud.")
                                + " "
                                + TX.tx("Please review these rejected actions, and make sure the data displayed is correct before saving.")
                        }
                    }).then((report) => {
                        $.each(conflicts, function (i, c) {
                            report.add({
                                severity: "warning",
                                message: c
                            });
                        });
                    });
                })
                .then(() => {
                    self.cloud.status = IS_LOADED;
                });
        }

        /**
         * STEP 6: Called when we have a (possibly empty) client hoard.
         * Try and synch it from the self.cloud.
         */
        step_5_load_cloud_hoard() {
            let self = this;

            if (self.debug) self.debug('step_5_load_cloud_hoard');

            let store = self.cloud.store;
            if (store)
                return Promise.resolve(false);


            $("#stage")
                .text(TX.tx("Reading from cloud"));
            let p;

            // Make sure we have a store path. The client
            // store records the path, which is used to load
            // the cloud store/
            if (self.cloud_path)
                p = Promise.resolve();
            // Use the settings dlg to set the store path
            else
                p = self.get_store_settings();

            return p.then(() => {
                return store.reads(self.cloud_path);
            })
            .then((data) => {
                if (data.length === 0) {
                    if (self.debug) self.debug(
                        store.option("type") + " is empty");
                    self.cloud.status = IS_EMPTY;
                    return Promise.resolve();
                }

                if (self.debug) self.debug(
                    store.option("type") + " is ready to be read");

                try {
                    self.cloud.hoard = new Hoard({name: "loaded Cloud", data: data});
                } catch (e) {
                    if (self.debug) self.debug(
                        "Cloud hoard JSON parse failed: " + e + data);
                    Dialog.open("alert", {
                        title: TX.tx("Error"),
                        alert: {
                            severity: "error",
                            message: TX.tx(
                                "Cloud store exists, but can't be read.",
                                store.option("type")) +
                                " " +
                                TX.tx(
                                    "Check that you have the correct password.")
                        }
                    });
                    self.cloud.status = IS_CORRUPT;
                }

                return Promise.resolve(true);
            })
            .catch((e) => {
                if (e instanceof Serror && e.status === 404) {
                    if (self.debug) self.debug(
                        self.cloud_path + " not found in the cloud");
                    Dialog.open("alert", {
                        title: TX.tx("Error"),
                        alert: {
                            severity: "error",
                            message: TX.tx("Could not load cloud store")
                        }
                    }).add({
                        severity: "notice",
                        message: TX.tx("Check that the cloud store exists and you have the correct password.")
                    });
                    // Could not contact cloud; continue all the same
                }
                return Promise.resolve(false);
            });
        }

        /**
         * Once the stores have been initialised, we can load
         * the client hoard. This will give us the baseline cache data and the
         * location of the cloud hoard, so we can then chain loading and merging
         * the cloud hoard.
         *
         * This will prompt for encryption details.
         */
        step_3_load_client_hoard() {
            let self = this;

            self.client.status = IS_LOADING;
            if (self.debug) self.debug('step_3_load_client_hoard');


            $("#stage")
                .text(TX.tx("Reading from client"));
            return self.client.store.reads(self.user)
            .then((str) => {
                let data = JSON.parse(str);
                self.cloud_path = data.cloud_path;
                return Promise.resolve(data.hoard);
            })
            .then((hoard) => {
                try {
                    self.client.hoard = new Hoard(
                        { name: "loaded Client", data: hoard });
                    self.client.status = IS_LOADED;
                    return Promise.resolve();
                } catch (e) {
                    if (self.debug) self.debug("Caught " + e);
                    throw new Error(
                        TX.tx("Client exists, but can't be read.",
                              self.client.store.option("type"))
                    + TX.tx("Check that you have the correct password."));
                }
            })
            .then(() => {
                if (self.debug) self.debug("Reconstructing client actions");
                $("#stage")
                    .text(TX.tx("Building UI"));
                return self.client.hoard.reconstruct_actions(
                    function (a, next) {
                        // this:Hoard, a:Action, next:function
                        self.$DOMtree.tree("action", a, null, next);
                    })
            })
            .then(() => {
                // Reset the UI modification list; we just loaded the
                // client hoard
                $(".tree-modified")
                    .removeClass("tree-modified");
                // Mark all the nodes in the pending actions list as
                // modified. If a node isn't found, back up the tree
                // until we find a parent that does exist and mark it.
                let acts = self.client.hoard.actions,
                    i, p, $node;
                for (i = 0; i < acts.length; i++) {
                    p = acts[i].path.slice();
                    while (p.length > 0) {
                        $node = self.$DOMtree.tree("getNodeFromPath", p);
                        if ($node) {
                            $node.addClass("tree-modified");
                            break;
                        }
                        p.pop();
                    }
                }
            })
            .catch((e) => {
                if (e instanceof Serror && e.status === 404) {
                    // A 404 means the path to the store did not exist
                    // but that doesn't mean it can't be used.
                    self.client.hoard = new Hoard({name: "new Client"});
                    return Dialog.confirm("alert", {
                        title: TX.tx("Error"),
                        alert: {
                            severity: "error",
                            message: TX.tx(
                                "$1 for client not found. Continuing will create one.",
                                self.client.store.option("type"))
                        }
                    });
                }
                return Dialog.confirm("alert", {
                    title: TX.tx("Error"),
                    alert: {
                        severity: "error",
                        message: TX.tx(
                            "$1 store error: $2",
                            self.client.store.option("type"), e.message)
                    }
                }).then(() => {
                    $(document).trigger("init_application");
                    return Promise.reject();
                });
            });
        }

        /**
         * 401 network login
         */
        _network_login(role) {
            let self = this;

            if (self.debug) self.debug(role, "network login");

            return Dialog.confirm("login", {
                title: TX.tx("Network login for $1 store", role),
                // Copy default user from the stores if there
                user: self.user ||
                    self.cloud.store.option("user") ||
                    self.client.store.option("user")
            }).then((dlg) => {
                let user = dlg.control("user").val();
                let pass = dlg.control("pass").val();
                if (self.debug)
                    self.debug("Login prompt said user was " + user);
                self[role].store.option("net_user", user);
                self[role].store.option("net_pass", pass);
            });
        }

        /**
         * STEP 2: Initialise the client store. This sets up the store
         * but doesn't read anything yet. Initialisation of the client
         * store *may* provide user information, but it will be
         * overridden by any user information coming from the cloud
         * store.
         */
        step_2_init_client_store() {
            let self = this;
            if (self.debug) self.debug('step_2_init_client_store');

            self.client.store = new LocalStorageStore({
                role: "client",
                debug: self.debug
            });

            // Add encryption layer unless we have been requested not to
            // (probably for debugging)
            if (typeof self.options.plaintext === "undefined") {
                if (self.debug) self.debug('adding encryption to client');
                self.client.store = new EncryptedStore({
                    understore: self.client.store
                });
            }

            $("#stage").text(TX.tx("Authentication"));
            
            // Initialisation of the cloud store may have provided
            // initial user information, either from a network login
            // or from a service login. Seed the login dialog with one
            // of them.
            return Dialog.confirm("login", {
                title: "User details",
                user: self.cloud.store.option("user") ||
                    self.cloud.store.option("net_user")
            })
            .then((dlg) => {
                let user = dlg.control("user").val();
                let pass = dlg.control("pass").val();

                self.user = user;

                // Propagate to the stores
                self.client.store.option("user", user);
                self.client.store.option("pass", pass);

                self.cloud.store.option("user", user);
                self.cloud.store.option("pass", pass);
            })
            .then(() => {
                return self.client.store.init({
                    role: "client",
                    network_login: () => {
                        return self._network_login("client");
                    }
                })
                .then(() => {
                    if (self.debug) self.debug("Client store is ready");
                });
            });
        }

        /**
         * STEP 1: Initialise the cloud store. Initialisation of the cloud
         * store *may* provide user information - for example, initialisation
         * of a GoogleDriveStore will require a google login to a specific
         * user. We leverage this to get initial user information which
         * can be used in determining the encryption user for the client
         * store.
         */
        step_1_init_cloud_store() {
            let self = this;
            if (self.debug) self.debug('step_1_init_cloud_store');
            let store;
            
            let p = new Promise(function(res,rej) {
                requirejs(
                    ["js/" + self.cloudStorageProvider],
                    function(module) {
                        store = new module({
                            role: "cloud",
                            debug: self.debug
                        });
                        res(store);
                    },
                    function(e) {
                        rej(e);
                    });
            });

            if (typeof self.options.plaintext === "undefined") {
                if (self.debug) self.debug('adding encryption to cloud');
                p = p.then(() => {
                    store = new EncryptedStore({
                        debug: self.debug,
                        understore: store
                    })
                });
            }
            
            return p.then(() => {
                console.log("Init",store);
                return store.init({
                    role: "cloud",
                    network_login: () => {
                        return self._network_login("cloud");
                    }
                })
            })
            .then(() => {
                self.cloud.store = store;
                if (typeof self.cloud.store.option("user") !== "undefined")
                    self.user = self.cloud.store.option("user");
            })
            .catch((e) => {
                return Dialog.confirm("alert", {
                    title: TX.tx("Warning"),
                    alert: {
                        severity: "warning",
                        message: TX.tx("Could not open cloud store: $1", e)
                            + TX.tx("If you continue, only the client store will be available"),
                    }
                });
            });
        }

        // CONTEXT MENU
        
        _context_menu(f) {
            let self = this;
            switch (f) {
            case "enable":
                if (self.contextMenuDisables > 0)
                    self.contextMenuDisables--;
                if (self.debug) self.debug("Context menu disables " +
                                           self.contextMenuDisables);
                if (self.contextMenuDisables <= 0)
                    $("body").contextmenu("option", "autoTrigger", true);
                break;
            case "disable":
                self.contextMenuDisables++;
                if (self.debug) self.debug("Context menu disables " +
                                           self.contextMenuDisables);
                $("body").contextmenu("option", "autoTrigger", false);
                break;
            default:
                return $("body")
                    .contextmenu(f);
            }
        }

        _before_menu_open(ui) {
            let self = this;
            if (self.contextMenuDisables > 0)
                return false;

            let $node = (ui.target.is(".tree-node")) ?
                ui.target :
                ui.target.closest(".tree-node");

            let has_alarm = typeof $node.data("alarm") !== "undefined";
            let is_leaf = $node.hasClass("tree-leaf");
            let is_root = ui.target.closest(".tree-node")
                .hasClass("tree-root");
            let is_open = $node.hasClass("tree-node-is-open");
            let $root = $("body");

            if (self.debug) self.debug("beforeOpen contextmenu on " + $node.data("key") +
                                       " " + is_leaf);

            $root
                .contextmenu("showEntry", "add_alarm", !has_alarm && !is_root)
                .contextmenu("showEntry", "add_subtree",
                             is_open && !is_leaf)
                .contextmenu("showEntry", "add_value",
                             is_open && !is_leaf && !is_root)
                .contextmenu("showEntry", "copy_value", is_leaf)
                .contextmenu("showEntry", "delete", !is_root)
                .contextmenu("showEntry", "edit", is_leaf)
                .contextmenu("showEntry", "insert_copy", !is_leaf && (typeof self.clipboard !== "undefined"))
                .contextmenu("showEntry", "make_copy", !is_root && !is_leaf)
                .contextmenu("showEntry", "pick_from", is_leaf)
                .contextmenu("showEntry", "randomise", is_leaf)
                .contextmenu("showEntry", "rename", !is_root);

            self.$menuTarget = $node;
        }

        /**
         * Handler for context menu items
         */
        _handle_menu_choice(ui) {
            let self = this;
            let $node = self.$menuTarget;
            
            if (!$node) {
                if (self.debug) self.debug("No node for contextmenu>" + ui.cmd);
                return;
            }

            switch (ui.cmd) {
            case "copy_value":
                self.clipboard = $node.data("value");
                break;

            case "make_copy":
                self.clipboard = JSON.stringify(self.client.hoard.get_node($node.tree("getPath")));
                break;

                /* Can't get it to work like this - would need an intermediate
                   element that a Ctrl+V event happens on.
                   case "paste":
                   document.designMode = "on";
                   $(window).on("paste", function(e) {
	           let   systemPasteContent =
                   e.clipboardData.getData("text/plain");
                   });
                   $("#pasteboard").focus();
                   document.execCommand("Paste");
                   break;
                   /**/

            case "insert_copy":
                if (self.clipboard) {
                    let data = JSON.parse(self.clipboard);
                    Dialog.open("insert", {
                        $node: $node,
                        data: data
                    });
                }
                break;

            case "rename":
                $node.tree("editKey");
                break;

            case "edit":
                $node.tree("editValue");
                break;

            case "add_value":
                Dialog.open("add", {
                    $node: $node,
                    is_value: true
                });
                break;

            case "add_subtree":
                Dialog.open("add", {
                    $node: $node,
                    is_value: false
                });
                break;

            case "randomise":
                Dialog.open("randomise", {
                    $node: $node
                });
                break;

            case "add_alarm":
                Dialog.open("alarm", {
                    $node: $node
                });
                break;

            case "delete":
                Dialog.open("delete", {
                    $node: $node
                });
                break;

            case "pick_from":
                Dialog.open("pick", {
                    $node: $node
                });
                break;

            default:
                throw new Error("ERROR: unrecognised command " + ui.cmd);
            }
        }

        _init_menus() {
            let self = this;
            let menu = {
                delegate: ".tree-title",
                menu: [
                    {
                        title: TX.tx("Copy value"),
                        cmd: "copy_value",
                        uiIcon: "squirrel-icon-copy squirrel-icon"
                    },
                    /* Can't get it to work
                       {
                       title: TX.tx("Paste"),
                       cmd: "paste",
                       uiIcon: "squirrel-icon-paste squirrel-icon"
                       },
                       /**/
                    {
                        title: TX.tx("Pick characters"),
                        cmd: "pick_from",
                        uiIcon: "squirrel-icon-pick squirrel-icon"
                    },
                    {
                        title: TX.tx("Rename"),
                        cmd: "rename",
                        uiIcon: "squirrel-icon-edit squirrel-icon"
                    },
                    {
                        title: TX.tx("Edit value"),
                        cmd: "edit",
                        uiIcon: "squirrel-icon-edit squirrel-icon"
                    },
                    {
                        title: TX.tx("Add reminder"),
                        cmd: "add_alarm",
                        uiIcon: "squirrel-icon-alarm squirrel-icon"
                    },
                    {
                        title: TX.tx("Generate new random value"),
                        cmd: "randomise",
                        uiIcon: "squirrel-icon-key squirrel-icon"
                    },
                    {
                        title: TX.tx("Add new value"),
                        cmd: "add_value",
                        uiIcon: "squirrel-icon-add-value squirrel-icon"
                    },
                    {
                        title: TX.tx("Add new folder"),
                        cmd: "add_subtree",
                        uiIcon: "squirrel-icon-add-folder squirrel-icon"
                    },
                    {
                        title: TX.tx("Copy folder"),
                        cmd: "make_copy",
                        uiIcon: "squirrel-icon-copy squirrel-icon"
                    },
                    {
                        title: TX.tx("Insert copy of folder"),
                        cmd: "insert_copy",
                        uiIcon: "squirrel-icon-paste squirrel-icon"
                    },
                    {
                        title: TX.tx("Delete"),
                        cmd: "delete",
                        uiIcon: "squirrel-icon-delete squirrel-icon"
                    }
                ],
                preventContextMenuForPopup: true,
                preventSelect: true,
                //taphold: true,
                beforeOpen: function (e, ui) { self._before_menu_open(ui); },
                select: function (e, ui) { self._handle_menu_choice(ui); }
            };

            $("body")
                .contextmenu(menu);

            self.valueCopyClipboard =
                new ClipboardJS(".ui-contextmenu li[data-command='copy_value']", {
                    text: function () {
                        let $node = self.$menuTarget;
                        if (self.debug) self.debug("clip val from: " +
                                                   $node.data("key"));
                        return $node.data("value");
                    }
                });

        }

        _init_clipboard() {
            self.treeCopyClipboard =
                new ClipboardJS(".ui-contextmenu li[data-command='make_copy']", {
                    text: function () {
                        let $node = self.$menuTarget;
                        if (self.debug) self.debug("clip json from: " +
                                                   $node.data("key"));
                        let p = $node.tree("getPath");
                        let n = self.client.hoard.get_node(p);
                        return JSON.stringify(n);
                    }
                });
        }

        /**
         * Event handler for "init_application" event
         * Promise to initialise application (new Squirrel(), effectively)
         */
        _handle_init_application() {
            let self = this;
            // Kick off by initialising the cloud store.
            $("#stage")
                .text(TX.tx("Loading application"));
            return self.step_1_init_cloud_store()
                .then(() => {
                    return self.step_2_init_client_store();
                })
                .then(() =>{
                    return self.step_3_load_client_hoard();
                })
                .then(() =>{
                    return self.step_5_load_cloud_hoard();
                })
                .then((merge) => {
                    if (merge)
                        return self.step_5a_merge_from_cloud();
                    return Promise.resolve();
                })
                .then(() => {
                    return self.step_6_hoards_loaded();
                })
                .then(() => {
                    return self.step_7_interact();
                });
        }

        /**
         * Main entry point for the application
         */
        init_ui() {
            let self = this;

            $.styling.init(self.options);

            Tree.playAction = (action) => {
                return self.playAction(action);
            };
            Tree.onOpenEditor = () => { self._context_menu("disable"); };
            Tree.onCloseEditor = () => { self._context_menu("enable"); };
            Tree.onHoverIn = () => {
                self._context_menu("close"); return false;
            };
            Tree.onHoverOut = () => {
                return self._context_menu("isOpen");
            };
            Tree.hidingValues = () => {
                return (Cookies.get("ui_hidevalues") === "on");
            };

            self.$DOMtree = $("#sites-node");
            self.$DOMtree.tree({});

            // Set options for squirrel dialogs
            Dialog.set_default_options({
                autoOpen: false,
                app: this,
                debug: self.debug
            });
            $("#sites-node button.tree-open-close").icon_button();
            $("#help_button")
                .icon_button()
                .on("click", function() {
                    let url = requirejs.toUrl("help.html");
                    $(this).closest("a").attr("href", url);
                    return true;
                });

            $("#save_button")
                .icon_button()
                .hide()
                .on($.getTapEvent(), ( /*evt*/ ) => {
                    Dialog.open("alert", {
                        title: "Saving"
                    }).then((progress) => {
                        self._save_hoards(progress).then(() => {
                            return self._save_client(progress);
                        });
                    });
                    return false;
                });

            $("#undo_button")
                .icon_button()
                .hide()
                .on($.getTapEvent(), function ( /*evt*/ ) {
                    self.undo(function (mess) {
                        Dialog.open("alert", {
                            title: "Undo",
                            alert: {
                                severity: "error",
                                message: mess
                            }
                        });
                    });
                    return false;
                });

            $("#extras_button")
                .icon_button()
                .on($.getTapEvent(), function ( /*evt*/ ) {
                    Dialog.open("extras");
                });

            $("#search_input")
                .on("change", function ( /*evt*/ ) {
                    self.search($(this)
                                .val());
                });

            $("#search_button")
                .icon_button()
                .on($.getTapEvent(), function ( /*evt*/ ) {
                    self.search($("#search_input")
                                .val());
                });

            self._init_menus();

            self._init_clipboard();

            // Set up event handlers
            $(document)
                .on("init_application", () => {
                    self._handle_init_application();
                })
                .on("check_alarms", () => {
                    self._handle_alarms();
                })
                .on("update_save", () => {
                    self._handle_update_save();
                });

            $.styling.reset();
        }

        /**
         * Perform a (manual) new tree node action
         */
        add_child_node($node, title, value) {
            let self = this;
            let p = $node.tree("getPath");
            p = p.concat(title);
            let e = self.client.hoard.push_action(
                "N", p, Date.now(),
                (typeof value === "string") ? value : undefined);

            function newnode($newnode) {
                if (!$newnode)
                    throw new Error("ERROR: node creation failed");
                
                if (typeof value !== "string" && typeof value !== "undefined")
                    self.insert_data($newnode.tree("getPath"), value);
                $newnode.tree("open", {
                    decorate: true
                });
            }
            
            self.client.hoard.play_action(e)
                .then((res) => {
                    if (res.conflict)
                        Dialog.open("alert", {
                            alert: {
                                severity: "warning",
                                message: res.conflict
                            }
                        });
                    else
                        // this:Hoard, e:Action
                        self.$DOMtree.tree(
                            "action",
                            res.event,
                            self.pushUndo.bind(self),
                            newnode);
                })
                .then(() => {
                    $(document).trigger("update_save");
                });
        }

        /**
         * Perform a text search for a new search expression
         */
        search(s) {
            let self = this;
            let hits;
            $(".picked-hit")
                .removeClass("picked-hit");
            if (s !== self.last_search) {
                $("#search_hits")
                    .text(TX.tx("Searching..."));

                let re;
                try {
                    re = new RegExp(s, "i");
                } catch (e) {
                    Dialog.open("alert", {
                        alert: {
                            severity: "error",
                            message: TX.tx("Error in search expression") +
                                " '" + s + "': " + e
                        }
                    });
                    return;
                }

                self.last_search = s;

                $(".search-hit")
                    .removeClass("search-hit");

                $(".tree-node")
                    .not(".tree-root")
                    .each(function () {
                        let $node = $(this);
                        if ($node.data("key")
                            .match(re) ||
                            ($node.hasClass("tree-leaf") &&
                             $node.data("value")
                             .match(re)))
                            $node.addClass("search-hit");
                    });

                hits = $(".search-hit");
                if (hits.length === 0) {
                    $("#search_hits")
                        .text(TX.tx("Not found"));
                    return;
                }

                self.picked_hit = 0;
            }

            hits = hits || $(".search-hit");
            if (self.picked_hit < hits.length) {
                $("#search_hits")
                    .text(TX.tx("$1 of $2 found", self.picked_hit + 1, hits.length));
                $(hits[self.picked_hit])
                    .addClass("picked-hit")
                    .parents(".tree-collection")
                    .each(function () {
                        $(this)
                            .tree("open");
                    });
                $(hits[self.picked_hit])
                    .scroll_into_view();
                self.picked_hit = (self.picked_hit + 1) % hits.length;
            }
        }

        /**
         * Insert data from a structure under the given path. public because
         * it is used by dialogs/json.js
         * @param path path to the parent below which this data will be inserted
         * @param data hoard cache format data
         * @param progress dialog to add messages to
         */
        insert_data(path, data, progress) {
            let self = this;

            self.client.hoard.actions_from_hierarchy(
                {
                    data: data
                },
                function (act, conflict, progress) {
                    // this:Hoard, e:Action, next:function
                    //if (self.debug) self.debug(Hoard.stringify_action(act));
                    act.path = path.slice()
                        .concat(act.path);
                    act = self.push_action(act);
                    self.play_action(act)
                        .then((res) => {
                            if (res.conflict) {
                                if (progress) progress.add({
                                    severity: "notice",
                                    message: res.conflict
                                });
                            } else
                                // this:Hoard, e:Action
                                self.$DOMtree.tree("action", res.event, null);
                        });
                })
                .then(() => {
                    $(document).trigger("update_save");
                    progress.add({
                        severity: "notice",
                        message: TX.tx("JSON has been loaded")
                    });
                });
        }

        // Interface to action playing for interactive functions
        playAction(action) {
            let self = this;
            action = self.client.hoard.push_action(action);
            return self.client.hoard.play_action(action)
                .then((e) => {
                    // this:Hoard, e:Action
                    self.$DOMtree.tree(
                        "action",
                        e.event,
                        Squirrel.prototype.pushUndo.bind(self),
                        function () {
                            $(document).trigger("update_save");
                        });
            })
            .catch((e) => {
                
                return Dialog.confirm("alert", {
                    title: TX.tx("Error"),
                    alert: {
                        severity: "error",
                        message: e.message
                    }
                });
            });
        }

        /**
         * Push an undo
         */
        pushUndo() {
            this.undos.push(Hoard.new_action.apply(null, arguments));
        }

        /**
         * Return true if there is at least one undoable operation
         */
        can_undo() {
            let self = this;
            return self.undos.length !== 0;
        }

        /**
         * Undo the most recent action
         */
        undo() {
            let self = this;
            if (self.undos.length === 0)
                return;

            let a = self.undos.pop();
            a.time = Date.now();
            if (self.debug) self.debug("Undo " + Hoard.stringify_action(a));
            // Discard the most recent action in the action stream
            self.client.hoard.pop_action();
            // Replay the reverse of the action
            let res = self.client.hoard.play_action(
                a,
                function (e) {
                    // this:Hoard, e:Action
                    self.$DOMtree.tree(
                        "action",
                        e,
                        null,
                        function () {
                            // If there are no undos, there can be no modifications.
                            // The hoard status will not be changed, though, so a
                            // save may still be required.
                            if (self.undos.length === 0 &&
                                self.client.status === IS_LOADED)
                                $(".tree-modified")
                                .removeClass("tree-modified");
                            $(document).trigger("update_save");
                        });
                });
            if (res !== null)
                Dialog.open("alert", {
                    title: TX.tx("Error"),
                    alert: {
                        severity: "error",
                        message: res.message
                    }
                });
        }
    }

    return Squirrel;
});
