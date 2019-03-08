/*@preserve Copyright (C) 2015-2019 Crawford Currie http://c-dot.co.uk license MIT*/
/* eslint-env browser,jquery */

define(['js/Serror', 'js/Utils', "js/Hoard", "js/LocalStorageStore", "js/EncryptedStore", "js/Translator", "js/Tree", "clipboard", "jsjq/simulated_password", "jsjq/scroll_into_view", "jsjq/icon_button", "jsjq/reset_styling", "jsjq/squirrel_dialog", "jsjq/template", "jsjq/twisted", "jquery", "jquery-ui", "mobile-events" ], function(Serror, Utils, Hoard, LocalStorageStore, EncryptedStore, Translator, Tree, ClipboardJS) {
    TX = Translator.instance();

    /*
     * The application startup process proceeds from "init_application" though
     * a sequence of chained functions called 'step_*'. These functions are
     * mostly run asynchronously. Once the final step is reached, control is
     * handed off to the Tree module, which governs most interaction.
     * reached
     */

    // Exports
    const STATII = {
        // Store statii
        // TX.tx("has new settings")
        NEW_SETTINGS: "has new settings",
        // TX.tx("is loading")
        IS_LOADING: "is loading",
        // TX.tx("is loaded")
        IS_LOADED: "is loaded",
        // TX.tx("is corrupt")
        IS_CORRUPT: "is corrupt",
        // TX.tx("is empty")
        IS_EMPTY: "is empty"
    };

    class Squirrel {

        // Internal clipboard
        constructor(options) {
            let self = this;

            options = options || {};

            if (options.debug) {
                self.debug = console.debug;
                self.debug("Debug enabled");
                // Option to dump the JSON for the cloud database on load.
                // Requires debug.
                self.dumpCloud = options.dump_cloud;
            }

            if (!options.cookies)
                throw new Error("option 'cookies' is required");

            self.cookies = options.cookies;

            options.theme = options.theme || self.cookies.get("ui_theme");

            if (options.theme && options.theme !== "base")
                self.theme(options.theme);

            options.scale = options.scale || self.cookies.get("ui_scale");
            if (options.scale && options.scale > 0)
                self.scale(options.scale);

            // Steganography is off by default
            self.useSteganography = options.steg;

            // Encryption is on by default
            self.useEncryption = (typeof options.plain !== "undefined" ?
                                  (options.plain !== "off") : true);

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

            // status may be one of IS_EMPTY, IS_CORRUPT, IS_LOADED or
            // NEW_SETTINGself. If the status is anything but IS_LOADED
            // then it is a candidate for saving.
            self.client = {
                store: null, // The store used actively
                hoard: null, // The hoard in that store
                status: STATII.IS_EMPTY
            };

            self.cloud = {
                store: null, // Temporary memory used during load
                hoard: null, // The hoard in that store
                status: STATII.IS_EMPTY
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

            self.cloudStorageProvider = options.store;

            self.last_search = "";
            self.picked_hit = 0;
        }

        /**
         * Notification dialog
         * @param p map with following fields:
         *  severity: one of "notice", "warning", "error"
         *   message: the translated message text
         *   transitory: if true, will delete the message on the next alert
         * If p is undefined the dialog will be closed
         */
        alert(p) {
            let $dlg = $("#alerts");

            if (!$dlg.hasClass("dlg-initialised")) {
                $dlg.find(".close").on("click", function () {
                    $dlg.dialog("close");
                });
                $dlg.addClass("dlg-initialised");
            }

            if (typeof p === "undefined") {
                if ($dlg.dialog("isOpen"))
                    $dlg.dialog("close");
                return;
            } else if (!$dlg.dialog("isOpen")) {
                $dlg.find(".messages").empty();
                $dlg.dialog("option", "title", p.title || TX.tx("Alert"));
                $dlg.dialog("open");
            }

            // Transitory messages only stay until closed or the next alert
            // is posted
            $dlg.find(".transitory")
                .remove();

            let $mess = $(document.createElement("div"))
                .addClass('dlg-' + p.severity);

            if (p.transitory)
                $mess.addClass("transitory");

            $mess.append(p.message);

            $dlg.find(".messages")
                .append($mess);
        }

        // Change jQuery UI theme
        theme(theme) {
            let self = this;

            if (typeof theme !== "undefined") {
                $("#jQueryTheme")
                    .each(function () {
                        this.href = this.href.replace(
                                /\/themes\/[^/]+/, "/themes/" + theme);
                        $(this)
                            .replaceWith($(this));
                    });
                $.reset_styling();
                if (theme === "base") {
                    self.cookies.remove("ui_theme");
                } else {
                    self.cookies.set("ui_theme", theme, {
                        expires: 365
                    });
                }
            }
            return self.cookies.get("ui_theme");
        }

        scale(scale) {
            let self = this;

            if (typeof scale !== "undefined") {
                if (scale > 6) { // don't go below 6px
                    $("body")
                        .css("font-size", scale + "px");
                    self.cookies.set("ui_scale", scale, {
                        expires: 365
                    });
                }
            }
            return self.cookies.get("ui_scale");
        }

        zoom(factor) {
            let self = this;
            let now = $("body")
                .css("font-size");
            now = now.replace(/px/, "");
            self.scale(Math.round(factor * parseInt(now)));
        }

        autosave(on) {
            let self = this;
            if (typeof on !== undefined) {
                let ons = (on ? "on" : "off");
                if (self.cookies.get("ui_autosave") !== ons) {
                    self.cookies.set("ui_autosave", ons, {
                        expires: 365
                    });
                    self.trigger("update_save");
                }
            }
            return self.cookies.get("ui_autosave");
        }

        // Event handler code for "check_alarms" event
        _check_alarms( /* event */ ) {
            let self = this;
            self.client.hoard.check_alarms(
                function (path, expired, next) {
                    let $node = self.$DOMtree.tree("getNodeFromPath", path);
                    $node.tree("ringAlarm");
                    self.alert({
                        severity: "warning",
                        message: "<div class='ui-icon squirrel-icon-rang'></div>" +
                            TX.tx("Reminder on '$1' was due on $2",
                                  path.join("↘"),
                                  expired.toLocaleDateString()),
                        after_close: next
                    })
                        .on("dialogclose", function (e) {
                            $(e.target).off("dialogclose");
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

            if (self.cloud.status !== STATII.IS_LOADED) {
                message.unshift(TX.tx("The $1 hoard $2",
                                      self.cloud.store ?
                                      self.cloud.store.option("type") :
                                      TX.tx("Cloud"),
                                      TX.tx(self.cloud.status)));
            }
            if (self.client.status !== STATII.IS_LOADED) {
                message.unshift(TX.tx("The $1 hoard $2",
                                      self.client.store.option("type"),
                                      TX.tx(self.client.status)));
            }

            if (message.length === 0)
                return null;

            return message.join("\n");
        }

        _finished_save() {
            let self = this;
            if (self.debug) self.debug("...save finished");
            self.trigger("update_save");
            if (self.client_ok && self.cloud_ok) {
                if (self.cookies.get("ui_autosave") === "on")
                    self.alert();
                else
                    // Otherwise leave alert open
                    self.alert({
                        severity: "notice",
                        message: TX.tx("Save complete")
                    });

            } else {
                // Otherwise leave it open, disable auto-save
                self.alert({
                    severity: "error",
                    message: TX.tx("Save encountered errors")
                });
                self.cookies.set("ui_autosave", "off", {
                    expires: 365
                });
            }
        }

        _write_client_store() {
            let self = this;
            let p = self.client.store.writes(
                "S." + self.client.store.option("user"),
                JSON.stringify(self.client.hoard))
                .then(() => {
                    if (self.debug) self.debug("...client save OK");
                    $(".tree-modified")
                        .removeClass("tree-modified");
                    self.client.status = STATII.IS_LOADED;
                    self.alert({
                        severity: "notice",
                        message: TX.tx("Saved in $1", self.client.store.option("type"))
                    });
                })
                .catch((e) => {
                    if (self.debug) self.debug("...client save failed " + e);
                    self.alert({
                        severity: "error",
                        message: TX.tx("Failed to save in $1: $2",
                                       self.client.store.option("type"), e)
                    });
                    self.client_ok = false;
                });
            return p.then(() => { return self._finished_save(); });
        }

        save_client() {
            let self = this;
            if (self.debug) self.debug("...save to client");

            if (self.client.status === STATII.IS_LOADED &&
                $(".tree-modified")
                .length === 0) {
                self._finished_save();
                return Promise.resolve();
            }

            self.client.status = self.PENDING_SAVE;

            self.alert({
                severity: "notice",
                transitory: true,
                message: TX.tx("Saving in $1",
                               self.client.store.option("type"))
            });

            return self._write_client_store();
        }

        _write_cloud_store() {
            // Cloud doesn't need the cache. Could kill it, but it's
            // small and there's not much advantage to doing so.
            let self = this;

            return self.cloud.store.writes(
                self.client.hoard.options.store_path,
                JSON.stringify(self.cloud.hoard))
                .then(() => {
                    if (self.debug) self.debug("...cloud save OK");
                    self.client.hoard.actions = [];
                    self.client.hoard.last_sync = Date.now();
                    // Can  no longer undo
                    self.undos = [];
                    self.alert({
                        severity: "notice",
                        message: TX.tx("Saved in $1", self.cloud.store.option("type"))
                    });
                    self.cloud.status = STATII.IS_LOADED;
                })
                .catch((e) => {
                    if (self.debug) self.debug("...cloud save failed " + e);
                    self.alert({
                        severity: "error",
                        message: TX.tx("Failed to save in $1: $2",
                                       self.cloud.store.option("type"), e)
                    });
                    self.cloud_ok = false;
                });
        }

        // Save into the cloud.
        update_cloud_store() {
            let self = this;

            self.cloud.hoard.merge_actions(self.client.hoard.actions);

            if (!self.cloud.store) {
                if (self.debug) self.debug("...no cloud store");
                return Promise.resolve();
            }

            if (self.debug) self.debug("...save to cloud");

            self.alert({
                severity: "notice",
                transitory: true,
                message: TX.tx("Saving in $1",
                               self.cloud.store.option("type"))
            });

            self.cloud.status = self.PENDING_SAVE;

            return self._write_cloud_store()
                .then(() => {
                    return self.save_client();
                });
        }

        // Promise to construct a new cloud hoard from data in the client. This will
        // happen if the cloud is read and found to be empty or corrupt,
        // but not if the read failed.
        construct_new_cloud(progress) {
            let self = this;
            if (self.debug) self.debug("...construct cloud ");
            self.cloud.hoard = new Hoard("new Cloud");
            return self.client.hoard.reconstruct_actions(
                function (a, next) {
                    // this:Hoard, a:Action, next:function
                    self.cloud.hoard.push_action(a);
                    if (next)
                        next();
                },
                progress)
                .then(() => {
                    return self.update_cloud_store();
                });
        }

        // Promise to handle the cloud store being reloaded prior to a save action.
        // The actions read from the cloud have to be merged into the client
        // before the save is completed. SMELL: There's a risk of a race
        // condition here if the cloud is updated while we are still updating
        // the client. Some sort of locking could be done, but strikes me
        // as overkill.
        cloud_store_reloaded_ok(data) {
            let self = this;
            if (self.debug) self.debug("...cloud read OK ");
            let p;
            try {
                self.cloud.hoard = new Hoard("reloaded Cloud", data);
                self.cloud.status = STATII.IS_LOADED;
                p = Promise.resolve();
            } catch (e) {
                // We'll get here if decryption failed....
                if (self.debug) self.debug("Cloud hoard JSON parse failed: " + e);
                self.alert({
                    severity: "error",
                    message: TX.tx("$1 hoard can't be read for update",
                                   self.cloud.store.option("type"))
                });
                self.cloud.status = STATII.IS_CORRUPT;
                self.cloud_ok = false;
                p = self.construct_new_cloud();
            }
            return p.then(() => {
                if (self.cloud.status === STATII.IS_LOADED) {
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
                if (self.cloud.status !== STATII.IS_LOADED ||
                    self.client.hoard.actions.length !== 0) {
                    if (self.debug) self.debug("...update from cloud: " + self.cloud.status);
                    return self.update_cloud_store();
                }
                return Promise.resolve();
            });
        }

        save_hoards() {
            let self = this;
            self.alert({
                title: TX.tx("Saving")
            });

            self.client_ok = true;
            self.cloud_ok = true;

            if (self.debug) self.debug("Saving; client " + self.client.status +
                                       "; cloud " + self.cloud.status);
            if (self.cloud.status === STATII.NEW_SETTINGS ||
                self.cloud.status === STATII.IS_EMPTY) {
                // Don't attempt to resync out before saving, simply
                // overwrite the cloud.
                if (self.debug) self.debug("...constructing new cloud because settings");
                return self.construct_new_cloud();
            } else {
                // Reload and save the cloud hoard
                if (self.debug) self.debug("...reloading cloud");
                return self.cloud.store.reads(self.client.hoard.options.store_path)
                    .then(() => {
                        return self.cloud_store_reloaded_ok();
                    })
                    .catch((e) => {
                        if (self.debug) self.debug("...cloud read failed " + e);
                        self.alert({
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
        _update_save( /*event*/ ) {
            let self = this;
            $("#undo_button")
                .toggle(self.can_undo());
            let us = self._unsaved_changes(3);
            let $sb = $("#save_button");

            if (us !== null) {
                if (self.cookies.get("ui_autosave") === "on") {
                    self.save_hoards().then(() => { return self.save_client() });
                } else {
                    $sb.attr(
                        "title",
                        TX.tx("Save is required because") + ": " + us);
                    $sb.show();
                }
            } else {
                $sb.hide();
            }
        }

        // Final step before allowing interaction
        step_7_interact() {
            let self = this;
            return new Promise((resolve, reject) => {
                if (self.debug) self.debug('step_7_interact');
                $("#whoami")
                    .text(self.client.store.option("user"));
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
            return new Promise((resolve, reject) => {
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
                        self.alert({
                            severity: "warning",
                            message: Hoard.stringify_action(e) +
                                ": " + c.message
                        });
                    } else
                        self.$DOMtree.tree("action",e);
                })
                .then((conflicts) => {
                    if (!conflicts || conflicts.length === 0)
                        return;
                    self.alert({
                        title: TX.tx("Warning"),
                        severity: "warning",
                        message: TX.tx("Conflicts were detected while merging actions from the Cloud.")
                            + " "
                            + TX.tx("Please review these rejected actions, and make sure the data displayed is correct before saving.")
                    });
                    $.each(conflicts, function (i, c) {
                        self.alert({
                            severity: "warning",
                            message: c
                        });
                    });
                })
                .then(() => {
                    self.cloud.status = STATII.IS_LOADED;
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
            let path = self.client.hoard.options.store_path;
            return store.reads(path)
                .then((data) => {
                    if (data.length === 0) {
                        if (self.debug) self.debug(
                            store.option("type") + " is empty");
                        self.cloud.status = STATII.IS_EMPTY;
                        return Promise.resolve();
                    }

                    if (self.debug) self.debug(
                        store.option("type") + " is ready to be read");

                    try {
                        self.cloud.hoard = new Hoard("Cloud", data);
                        if (self.dumpCloud)
                            self.debug(JSON.stringify(self.cloud.hoard));
                    } catch (e) {
                        if (self.debug) self.debug(
                            "Cloud hoard JSON parse failed: " + e + data);
                        self.alert({
                            title: TX.tx("Error"),
                            severity: "error",
                            message: TX.tx("$1 hoard exists, but can't be read.",
                                           store.option("type")) +
                                " " +
                                TX.tx("Check that you have the correct password.")
                        });
                        self.cloud.status = STATII.IS_CORRUPT;
                    }

                    return Promise.resolve(true);
                })
                .catch((e) => {
                    if (e instanceof Serror && e.status === 404) {
                        if (self.debug) self.debug(
                            store.option("type") + " " + path + " not found");
                        self.alert({
                            title: TX.tx("Error"),
                            severity: "error",
                            message: TX.tx("Could not load cloud store")
                        });
                        self.alert({
                            severity: "notice",
                            message: TX.tx("Check that the cloud store exists and you have the correct password.")
                        });
                        // Could not contact cloud; continue all the same
                    }
                    return Promise.resolve(false);
                });
        }

        /**
         * STEP 5: Called when there is no existing client hoard, to initialise
         * a new one.
         */
        step_4_init_client_hoard() {
            let self = this;

            if (self.debug) self.debug('step_4_init_client_hoard');
            self.client.hoard = new Hoard("Client");
            self.client.status = STATII.IS_EMPTY;
            if (self.cloud.store && (
                self.cloud.store.option("needs_path")
                    || self.cloud.store.option("needs_image"))) {
                return new Promise((resolve, reject) => {
                    $.load_dialog("store_settings").then(($dlg) => {
                        $dlg.squirrel_dialog("option", "close", resolve);
                        $dlg.squirrel_dialog(
                        "open",
                        {
                            get_image: self.cloud.store.option("needs_image"),
                            get_path: self.cloud.store.option("needs_path"),
                        });
                    });
                });
            }
            return Promise.resolve();
        }

        /**
         * STEP 4: Once the stores have been initialised, we can load
         * the client hoard. This will give us the baseline cache data and the
         * location of the cloud hoard, so we can then chain loading and merging
         * the cloud hoard.
         */
        step_3_load_client_hoard() {
            let self = this;

            if (self.client.status === STATII.IS_LOADING) {
                // If the login dialog sends two "on_signin" events we may get
                // two calls to this function. They should be filtered in the
                // dialogs code but if not....
                throw new Error('ERROR: Extra step_3_load_client_hoard');
            }

            self.client.status = STATII.IS_LOADING;
            if (self.debug) self.debug('step_3_load_client_hoard');

            function rebuild_hoard() {
                $("#stage")
                    .text(TX.tx("Building UI"));
                return self.client.hoard.reconstruct_actions(
                    function (a, next) {
                        // this:Hoard, a:Action, next:function
                        self.$DOMtree.tree("action",a, null, next);
                    },
                    function (percent) {
                        $("#load_progress")
                            .text(percent + '%');
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
                    });
            }

            $("#stage")
                .text(TX.tx("Reading from client"));
            return self.client.store.reads(
                "S." + self.client.store.option("user"))
                .then((data) => {
                    try {
                        self.client.hoard = new Hoard("Client", data);
                        self.client.status = STATII.IS_LOADED;
                    } catch (e) {
                        if (self.debug) self.debug("Caught " + e);
                        self.alert({
                            title: TX.tx("Error"),
                            severity: "error",
                            message: TX.tx("$1 hoard exists, but can't be read.",
                                           self.client.store.option("type")),
                            // After close, clear down and try again
                            after_close: function () {
                                $(document).trigger("init_application");
                            }
                        });
                        self.alert({
                            severity: "notice",
                            message: TX.tx("Check that you have the correct password.")
                        });
                        return;
                    }
                    // Make sure we have a store path. The client store records the
                    // path, which is used to load the cloud store/
                    if (!self.client.hoard.options.store_path
                        && self.cloud.store
                        && self.cloud.store.option("needs_path")) {
                        // Use the settings dlg to set the store path
                        return $.load_dialog("store_settings").then(($dlg) => {
                            return new Promise((resolve, reject) => {
                                $dlg.squirrel_dialog("option", "close", resolve);
                                $dlg.squirrel_dialog("open", {
                                    get_image: false,
                                    get_path: true
                                });
                            });
                        }).then(() => {
                            return rebuild_hoard();
                        });
                    }
                    return rebuild_hoard();
                })
                .catch((e) => {
                    return new Promise((resolve, reject) => {
                        if (e instanceof Serror && e.status === 404) {
                            if (self.debug) self.debug(
                                "Client " + self.client.store.option("type")
                                    + " not found");
                            // TODO: confirm continue
                            return resolve();
                        } else {
                            self.alert({
                                title: TX.tx("Error"),
                                severity: "error",
                                message: TX.tx(
                                    "$1 store error: $2",
                                    self.client.store.option("type"), e.message),
                                after_close: function () {
                                    $(document).trigger("init_application");
                                    reject();
                                }
                            });
                        }
                    });
                });
        }

        /**
         * Login, fill in details the stores didn't provide, prompt
         * if needed.
         */
        _store_login() {
            let self = this;
            let uReq = true;
            let pReq = true;

            if (self.debug) self.debug('_store_login');

            $("#stage")
                .text(TX.tx("Authentication"));

            // Spread user information determined during store initialisation
            // around.
            if (self.cloud.store &&
                typeof self.cloud.store.option("user") !== "undefined") {
                // Force the cloud user onto the client store
                if (self.debug) self.debug("Cloud user is preferred: " + self.cloud.store.option("user"));
                self.client.store.option("user", self.cloud.store.option("user"));
                uReq = false;
            } else if (self.client.store &&
                       typeof self.client.store.option("user") !== "undefined") {
                // Force the client user onto the cloud store
                if (self.debug) self.debug("Client user is available: " + self.client.store.option("user"));
                if (self.cloud.store)
                    self.cloud.store.option("user", self.client.store.option("user"));
                uReq = false;
            }

            if (self.cloud.store &&
                typeof self.cloud.store.option("pass") !== "undefined") {
                // Force the cloud pass onto the client store
                if (self.debug) self.debug("Cloud pass is preferred");
                if (self.client.store)
                    self.client.store.pass(self.cloud.store.option("pass"));
                pReq = false;
            } else if (self.client.store &&
                       typeof self.client.store.option("pass") !== "undefined") {
                // Force the client pass onto the cloud store
                if (self.debug) self.debug("Client pass is available");
                if (self.cloud.store)
                    self.cloud.store.pass(self.client.store.option("pass"));
                pReq = false;
            }

            // If we still need user or password, prompt
            if (!(uReq || pReq))
                return Promise.resolve();

            return $.load_dialog("store_login").then(($dlg) => {
                new Promise((resolve, reject) => {
                    $dlg.squirrel_dialog("open", {
                        store: self.client.store,
                        on_signin: function (user, pass) {
                            if (self.debug) self.debug("Login prompt said user was " + user);
                            if (typeof self.client.store !== "undefined") {
                                self.client.store.option("user", user);
                                self.client.store.option("pass", pass);
                            }
                            if (typeof self.cloud.store !== "undefined") {
                                self.cloud.store.option("user", user);
                                self.cloud.store.option("pass", pass);
                            }
                            resolve();
                        },
                        user_required: uReq,
                        pass_required: pReq
                    });
                });
            });
        }

        /**
         * 401 network login
         */
        _network_login() {
            let self = this;

            if (self.debug) self.debug('_network_login');

            return $.load_dialog("network_login").then(($dlg) => {
                return new Promise((resolve, reject) => {
                    $dlg.squirrel_dialog("open", {
                        on_signin: function (user, pass) {
                            if (self.debug)
                                self.debug("Login prompt said user was " + user);
                            self.client.store.option("net_user", user);
                            self.client.store.option("net_pass", pass);
                            resolve();
                        }
                    });
                });
            });
        }

        /**
         * STEP 2: Initialise the client store. This sets up the store but
         * doesn't read anything yet.
         */
        step_2_init_client_store() {
            let self = this;
            if (self.debug) self.debug('step_2_init_client_store');
            let store = new LocalStorageStore();

            if (self.useEncryption)
                store = new EncryptedStore({ understore: store });

            self.client.store = store;

            return store.init({
                network_login: function() {
                    return self._network_login();
                },
                store_login: function() {
                    return self._store_login();
                }
            })
            .then(() => {
                if (self.debug) self.debug(store.option("type") +
                                           " store is ready");
            });
        }

        /**
         * STEP 1: Initialise the cloud store, and prompt for user details.
         * This step will establish initial contact with OAuth2 stores, but
         * it won't modify anything in the store or download any data.
         */
        step_1_init_cloud_store() {
            let self = this;
            if (self.debug) self.debug('step_1_init_cloud_store');

            let deps = ["js/" + self.cloudStorageProvider];
            if (self.useSteganography) {
                if (self.debug) self.debug("Steganography enabled");
                deps.push("js/StegaStore");
            }
           
            return new Promise((resolve, reject) => {
                requirejs(deps, function(Store, StegaStore) {
                    let store = new Store({ debug: self.debug });

                    if (self.useEncryption) {
                        if (self.debug) self.debug("Encryption enabled");
                        store = new EncryptedStore({ understore: store, debug: self.debug });
                    }

                    if (self.useSteganography) {
                        if (self.debug) self.debug("Steganography enabled");
                        store = new StegaStore({ understore: store, debug: self.debug });
                    }
            
                    console.log("Init",store);
                    return store.init()
                    .then(() => {
                        self.cloud.store = store;
                        resolve();
                    })
                    .catch((e) => {
                        self.alert({
                            title: TX.tx("Warning"),
                            severity: "warning",
                            message: TX.tx("Could not open cloud store: $1", e)
                                + TX.tx("If you continue, only the client store will be available"),
                            after_close: resolve
                        });
                    });
                });
            });
        }

        contextMenu(f) {
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

        before_menu_open(ui) {
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
        handle_menu_choice(ui) {
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
                   debugger;
                   });
                   $("#pasteboard").focus();
                   document.execCommand("Paste");
                   debugger;
                   break;
                   /**/

            case "insert_copy":
                if (self.clipboard) {
                    let data = JSON.parse(self.clipboard);
                    $.load_dialog("insert").then(($dlg) => {
                        $dlg.squirrel_dialog("open", {
                            $node: $node,
                            data: data
                        });
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
                $.load_dialog("add").then(($dlg) => {
                    $dlg.squirrel_dialog("open", {
                        $node: $node,
                        is_value: true
                    });
                });
                break;

            case "add_subtree":
                $.load_dialog("add").then(($dlg) => {
                    $dlg.squirrel_dialog("open", {
                        $node: $node,
                        is_value: false
                    });
                });
                break;

            case "randomise":
                $.load_dialog("randomise").then(($dlg) => {
                    $dlg.squirrel_dialog("open", {
                        $node: $node
                    });
                });
                break;

            case "add_alarm":
                $.load_dialog("alarm").then(($dlg) => {
                    .squirrel_dialog("open", {
                        $node: $node
                    });
                });
                break;

            case "delete":
                $.load_dialog("delete").then(($dlg) => {
                    .squirrel_dialog("open", {
                        $node: $node
                    });
                });
                break;

            case "pick_from":
                $.load_dialog("pick").then(($dlg) => {
                    .squirrel_dialog("open", {
                        $node: $node
                    });
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
                beforeOpen: (e, ui) => { self.before_menu_open(ui); },
                select: (e, ui) => { self.handle_menu_choice(ui); }
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
         * Promise to initialise application (new Squirrel(), effectively)
         */
        _init_application() {
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
                    return self.step_4_init_client_hoard();
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

            Tree.compare = function (a, b) {
                if (a === b)
                    return 0;
                for (let i = 0; i < self.sort_prio.length; i++) {
                    if (a === self.sort_prio[i])
                        return -1;
                    if (b === self.sort_prio[i])
                        return 1;
                }
                return (a < b) ? -1 : 1;
            };
            Tree.playAction = (action, more) => {
                return self.playAction(action, more);
            };
            Tree.onOpenEditor = () => { self.contextMenu("disable"); };
            Tree.onCloseEditor = () => { self.contextMenu("enable"); };
            Tree.onHoverIn = () => {
                self.contextMenu("close"); return false;
            };
            Tree.onHoverOut = () => {
                return self.contextMenu("isOpen");
            };
            Tree.hidingValues = () => {
                return (self.cookies.get("ui_hidevalues") === "on");
            };

            self.$DOMtree = $("#sites-node");
            self.$DOMtree.tree({});

            // Set options for squirrel dialogs
            $.set_dialog_options({
                autoOpen: false,
                squirrel: this,
                debug: self.debug,
                // Actions performed when dialog is first loaded
                onload: function($dlg) {
                    $dlg.find("button")
                        .icon_button();
                    TX.translate($dlg);
                }
            });
            
            $("#alerts")
                .dialog({
                    autoOpen: false
                });

            $(".template")
                .template();
            $(".twisted")
                .twisted();
            $("button")
                .icon_button();

            $('input[type="password"]').simulated_password();

            if (self.debug) {
                let pick = 1;
                $("#template-test")
                    .template()
                    .template("pick", pick)
                    .template("expand", "Cats");
                $("#template-tester")
                    .icon_button()
                    .on("click", function () {
                        $("#template-test")
                            .template("pick", pick)
                            .template("expand", "Squirrels", "cats");
                        pick = (pick + 1) % 3;
                    });
            } else
                $(".debug-only")
                .remove();

            $("#save_button")
                .hide()
                .on($.getTapEvent(), ( /*evt*/ ) => {
                    self.save_hoards().then(() => { return self.save_client(); });
                    return false;
                });

            $("#undo_button")
                .hide()
                .on($.getTapEvent(), function ( /*evt*/ ) {
                    self.undo(function (mess) {
                        self.alert({
                            title: "Undo",
                            message: mess
                        });
                    });
                    return false;
                });

            $("#extras_button")
                .on($.getTapEvent(), function ( /*evt*/ ) {
                    $.load_dialog("extras").then(($dlg) => {
                        $dlg.squirrel_dialog("open");
                    });
                });

            $("#search_input")
                .on("change", function ( /*evt*/ ) {
                    self.search($(this)
                                .val());
                });

            $("#search_button")
                .on($.getTapEvent(), function ( /*evt*/ ) {
                    self.search($("#search_input")
                                .val());
                });

            self._init_menus();

            // Set up event handlers
            $(document)
                .on("init_application", () => {
                    self._init_application();
                })
                .on("check_alarms", () => {
                    self._check_alarms();
                })
                .on("update_save", () => {
                    self._update_save();
                })
                .on("set_theme", (t) => {
                    self._theme(t);
                })
                .on("set_autosave", (t) => {
                    self.autosave(t);
                })
                .on("set_zoom", (z) => {
                    self.zoom(z);
                })
                .on("set_hiding", (tf) => {
                    Tree.hidingValues = tf;
                });

            $.reset_styling();
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
            self.client.hoard.play_action(e)
                .then((res) => {
                    if (res.conflict)
                        self.alert({
                            message: res.conflict
                        });
                    else
                        // this:Hoard, e:Action
                        self.$DOMtree.tree(
                            "action",
                            res.event,
                            self.pushUndo.bind(self),
                            function ($newnode) {
                                if (!$newnode) {
                                    throw new Error("ERROR: node creation failed");
                                }
                                let p;
                                if (typeof value !== "string" && typeof value !== "undefined")
                                    self.insert_data($newnode.tree("getPath"), value);
                                $newnode.tree("open", {
                                    decorate: true
                                });
                            });
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
                    self.alert({
                        message: TX.tx("Error in search expression") +
                            " '" + s + "': " + e
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
         * Insert data from a structure under the given path
         * @param path path to the parent below which this data will be inserted
         * @param data hoard cache format data
         */
        insert_data(path, data) {
            let self = this;
            self.alert({
                title: "Loading"
            });

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
                                self.alert({
                                    severity: "notice",
                                    message: res.conflict
                                });
                            } else
                                // this:Hoard, e:Action
                                self.$DOMtree.tree("action", res.event, null);
                        });
                })
                .then(() =>{ // chain on complete
                    $(document).trigger("update_save");
                    self.alert({
                        severity: "notice",
                        message: TX.tx("JSON has been loaded")
                    });
                });
        }

        // Interface to action playing for interactive functions
        playAction(action, more) {
            let self = this;
            action = self.client.hoard.push_action(action);
            let res = self.client.hoard.play_action(
                action,
                function (e) {
                    // this:Hoard, e:Action
                    self.$DOMtree.tree("action",
                                       e,
                                       self.pushUndo,
                                       function ($node) {
                                           if (more)
                                               more($node);
                                           self.trigger("update_save");
                                       });
                });
            if (res !== null)
                self.alert({
                    title: TX.tx("Error"),
                    severity: "error",
                    message: res.message
                });
        }

        /**
         * Push an undo
         */
        pushUndo() {
            let self = this;
            self.undos.push(Hoard.new_action.apply(null, arguments));
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
                                self.client.status === STATII.IS_LOADED)
                                $(".tree-modified")
                                .removeClass("tree-modified");
                            self.trigger("update_save");
                        });
                });
            if (res !== null)
                self.alert({
                    title: TX.tx("Error"),
                    severity: "error",
                    message: res.message
                });
        }
    }

    return Squirrel;
});
