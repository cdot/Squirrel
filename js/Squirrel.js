/*@preserve Copyright (C) 2015-2019 Crawford Currie http://c-dot.co.uk license MIT*/
/* eslint-env browser,jquery */

define("js/Squirrel", ['js/Serror', 'js/Utils', "js/Dialog", "js/Action", "js/Hoarder", "js/LocalStorageStore", "js/EncryptedStore", "js/Translator", "js/Tree", "js-cookie", "js/ContextMenu", "js/jq/simulated_password", "js/jq/scroll_into_view", "js/jq/icon_button", "js/jq/styling", "js/jq/template", "js/jq/twisted", "jquery", "jquery-ui", "mobile-events" ], function(Serror, Utils, Dialog, Action, Hoarder, LocalStorageStore, EncryptedStore, Translator, Tree, Cookies, ContextMenu) {

    let TX = Translator.instance(); // Singleton

    /*
     * The application startup process proceeds from
     * "init_application" though a sequence of triggered events. Once
     * the final step is reached, control is handed off to the Tree
     * module, which governs most interaction.  reached
     */

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

            self.hoarder = new Hoarder(self.debug);

            if (!self.options.store) {
                if (self.debug) self.debug("Defaulting to LocalStorageStore");
                self.options.store = "LocalStorageStore";
            }

            self.$DOMtree = null;

            // Pointer to tree widget at root of DOM tree
            //self.DOMtree;

            self.last_search = "";
            self.picked_hit = 0;
        }

        /**
         * Service for dialogs to set a new encryption password
         */
        encryptionPass(p) {
            this.hoarder.set_encryption_pass(p);
            this.trigger("update_save");
        }

        /**
         * @private
         * Event handler code for "check_alarms" event
         */
        _handle_alarms( /* event */ ) {
            let self = this;
            let lerts = [];

            self.hoarder.check_alarms(
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

            // Reverse-engineer change details
            $(".tree-modified")
                .each(function () {
                    Serror.assert($(this).tree("getPath") ||
                                  $(this).hasClass("tree-root"))
                    let path = $(this).data("path") || [];
                    message.push(TX.tx("$1 has changed",
                                       path.join("↘")));
                });

            if (message.length > max_changes) {
                let l = message.length;
                message = message.slice(0, max_changes);
                message.push(TX.tx("... and $1 more change$?($1!=1,s,)", l - max_changes));
            }

            let client_mods = self.hoarder.changes;
            if (client_mods > 0)
                message.unshift(TX.tx(
                    "The browser has $1 change$?($1!=1,s,)",
                    client_mods));

            if (message.length === 0)
                return null;

            return message.join("\n");
        }


        /**
         * @private
         */
        _save_stores(progress) {
            let self = this;
            
            self.hoarder.synchronise_and_save(
                progress,
                (act) => {
                    self.$DOMtree.tree("action", act)
                })
            .then(() => {
                $(".tree-modified")
                .removeClass("tree-modified");

                $(document).trigger("update_save");
            });
        }
        
        /**
         * Public because it is used by the optimise dialog.
         * Promise to construct a new cloud hoard from data in the
         * client.
         * @return a promise that resolves to true if the construction succeeded
         */
        construct_new_cloud(progress) {
            return this.hoarder.construct_new_cloud(progress);
        }

        /**
         * @private
         * Event handler for "update_save" event
         */
        _handle_update_save( /*event*/ ) {
            let self = this;
            $("#undo_button").toggle(self.hoarder.can_undo());
            let $sb = $("#save_button");
            let autosave = (Cookies.get("ui_autosave") === "on");
            let us = self._unsaved_changes(3);

            if (us === null)
                $sb.hide(); // nothing to save
            else if (autosave) {
                $sb.hide();
                self._save_stores();
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
                this.cloud_store &&
                this.cloud_store.option("needs_image");

            return Dialog.confirm("store_settings", {
                needs_image: needs_image,
                path: this.hoarder.cloud_path()
            })
            .then((dlg) => {
                self.hoarder.cloud_path(dlg.control("path").val());
                if (needs_image)
                    self.hoarder.changes++;
                $(document).trigger("update_save");
            });
        }

        dump_client_store() {
            let store = new LocalStorageStore();
            store.option("user", this.hoarder.user());
            let s = store._wtf("client");
            let i = 0;
            while (i < s.length) {
                let buffer = [];
                for (let j = 0; j < 40 && i < s.length; j++) {
                    buffer.push(s.charCodeAt(i++));
                }
                console.log(buffer.join(",") + ",");
            }
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
                user: self.cloud_store.option("user")
                || self.client_store.option("user")
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
         * Initialisation of the cloud store *may* provide user
         * information - for example, initialisation of a
         * GoogleDriveStore will require a google login to a specific
         * user. We leverage this to get initial user information
         * which can be used in determining the encryption user for
         * the client store.
         */
        _1_init_cloud_store() {
            let self = this;
            if (self.debug) self.debug('1: init cloud store');
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
                if (self.debug) self.debug('...adding encryption to cloud');
                p = p.then(() => {
                    store = new EncryptedStore({
                        debug: self.debug,
                        understore: store
                    })
                });
            }

            if (typeof self.options.steg !== "undefined") {
                if (self.debug) self.debug('...adding steganography to cloud');
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
                if (store.option("needs_url")) {
                    if (self.options.url) {
                        store.option("url", self.options.url);
                    } else {
                        return Dialog.confirm("alert", {
                            alert: {
                                severity: "error",
                                message: TX.tx(
                                    "A URL is required for cloud $1 store",
                                    store.type)
                            }
                        }).then(() => {
                            throw new Serror(400, "No URL given for store");
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
                self.hoarder.cloud_store(store);
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
         * @private
         * This sets up the store but doesn't read anything
         * yet. Initialisation of the client store *may* provide user
         * information, but it will be overridden by any user
         * information coming from the cloud store.
         */
        _2_init_client_store() {
            let self = this;
            if (self.debug) self.debug('2: initialise client store');

            let store = new LocalStorageStore({
                debug: self.debug
            });

            // Add encryption layer unless we have been requested not to
            // (probably for debugging)
            if (typeof self.options.plaintext === "undefined") {
                if (self.debug) self.debug('adding encryption to client');
                store = new EncryptedStore({
                    understore: store
                });
            }
            self.hoarder.client_store(store);

            // Initialisation of the cloud store may have provided
            // initial user information, either from a network login
            // or from a service login. Seed the login dialog with one
            // of them.
            return self.hoarder.client_store().init({
                network_login: () => {
                    // TX.tx("client")
                    return self._network_login("client");
                }
            })
            .then(() => {
                // Need to confirm user/pass, which may have been
                // seeded from the store initialisation process
                $("#stage").text(TX.tx("Authentication"));
                let auth_req = self.hoarder.auth_required();
                if (!auth_req)
                    return Promise.resolve();
                
                return Dialog.confirm("login", {
                    title: "User details",
                    user: auth_req.user
                }).then((dlg) => {
                    if (self.debug) self.debug("...login confirmed");

                    self.hoarder.authenticate(
                        { user: dlg.control("user").val(),
                          pass: dlg.control("pass").val() });
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
        _3_load_client() {
            let self = this;

            return self.hoarder.load_client((a) => {
                self.$DOMtree.tree("action", a);
            })
            .then((result) => {
                if (result.ok) {
                    // Reset the UI modification list; we just loaded the
                    // client hoard
                    $(".tree-modified").removeClass("tree-modified");
                    // Re-mark all the nodes mentioned in the pending
                    // actions list as modified. If a node isn't found,
                    // back up the tree until we find a parent that does
                    // exist and mark it.
                    self.hoarder.each_pending_action((a) => {
                        let pat = a.path.slice();
                        while (pat.length > 0) {
                            let $node = self.$DOMtree.tree("getNodeFromPath", pat);
                            if ($node) {
                                $node.addClass("tree-modified");
                                break;
                            }
                            pat.pop(); // try parent
                        }
                    })
                    return Promise.resolve();
                } else {
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
                }
            });
        }

        /**
         * @private
         * Optional initialisation step, executed when cloud hoard is
         * known to have loaded successfully. Promise to merge cloud actions into the
         * client.
         */
        _4a_merge_from_cloud() {
            let self = this;
            let lerts = [];
            self.hoarder.merge_from_cloud(
                lerts,
                function (e) {
                    self.$DOMtree.tree("action", e.action);
                });

            if (lerts.length === 0)
                return Promise.resolve();
            lerts.unshift(
                TX.tx("Conflicts were detected while merging actions from the cloud"));
            lerts.unshift(
                TX.tx("Please review these rejected actions, and make sure the data displayed is correct before saving"));
            return Dialog.confirm("alert", {
                title: TX.tx("Conflicts Detected"),
                alert: lerts
            })
        }

        /**
         * @private
         * Called when we have a (possibly empty) client hoard.
         * Try and synch it from the cloud.
         * Resolve to true if the cloud hoard is ready to be merged from,
         * false otherwise.
         */
        _4_load_cloud() {
            let self = this;
            let cloud_store = self.cloud_store;

            if (!cloud_store)
                return Promise.resolve(false);

            if (self.debug) self.debug('4: load cloud');

            let p;

            // Make sure we have a cloud path. The client
            // store records the path, which is used to load
            // the cloud store/
            if (self.hoarder.cloud_path())
                p = Promise.resolve();
            else
                // Use the settings dlg to initialise the cloud store path
                p = self.get_store_settings();

            return p.then(() => {
                return self.hoarder.load_cloud();
            })
            .then(() => {

                // Merge updates from cloud hoard to client
                return self._4a_merge_from_cloud();
            })
            .catch((e) => {
                if (self.debug) self.debug(e);
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
                    return self.hoarder.construct_new_cloud()
                    .then(() => {
                        return Promise.resolve(false);
                    });
                });
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
            Tree.onTitleHoverIn = () => {
                $("body").contextmenu("close"); return false;
            };
            Tree.onTitleHoverOut = () => {
                return $("body").contextmenu("isOpen");
            };
            Tree.hidingValues = () => {
                return (Cookies.get("ui_hidevalues") === "on");
            };
            Tree.showingChanges = (tf) => {
                if (typeof tf !== "undefined") {
                    Cookies.set("ui_showchanges", tf ? "on" : null);
                }
                return (Cookies.get("ui_showchanges") === "on");
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
                        return self._save_stores(progress);
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

            $.styling.reset();

            // Set up event handlers.
            $(document)
            .on("check_alarms", () => {
                self._handle_alarms();
            })
            .on("update_save", () => {
                self._handle_update_save();
            })
            // Application startup is done using a sequence of events
            // to give the event loop a look in.
            .on("init_application", () => {
                self._1_init_cloud_store()
                .then(() => {
                    $(document).trigger("init_2");
                });
            })
            .on("init_2", () => {
                self._2_init_client_store()
                .then(() => {
                    $(document).trigger("init_3");
                });
            })
            .on("init_3", () => {
                $("#stage").text(TX.tx("Reading from client"));
                self._3_load_client()
                .then(() => {
                    $(document).trigger("init_4");
                });
            })
            .on("init_4", () => {
                $("#stage").text(TX.tx("Reading from cloud"));
                self._4_load_cloud()
                .then(() => {
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

                    $("#whoami").text(self.hoarder.user());

                    // Ready to rock
                    $("#unauthenticated").hide();
                    $("#authenticated").show();
                    $("#sites-node").tree("open");
                });
            });
            
            $(document).trigger("init_application");
       }

        /**
         * Promise to perform a (manual) new tree node action
         */
        add_child_node($node, title, value) {
            let self = this;
            let path = $node.tree("getPath").concat(title);
            self.hoarder.add_action(
                new Action({
                    type: "N", path: path, time: Date.now(),
                    data: (typeof value === "string") ? value : undefined}))
            .then((res) => {
                if (res.conflict)
                    return Dialog.confirm("alert", {
                        alert: {
                            severity: "warning",
                            message: res.conflict
                        }
                    });

                self.$DOMtree.tree(
                    "action",
                    res.action,
                    Hoarder.push_undo.bind(self.hoarder),
                    ($newnode) => {
                        Serror.assert($newnode);

                        if (typeof value !== "string"
                            && typeof value !== "undefined")
                            self.insert_data($newnode.tree("getPath"), value);
                        $newnode.tree("open", {
                            decorate: true
                        });
                    });

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
                .text(TX.tx(
                    "$1 of $2 found", self.picked_hit + 1, hits.length));
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

            Hoard.actions_from_tree(
                {
                    data: data
                },
                function (act) {
                    // this:Hoard, e:Action, next:function
                    //if (self.debug) self.debug(act);
                    act.path = path.slice().concat(act.path);
                    self.hoarder.add_action(new Action(act))
                    .then((res) => {
                        if (res.conflict) {
                            if (progress) progress.push({
                                severity: "notice",
                                message: res.conflict
                            });
                        } else {
                            // this:Hoard, e:Action
                            self.$DOMtree.tree("action", res.action, null);
                        }
                    });
                })

            $(document).trigger("update_save");
            progress.push({
                severity: "notice",
                message: TX.tx("JSON has been loaded")
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
            self.hoarder.add_action(new Action(action))
            .then((e) => {
                if (self.debug && e.conflict) debugger;
                self.$DOMtree.tree(
                    "action",
                    e.action,
                    Hoarder.push_undo.bind(self.hoarder),
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
         * Undo the most recent action
         */
        undo() {
            let self = this;

            this.hoarder.undo()
            .then((e) => {
                if (self.debug && e.conflict) debugger;
                self.$DOMtree.tree(
                    "action",
                    e.action,
                    function () {
                        // If there are no undos, there can be no modifications.
                        // The client status will not be changed, though, so a
                        // save may still be required.
                        if (!self.hoarder.can_undo() && self.hoarder.client_mods() === 0) {
                            $(".tree-modified")
                            .removeClass("tree-modified");
                        }
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
