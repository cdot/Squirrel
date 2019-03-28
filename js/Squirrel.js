/*@preserve Copyright (C) 2015-2019 Crawford Currie http://c-dot.co.uk license MIT*/
/* eslint-env browser,jquery */

define("js/Squirrel", ['js/Serror', 'js/Utils', "js/Dialog", "js/Hoard", "js/LocalStorageStore", "js/EncryptedStore", "js/Translator", "js/Tree", "js-cookie", "js/ContextMenu", "js/jq/simulated_password", "js/jq/scroll_into_view", "js/jq/icon_button", "js/jq/styling", "js/jq/template", "js/jq/twisted", "jquery", "jquery-ui", "mobile-events" ], function(Serror, Utils, Dialog, Hoard, LocalStorageStore, EncryptedStore, Translator, Tree, Cookies, ContextMenu) {
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
    // TX.tx("is empty")
    const IS_EMPTY = "is empty";

    const CLIENT_PATH = "client";

    // Dialogs for loading in the background. These are loaded in roughly
    // the order they are likely to be used, but the loads are supposed to
    // be asynchronous so the order shouldn't really matter.
    const DIALOGS = [ "alert", "login", "alarm", "insert", "pick", "add",
                      "delete", "randomise", "extras", "about", "chpw",
                      "store_settings", "optimise", "json" ];
    
    class Squirrel {

        /**
         * OPTIONS:
         * debug - boolean
         * store - string name of the cloud store type
         * url - store URL, if it requires one
         * plaintext - boolean, enable plaintext store
         * steg - boolean, enable steganography
         */
        constructor(options) {
            let self = this;

            self.options = options || {};

            if (self.options.debug) {
                self.debug = console.debug;
                self.debug("Debug enabled");
                // Option to dump the JSON for the cloud database on load.
                // Requires debug.
                self.dumpCloud = options.dump_cloud;
            }

            if (!self.options.store) {
                if (self.debug) self.debug("Defaulting to LocalStorageStore");
                self.options.store = "LocalStorageStore";
            }

            self.$DOMtree = null;

            // undo stack
            self.undos = [];

            // Pointer to tree widget at root of DOM tree
            //self.DOMtree;

            // pathname of the cloud store
            self.cloud_path = null;

            // status may be one of IS_EMPTY, IS_LOADED or
            // NEW_SETTINGS. If the status is anything but IS_LOADED
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

            self.client_ok = true;
            self.cloud_ok = true;

            self.last_search = "";
            self.picked_hit = 0;
        }

        /**
         * Service for dialogs to set hiding
         */
        hideValues(on) {
            if (typeof on !== undefined)
                Tree.hidingValues = on;
            return Tree.hidingValues;
        }

        /**
         * Service for dialogs to set a new encryption password
         */
        encryptionPass(p) {
            this.client.store.option("pass", p);
            this.client.status = NEW_SETTINGS;
            this.cloud.store.option("pass", p);
            this.cloud.status = NEW_SETTINGS;
            this.trigger("update_save");
        }

        /**
         * @private
         * Event handler code for "check_alarms" event
         */
        _handle_alarms( /* event */ ) {
            let self = this;
            let lerts = [];

            self.client.hoard.check_alarms(
                function (path, expired) {
                    let $node = self.$DOMtree.tree("getNodeFromPath", path);
                    $node.tree("ringAlarm");
                    lerts.push(
                        {
                            severity: "warning",
                            message:
                            "<div class='ui-icon squirrel-icon tree-icon-rang'></div>" +
                            TX.tx("Reminder on '$1' was due on $2",
                                  path.join("↘"),
                                  expired.toLocaleDateString())
                        });
                })
            .then(() => {
                if (lerts.length > 0) {
                    return Dialog.confirm("alert", {
                        title: TX.tx("Reminders"),
                        alert: lerts
                    });
                }
            });
        }

        /**
         * @private
         * Determine if there are unsaved changes, and generate a warning
         * message for the caller to use.
         */
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

        /**
         * @private
         */
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

        /**
         * @private
         */
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

            // Make a serialisable data block
            let data = {
                cloud_path: self.cloud_path
            };
            for (let f in self.client) {
                // We don't want to serialize the store
                if (self.client.hasOwnProperty(f) && f !== "store")
                    data[f] = self.client[f];
            }

            let p = self.client.store.writes(CLIENT_PATH, JSON.stringify(data))
                .then(() => {
                    if (self.debug) self.debug("...client save OK");
                    $(".tree-modified")
                        .removeClass("tree-modified");
                    self.client.status = IS_LOADED;
                    if (progress) progress.add({
                        severity: "notice",
                        message: TX.tx("Saved in browser")
                    });
                })
                .catch((e) => {
                    if (self.debug) self.debug("...client save failed " + e.stack);
                    if (progress) progress.add({
                        severity: "error",
                        message: TX.tx("Failed to save in $1: $2",
                                       self.client.store.option("type"), e)
                    });
                    self.client_ok = false;
                });
            return p.then(() => {
                return self._finished_save(progress);
            });
        }

        /**
         * @private
         */
        _save_cloud(progress) {
            // Cloud doesn't need the hoard tree. Could kill it, but it's
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
                    message: TX.tx("Saved in cloud")
                });
                self.cloud.status = IS_LOADED;
            })
            .catch((e) => {
                if (self.debug) self.debug("...cloud save failed " + e.stack);
                if (progress) progress.add({
                    severity: "error",
                    message: TX.tx("Failed to save in $1: $2",
                                   self.cloud.store.option("type"), e)
                });
                self.cloud_ok = false;
            });
        }

        /**
         * @private
         */
        _update_stores(progress) {
            let self = this;

            // merge client actions into the cloud hoard
            self.cloud.hoard.merge_actions(self.client.hoard.actions);

            if (!self.cloud.store) {
                if (self.debug) self.debug("...no cloud store");
                return Promise.resolve();
            }

            if (self.debug) self.debug("...save to cloud");

            self.cloud.status = self.PENDING_SAVE;
            return self._save_cloud(progress)
            .then(() => {
                return self._save_client(progress);
            });
        }

        /**
         * Public because it is used by the optimise dialog.
         * Promise to construct a new cloud hoard from data in the
         * client.
         */
        construct_new_cloud(progress) {
            let self = this;
            if (self.debug) self.debug("...construct cloud ");
            self.cloud.hoard = new Hoard();
            // Copy the actions required to recreate the client hoard tree
            return self.client.hoard
            .actions_from_tree(self.client.hoard.tree, (a) => {
                // this:Hoard, a:Action, next:function
                self.cloud.hoard.push_action(a, true);
                return Promise.resolve();
            })
            .then(() => {
                return self._update_stores(progress);
            });
        }

        /**
         * @private
         * Promise to handle the cloud store being reloaded prior to a
         * save action.  The actions read from the cloud have to be
         * merged into the client before the save is completed. SMELL:
         * There's a risk of a race condition here if the cloud is
         * updated while we are still updating the client. Some sort
         * of locking could be done, but strikes me as overkill.
         * @param data the data tree for the hoard
         * @param {Dialog} progress dialog
         */
        _cloud_store_reloaded_ok(data, progress) {
            let self = this;
            if (self.debug) self.debug("...cloud read OK ");
            let p;
            try {
                self.cloud.hoard = new Hoard({data: data});
                self.cloud.status = IS_LOADED;
                p = Promise.resolve();
            } catch (e) {
                // We'll get here if the JSON parse failed, but NOT if
                // decryption failed.
                if (self.debug) self.debug("Cloud hoard JSON parse failed: " + e.stack);
                if (progress) progress.add([
                    {
                        severity: "warning",
                        message: TX.tx("Cloud hoard can't be read for update")
                    },
                    TX.tx("Click OK to continue with the save and overwrite the cloud store")]);
                p = progress.wait().then(() => {
                    self.cloud.status = IS_EMPTY;
                    self.cloud_ok = false;
                    return self.construct_new_cloud(progress);
                });
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
                            self.$DOMtree.tree("action", e);
                        });
                }
            })
            .then(() => {
                // Only save if there are actually some changes
                if (self.cloud.status !== IS_LOADED ||
                    self.client.hoard.actions.length !== 0) {
                    if (self.debug) self.debug("...update from cloud: " + self.cloud.status);
                    return self._update_stores(progress);
                }
                return Promise.resolve();
            });
        }

        /**
         * @private
         */
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
                if (self.debug) self.debug("...constructing new cloud");
                return self.construct_new_cloud(progress);
            } else {
                // Reload and save the cloud hoard
                if (self.debug) self.debug("...reloading cloud");
                return self.cloud.store
                .reads(self.cloud_path)
                .then((str) => {
                    let data = JSON.parse(str);
                    return self._cloud_store_reloaded_ok(data, progress);
                })
                .catch((e) => {
                    if (self.debug) self.debug("...cloud refresh failed " + e.stack);
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

        /**
         * @private
         * Event handler for "update_save" event
         */
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
         */
        get_store_settings() {
            let self = this;

            let needs_image =
                this.cloud.store &&
                this.cloud.store.option("needs_image");

            return Dialog.confirm("store_settings", {
                needs_image: needs_image,
                path: this.cloud_path
            })
            .then((dlg) => {
                let path = dlg.control("path").val();
                if (path !== self.cloud_path) {
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
            });
        }

        /**
         * @private
         * Optional initialisation step, executed when both hoards are
         * known to have loaded successfully.
         */
        _merge_from_cloud() {
            let self = this;
            if (self.debug) self.debug('_merge_from_cloud');
            return self.client.hoard.play_actions(
                self.cloud.hoard.actions,
                function (e) {
                    // e { event: Action [, conflict: String] }
                    if (e.conflict) {
                        Dialog.open("alert", {
                            alert: {
                                severity: "warning",
                                message: Hoard.stringify_action(e.event) +
                                ": " + e.conflict
                            }
                        });
                    } else
                        self.$DOMtree.tree("action", e.event);
                })
            .then((conflicts) => {
                if (!conflicts || conflicts.length === 0)
                    return;
                let lerts = [
                    TX.tx("Conflicts were detected while merging actions from the Cloud."),
                    TX.tx("Please review these rejected actions, and make sure the data displayed is correct before saving.")
                ];
                $.each(conflicts, function (i, c) {
                    lerts.push({
                        severity: "warning",
                        message: c
                    });
                });
                return Dialog.confirm("alert", {
                    title: TX.tx("Conflicts Detected"),
                    alert: lerts
                })
            })
            .then(() => {
                self.cloud.status = IS_LOADED;
            });
        }

        /**
         * @private
         * Called when we have a (possibly empty) client hoard.
         * Try and synch it from the cloud.
         * Resolve to true if the cloud hoard is ready to be merged from,
         * false otherwise.
         */
        _load_cloud() {
            let self = this;
            let cloud_store = self.cloud.store;

            if (!cloud_store)
                return Promise.resolve(false);

            if (self.debug) self.debug('_load_cloud');

            $("#stage").text(TX.tx("Reading from cloud"));

            let p;

            // Make sure we have a store path. The client
            // store records the path, which is used to load
            // the cloud store/
            if (self.cloud_path)
                p = Promise.resolve();
            else
                // Use the settings dlg to initialise the cloud store path
                p = self.get_store_settings();

            return p.then(() => {
                return cloud_store.reads(self.cloud_path);
            })
            .then((data) => {
                if (data.length === 0) {
                    if (self.debug) self.debug(
                        cloud_store.option("type") + " is empty");
                    self.cloud.status = IS_EMPTY;
                    return Promise.resolve();
                }

                if (self.debug) self.debug(
                    cloud_store.option("type") + " is ready to be read");

                self.cloud.hoard = new Hoard({data: data});

                // Ready to merge from cloud hoard
                return self._merge_from_cloud();
            })
            .catch((e) => {
                let mess = [];
                mess.push({
                    severity: "error",
                    message: TX.tx("Could not load cloud store '$1'",
                                   self.cloud_path)
                });
                if (e instanceof Serror && e.status === 404) {
                    // Could not contact cloud; continue all the same
                    if (self.debug) self.debug(
                        self.cloud_path + " not found in the cloud");
                    if (e.status)
                        mess.push({ severity: "warning", http: e.status });
                    if (e.message)
                        mess.push(e.message);
                    mess.push(TX.tx("Continuing and saving will create a new cloud store."));
                } else {
                    // Some other error
                    if (self.debug) self.debug(e.stack);
                    self.cloud.status = IS_EMPTY;
                    mess.push({
                        severity: "error",
                        message: TX.tx(
                            "Cloud store can't be read."),
                    });
                    mess.push(TX.tx("Check that you have the correct password."));
                    mess.push(TX.tx("If you continue and save, the cloud store will be overwritten and you may lose data."));
                }
                return Dialog.confirm("alert", {
                    title: TX.tx("Cloud store read failed"),
                    alert: mess
                })
                .then(() => {
                    return Promise.resolve(false);
                });
            });
        }

        /**
         * @private
         * Once the stores have been initialised, we can load the
         * client. This will give us the client hoard and the location
         * of the cloud hoard, so we can then laod and merge the cloud
         * hoard.
         */
        _load_client() {
            let self = this;

            self.client.status = IS_LOADING;
            if (self.debug) self.debug('_load_client');

            $("#stage").text(TX.tx("Reading from client"));
            return self.client.store.reads(CLIENT_PATH)
            .then((str) => {
                let data = JSON.parse(str);
                self.cloud_path = data.cloud_path;
                self.client.hoard = new Hoard({data: data.hoard });
                self.client.status = IS_LOADED;

                if (self.debug) self.debug("...reconstructing client actions");
                $("#stage").text(TX.tx("Building UI"));
                return self.client.hoard.actions_from_tree(
                    self.client.hoard.tree, (a) => {
                        // this:Hoard, a:Action, next:function
                        return new Promise((resolve) => {
                            self.$DOMtree.tree("action", a, null, resolve);
                        });
                    })
            })
            .then(() => {
                // Reset the UI modification list; we just loaded the
                // client hoard
                $(".tree-modified").removeClass("tree-modified");
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
                if (e instanceof Serror) {
                    self.client.hoard = new Hoard();
                    let mess = [];
                    mess.push({
                        severity: "warning",
                        message: TX.tx("Could not load client store.")
                    });
                    if (e.status)
                        mess.push({ severity: "warning", http: e.status });
                    if (e.message)
                        mess.push(e.message);
                    mess.push(TX.tx("Continuing and saving will create a new client store."));
                    return Dialog.confirm("alert", {
                        title: TX.tx("Warning"),
                        alert: mess });
                }
                if (this.debug && e.stack) this.debug(e.stack);
                return Dialog.confirm("alert", {
                    title: TX.tx("Client store read failed"),
                    alert: [
                        {
                            severity: "error",
                            message: TX.tx("Client store exists, but can't be read.")
                        },
                        TX.tx("Check that you have the correct password."),
                        TX.tx("If you continue and save, the client store will be overwritten and you may lose data.")
                    ]});
            });
        }

        /**
         * @private
         * 401 network login handler. Normally a 401 will be handled by
         * the browser. This is a "just in case".
         */
        _network_login(domain) {
            let self = this;

            if (self.debug) self.debug(domain, "network login");

            return Dialog.confirm("login", {
                title: TX.tx("Network login for $1", TX.tx(domain)),
                // Copy default user from the stores if there
                user: self.cloud.store.option("user")
                || self.client.store.option("user")
            }).then((dlg) => {
                let user = dlg.control("user").val();
                let pass = dlg.control("pass").val();
                if (self.debug)
                    self.debug("Login prompt said user was " + user);
                self[domain].store.option("net_user", user);
                self[domain].store.option("net_pass", pass);
            });
        }

        /**
         * @private
         * Initialise the client store. This sets up the store
         * but doesn't read anything yet. Initialisation of the client
         * store *may* provide user information, but it will be
         * overridden by any user information coming from the cloud
         * store.
         */
        _init_client() {
            let self = this;
            if (self.debug) self.debug('_init_client');

            self.client.store = new LocalStorageStore({
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

            // Initialisation of the cloud store may have provided
            // initial user information, either from a network login
            // or from a service login. Seed the login dialog with one
            // of them.
            return self.client.store.init({
                network_login: () => {
                    // TX.tx("client")
                    return self._network_login("client");
                }
            })
            .then(() => {
                if (self.debug) self.debug("client store initialised");

                if (self.client.store.option("needs_pass") ||
                    !self.client.store.option("user")) {

                    let poss_user;
                    if (self.cloud.store) {
                        poss_user = self.cloud.store.option("user")
                        || self.cloud.store.option("net_user");
                    }
                    if (!poss_user)
                        poss_user = self.client.store.option("user");

                    if (self.debug) self.debug("store user may be", poss_user);

                    // Need to confirm user/pass, which may have been
                    // seeded from the store initialisation process
                    $("#stage").text(TX.tx("Authentication"));
                    return Dialog.confirm("login", {
                        title: "User details",
                        user: poss_user
                    })
                    .then((dlg) => {
                        if (self.debug) self.debug("Login confirmed");

                        let user = dlg.control("user").val();
                        let pass = dlg.control("pass").val();

                        // Propagate to the stores
                        self.client.store.option("user", user);
                        self.client.store.option("pass", pass);

                        if (self.cloud.store) {
                            self.cloud.store.option("user", user);
                            self.cloud.store.option("pass", pass);
                        }
                    });
                }
                return Promise.resolve();
            })
            .then(() => {
                if (self.debug) self.debug("Client store is ready");
            });
        }

        /**
         * @private
         * Initialise the cloud store. Initialisation of the cloud
         * store *may* provide user information - for example,
         * initialisation of a GoogleDriveStore will require a google
         * login to a specific user. We leverage this to get initial
         * user information which can be used in determining the
         * encryption user for the client store.
         */
        _init_cloud() {
            let self = this;
            if (self.debug) self.debug('_init_cloud');
            let store;

            let p = new Promise(function(res,rej) {
                requirejs(
                    ["js/" + self.options.store],
                    function(module) {
                        store = new module({
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

            if (typeof self.options.steg !== "undefined") {
                if (self.debug) self.debug('adding steganography to cloud');
                p = p.then(() => {
                    return new Promise((resolve) => {
                        requirejs(["js/StegaStore"], function(StegaStore) {
                            store = new StegaStore({
                                debug: self.debug,
                                understore: store
                            });
                            resolve();
                        });
                    });
                });
            }

            return p.then(() => {
                //console.log("cloud store type is", store);
                if (store.option("needs_url")) {
                    if (self.options.url) {
                        store.option("url", self.options.url);
                    } else {
                        return Dialog.confirm("alert", {
                            alert: {
                                severity: "error",
                                message: TX.tx("A URL is required for $1",
                                               store.option("type"))
                            }
                        }).then(() => {
                            throw new Error("No URL given for store");
                        });
                    }
                }
                return store.init({
                    network_login: () => {
                        // TX.tx("cloud")
                        return self._network_login("cloud");
                    }
                })
            })
            .then(() => {
                self.cloud.store = store;
                let cluser = self.cloud.store.option("user");
                if (cluser) {
                    if (self.debug) self.debug(
                        "cloud init has identified user", cluser);        
                } else {
                    if (self.debug)
                        self.debug("cloud store initialised, no user known");
                }
            })
            .catch((e) => {
                return Dialog.confirm("alert", {
                    title: TX.tx("Warning"),
                    alert: {
                        severity: "warning",
                        message: TX.tx("Could not open cloud store: $1", e)
                            + "<br>"
                            + TX.tx("If you continue, only the client store will be available"),
                    }
                });
            });
        }

        /**
         * Event handler for "init_application" event
         * Promise to initialise application (new Squirrel(), effectively)
         */
        _handle_init_application() {
            let self = this;
            // Kick off by initialising the cloud store.

            return self._init_cloud()
            .then(() => {
                return self._init_client();
            })
            .then(() =>{
                return self._load_client();
            })
            .then(() =>{
                return self._load_cloud();
            })
            .then(() => {
                if (self.debug) self.debug('interacting');

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

                $("#whoami").text(self.client.store.option("user"));
                $("#unauthenticated").hide();
                $("#authenticated").show();

                // Open the root node
                $("#sites-node").tree("open");
            });
        }

        /**
         * Main entry point for the application, invoked from main.js
         */
        begin() {
            let self = this;

            $("#stage").text(TX.tx("Loading application"));

            $.styling.init(self.options);

            // Special keys in sort ordering. Currently only works for
            // English.
            // TODO: translation
            let sort_prio = ["User", "Pass", "Email"];

            Tree.compareKeys = (a, b) => {
                if (a === b)
                    return 0;
                for (let i in sort_prio) {
                    if (a === sort_prio[i])
                        return -1;
                    if (b === sort_prio[i])
                        return 1;
                }
                return (a < b) ? -1 : 1;
            };

            Tree.playAction = (action) => {
                return self.playAction(action);
            };
            Tree.onOpenEditor = () => {
                self.contextMenu.toggle(false);
            };
            Tree.onCloseEditor = () => {
                self.contextMenu.toggle(true);
            };
            Tree.onHoverIn = () => {
                $("body").contextmenu("close"); return false;
            };
            Tree.onHoverOut = () => {
                return $("body").contextmenu("isOpen");
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
                .on(Dialog.tapEvent(), function() {
                    let url = requirejs.toUrl("help.html");
                    $(this).closest("a").attr("href", url);
                    return true;
                });

            $("#save_button")
                .icon_button()
                .hide()
                .on(Dialog.tapEvent(), ( /*evt*/ ) => {
                    Dialog.open("alert", {
                        title: "Saving",
                        alert: ""
                    }).then((progress) => {
                        self._save_hoards(progress)
                        .then(() => {
                            return self._save_client(progress);
                        });
                    });
                    return false;
                });

            $("#undo_button")
                .icon_button()
                .hide()
                .on(Dialog.tapEvent(), function ( /*evt*/ ) {
                    self.undo(function (mess) {
                        Dialog.confirm("alert", {
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
                .on(Dialog.tapEvent(), function ( /*evt*/ ) {
                    Dialog.confirm("extras");
                });

            $("#search_input")
                .on("change", function ( /*evt*/ ) {
                    self.search($(this)
                                .val());
                });

            $("#search_button")
                .icon_button()
                .on(Dialog.tapEvent(), function ( /*evt*/ ) {
                    self.search($("#search_input")
                                .val());
                });

            self.contextMenu = new ContextMenu(self);

            for (let i in DIALOGS) {
                // Don't wait, let these load in the background
                Dialog.load(DIALOGS[i]);
            }

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

            $(document).trigger("init_application");
       }

        /**
         * Promise to perform a (manual) new tree node action
         */
        add_child_node($node, title, value) {
            let self = this;
            let path = $node.tree("getPath").concat(title);
            let e = self.client.hoard.push_action(
                Hoard.new_action(
                    "N", path, Date.now(),
                    (typeof value === "string") ? value : undefined));

            function newnode($newnode) {
                if (!$newnode)
                    throw new Error("ERROR: node creation failed");

                if (typeof value !== "string" && typeof value !== "undefined")
                    self.insert_data($newnode.tree("getPath"), value);
                $newnode.tree("open", {
                    decorate: true
                });
            }

            return self.client.hoard.play_action(e)
            .then((res) => {
                if (res.conflict)
                    return Dialog.confirm("alert", {
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
                    Dialog.confirm("alert", {
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
         * Promise to insert data from a structure under the given
         * path. Public because it is used by dialogs/json.js
         * @param path path to the parent below which this data will be inserted
         * @param data hoard tree format data
         * @param progress dialog to add messages to
         */
        insert_data(path, data, progress) {
            let self = this;

            return self.client.hoard.actions_from_tree(
                {
                    data: data
                },
                function (act) {
                    // this:Hoard, e:Action, next:function
                    //if (self.debug) self.debug(Hoard.stringify_action(act));
                    act.path = path.slice().concat(act.path);
                    act = self.push_action(act);
                    return self.play_action(act)
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

        /**
         * Interface to action playing for interactive functions.
         * This will play a single action into the client hoard, and
         * update the UI to reflect that action.
         * @param action the action to play, in Hoard action format
         */
        playAction(action) {
            let self = this;
            action = self.client.hoard.push_action(action);
            return self.client.hoard.play_action(action)
            .then((e) => {
                if (self.debug && e.conflict) debugger;
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
            return self.client.hoard.play_action(a)
            .then((e) => {
                if (self.debug && e.conflict) debugger;
                self.$DOMtree.tree(
                    "action",
                    e.event,
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
            })
            .catch((e) => {
                Dialog.confirm("alert", {
                    title: TX.tx("Error"),
                    alert: {
                        severity: "error",
                        message: e.message
                    }
                });
            });
        }
    }

    return Squirrel;
});
