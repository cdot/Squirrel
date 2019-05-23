/*@preserve Copyright (C) 2015-2019 Crawford Currie http://c-dot.co.uk license MIT*/
/* eslint-env browser,jquery */

define("js/Squirrel", ['js/Serror', 'js/Utils', "js/Dialog", "js/Action", "js/Hoarder", "js/LocalStorageStore", "js/EncryptedStore", "js/Translator", "js/Tree", "js-cookie", "js/ContextMenu", "js/jq/simulated_password", "js/jq/scroll_into_view", "js/jq/icon_button", "js/jq/styling", "js/jq/template", "js/jq/twisted", "jquery", "jquery-ui", "mobile-events" ], function(Serror, Utils, Dialog, Action, Hoarder, LocalStorageStore, EncryptedStore, Translator, Tree, Cookies, ContextMenu) {

    let TX;

    /**
     * This is the top level application singleton. It is primarily
     * concerned with UI management; database handling is done by the
     * Hoarder object created here.
     *
     * The application startup process proceeds from
     * "init_application" though a sequence of triggered events. Once
     * the final step is reached, control is handed off to the Tree
     * module, which governs most interaction.
     */

    // Dialogs for loading in the background. These are loaded in roughly
    // the order they are likely to be used, but the loads are supposed to
    // be asynchronous so the order shouldn't really matter.
    const DIALOGS = [ "alert", "login", "alarm", "store_settings",
                      "choose_changes", "insert", "pick", "add",
                      "delete", "randomise", "extras", "about",
                      "optimise", "json" ];
    
    class Squirrel {

        /**
         * OPTIONS:
         * debug - boolean
         * store - string name of the cloud store type
         * url - store URL, if it requires one
         * steg - boolean, enable steganography
         */
        constructor(options) {
            let self = this;

            if (!TX)
                TX = Translator.instance();

            self.options = options || {};

            if (self.options.debug) {
                self.debug = console.debug;
                self.debug("Debug enabled");
            }

            self.hoarder = new Hoarder({debug: self.debug});

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
         * @private
         * Report current stage of startup process
         */
        _stage(s, step) {
            if (this.debug) this.debug(step + ": " + s);
            $("#stage").text(s);
        }
        
        /**
         * @private
         * Event handler code for "check_alarms" event
         */
        _handle_alarms( /* event */ ) {
            let self = this;
            let lerts = [];

            self.hoarder.check_alarms(
                (path, expired) => {
                    let $node = self.$DOMtree.tree("getNodeFromPath", path);
                    $node.tree("ringAlarm");
                    lerts.push(
                        {
                            severity: "warning",
                            message:
                            "<div class='ui-icon squirrel-icon tree-icon-rang'></div>" +
                            TX.tx("Reminder on '$1' was due on $2",
                                  Action.pathS(path),
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
         */
        _save_stores(progress) {
            let self = this;

            this.hoarder.save_stores(
                progress,
                (actions) => { // selector
                    return Dialog.confirm("choose_changes", {
                        changes: actions
                    });
                },
                (act) => { // player
                    return self.$DOMtree.tree("action", act);
                })
            .then((saved) => {
                if (saved) {
                    // otherwise if cloud or client save failed, we have to
                    // try again
                    $(".tree-modified")
                    .removeClass("tree-modified");
                }
                $(document).trigger("update_save");
            });
        }
        
        /**
         * @private
         * Event handler for "update_save" event
         */
        _handle_update_save( /*event*/ ) {
            let self = this;

            if (self.hoarder.can_undo())
                $("#undo_button")
                .show().attr("title", self.hoarder.next_undo());
            else
                $("#undo_button").hide();
            let $sb = $("#save_button");
            let autosave = (Cookies.get("ui_autosave") === "on");
            let us = self.hoarder.get_changes(10);

            if (us.length === 0)
                $sb.hide(); // nothing to save
            else if (autosave) {
                $sb.hide();
                self._save_stores();
            } else {
                $sb.attr(
                    "title",
                    TX.tx("These changes need to be saved:\n$1",
                          us.join("\n")));
                $sb.show();
            }
        }

        /**
         * Use classes to mark modifications in the UI tree
         */
        reset_modified() {
            let self = this;
            
            // Reset the UI modification list
            $(".tree-modified").removeClass("tree-modified");
            
            // Re-mark all the nodes mentioned in the pending
            // actions list as modified. If a node isn't found,
            // back up the tree until we find a parent that does
            // exist and mark it.
            let paths = {};

            // Add a path to the modified paths tree
            function add(path, offset, node) {
                if (offset === path.length)
                    return;
                if (!node[path[offset]])
                    node[path[offset]] = {};
                add(path, offset + 1, node[path[offset]]);
            }

            // Walk the modified paths tree, marking modified nodes
            function mark(path, node) {
                if (Object.keys(node).length === 0) {
                    while (path.length > 0 && self.hoarder.node_exists(path)) {
                        let $node = self.$DOMtree.tree("getNodeFromPath", path);
                        if ($node) {
                            $node.addClass("tree-modified");
                            return;
                        }
                        path.pop(); // try parent
                    }
                } else {
                    for (let sn in node)
                        mark(path.concat(sn), node[sn]);
                }
            }
            
            for (let record of this.hoarder.history()) {
                add(record.redo.path, 0, paths);
                add(record.undo.path, 0, paths);
            }

            mark([], paths);
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
         * @param domain what we are logging in to (cloud or client)
         */
        _network_login(domain) {
            let self = this;

            if (self.debug) self.debug(domain, "network login");

            return Dialog.confirm("login", {
                title: TX.tx("Network login for $1", domain),
                // Copy default user from the stores if there
                user: this.hoarder.probableUser()
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
            let store;

            let p = new Promise(function(res,rej) {
                requirejs(
                    ["js/" + self.options.store],
                    function(module) {
                        store = new module({
                            debug: self.debug,
                            network_login: () => {
                                return self._network_login(TX.tx("cloud"));
                            }
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
                return store.init()
            })
            .then(() => {
                // Tell the hoarder to use this store
                self.hoarder.cloud_store(store);
            })
            .catch((e) => {
                return Dialog.confirm("alert", {
                    title: TX.tx("Warning"),
                    alert: {
                        severity: "warning",
                        message: [
                            TX.tx("Could not open cloud store: $1", e),
                            TX.tx("If you continue, only the client store will be available"),
                        ]
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
            
            // Tell the hoarder to use this store
            self.hoarder.client_store(store);

            // Initialisation of the cloud store may have provided
            // initial user information, either from a network login
            // or from a service login. Seed the login dialog with one
            // of them.
            return store.init()
            .then(() => {
                // Need to confirm user/pass, which may have been
                // seeded from the store initialisation process
                this._stage(TX.tx("Authentication"), 2.1);
                let auth_req = self.hoarder.auth_required();
                if (!auth_req)
                    return Promise.resolve();
                
                return Dialog.confirm("login", {
                    title: "User details",
                    user: auth_req.user
                }).then((info) => {
                    if (self.debug) self.debug("...login confirmed");
                    self.hoarder.authenticate(info);
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
            
            return self.hoarder.load_client()
            .catch((lerts) => {
                return Dialog.confirm("alert", {
                    title: TX.tx("Browser store read failed"),
                    alert: lerts});
            })
            .then(() => {
                // Add steganography image, if required
                if (self.hoarder.needs_image()) {
                    let $img = $("<img id='stegamage' src='"
                                 + self.hoarder.image_url() + "'>");
                    $img.hide();
                    $("body").append($img);
                }
                // Load the tree into the UI by replaying actions
                let promise = Promise.resolve();
                for (let act of self.hoarder.tree_actions()) {
                    let prom = self.$DOMtree.tree("action", act);
                    promise = promise.then(prom);
                }
                return promise
                .then(() => {
                    self.reset_modified();
                })
            });
        }

        /**
         * @private
         * Called when we have a (possibly empty) client hoard.
         * Try and synch it from the cloud.
         */
        _4_load_cloud() {
            let self = this;
            let cloud_store = self.hoarder.cloud_store();

            if (!cloud_store)
                return Promise.resolve(false);

            let p;

            // Make sure we have a cloud path. The client
            // store records the path, which is used to load
            // the cloud store/
            let clop = self.hoarder.cloud_path();
            if (typeof clop === "string" && clop !== "")
                p = Promise.resolve();
            else {
                // Use the store_settings dlg to initialise the cloud store
                // path and optional steganography image
                p = Dialog.confirm("store_settings", {
                    cloud_path: (path) => {
                        path = self.hoarder.cloud_path(path);
                        return path;
                    },
                    needs_image: self.hoarder.needs_image(),
                    image_url: (path) => {
                        path = self.hoarder.image_url(path);
                        $("#stegamage").attr("src", path);
                        return path;
                    }
                })
                .then((paths) => {
                    self.hoarder.cloud_path(paths.cloud_path);
                    self.hoarder.image_url(paths.image_url);
                    $(document).trigger("update_save");
                });
            }

            return p.then(() => {
                return self.hoarder.load_cloud();
            })
            .then((actions) => {
                let conflicts = [];

                // Merge updates from cloud hoard to client
                return self.hoarder.update_from_cloud(
                    conflicts,
                    (actions) => { // selector
                        return Dialog.confirm("choose_changes", {
                            changes: actions
                        });
                    },
                    (act) => { // player
                        return self.$DOMtree.tree("action", act);
                    },
                    actions)

                // Resolves to list of actions required to update
                // the cloud, which we can't use at this point.
                .then((actions) => {
                    if (conflicts.length > 0)
                        return Dialog.confirm("alert", {
                            title: TX.tx("Conflicts"),
                            alert: conflicts
                        });
                });
            })
            .catch((e) => {
                if (self.debug) self.debug(e);
                let mess = [];
                mess.push({
                    severity: "error",
                    message: TX.tx("Could not load cloud store '$1'",
                                   self.hoarder.cloud_path())
                });
                if (e instanceof Serror && e.status === 404) {
                    // Could not contact cloud; continue all the same
                    if (self.debug) self.debug(
                        self.hoarder.cloud_path(), "not found in the cloud");
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
                });
            });
        }

        /**
         * Main entry point for the application, invoked from main.js
         */
        begin() {
            let self = this;

            this._stage(TX.tx("Loading application"), 0);
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
            Tree.hidingValues = (tf) => {
                if (typeof tf !== "undefined") {
                    Cookies.set("ui_hidevalues", tf ? "on" : null);
                }
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
                    self.hoarder.undo()
                    .then((act) => {
                        self.$DOMtree.tree("action", act)
                        .then(() => {
                            self.reset_modified();
                            $(document).trigger("update_save");
                        });
                    })
                    .catch((e) => {
                        if (self.debug) self.debug("undo failed", e);
                        Dialog.confirm("alert", {
                            title: TX.tx("Error"),
                            alert: {
                                severity: "error",
                                message: e.message
                            }
                        });
                    });
                    return false;
                });

            $("#extras_button")
                .icon_button()
                .on(Dialog.tapEvent(), function ( /*evt*/ ) {
                    Dialog.confirm("extras", {
                        needs_image: self.hoarder.needs_image(),
                        image_url: (path) => {
                            path = self.hoarder.image_url(path);
                            $(document).trigger("update_save");
                            return path;
                        },
                        cloud_path: (path) => {
                            path = self.hoarder.cloud_path(path);
                            $(document).trigger("update_save");
                            return path;
                        },
                        encryption_pass: (pass) => {
                            pass = self.hoarder.encryption_pass(pass);
                            $(document).trigger("update_save");
                            return pass;
                        },
                        tree_json: (json) => {
                            json = self.hoarder.JSON();
                            $(document).trigger("update_save");
                            return json;
                        },
                        analyse: () => {
                            let counts = {
                                cloud: self.hoarder.cloudLength,
                                N: 0,
                                A: 0,
                                X: 0
                            };
                            let acts = self.hoarder.tree_actions();
                            for (let act of acts)
                                counts[act.type]++;
                            return counts;
                        },
                        optimise: () => {
                            let acts = self.hoarder.tree_actions();
                            return Dialog.open("alert", {
                                title: "Saving",
                                alert: ""
                            }).then((progress) => {
                                return self.hoarder.save_cloud(acts, progress)
                            });
                        }
                    })
                    .then((res) => {
                        // replace the client tree with this data
                        if (res.new_json)
                            this.hoarder.insert_data([], res.new_json, self)
                    })
                    .catch((f) => {
                        if (self.debug) self.debug("extras closed");
                    });
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
                this._stage(TX.tx("Initialising cloud store"), 1);
                self._1_init_cloud_store()
                .then(() => {
                    $(document).trigger("init_2");
                });
            })
            .on("init_2", () => {
                this._stage(TX.tx("Initialising browser store"), 2);
                self._2_init_client_store()
                .then(() => {
                    $(document).trigger("init_3");
                });
            })
            .on("init_3", () => {
                this._stage(TX.tx("Reading from browser"), 3);
                self._3_load_client()
                .then(() => {
                    $(document).trigger("init_4");
                });
            })
            .on("init_4", () => {
                this._stage(TX.tx("Reading from cloud"), 4);
                self._4_load_cloud()
                .then(() => {
                    $(window)
                    .on("beforeunload", function () {
                        let us = self.hoarder.get_changes(10);
                        if (us.length > 0) {
                            us = TX.tx("You have unsaved changes") +
                            "\n" + us.join("\n") +
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

                    this._stage(TX.tx("Ready"), 5);
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
            self.hoarder.play_action(
                { type: "N", path: path, time: Date.now(),
                  data: (typeof value === "string") ? value : undefined },
                true)
            .then((res) => {
                if (res.conflict)
                    return Dialog.confirm("alert", {
                        alert: {
                            severity: "warning",
                            message: res.conflict
                        }
                    });

                self.$DOMtree.tree("action", res.action)
                .then(() => {
                    let $newnode = self.$DOMtree.tree("getNodeFromPath",
                                                      res.action.path);
                    Serror.assert($newnode);

                    if (typeof value !== "string"
                        && typeof value !== "undefined")
                        self.insert_data($newnode.tree("getPath"), value);
                    $newnode.tree("open", {
                        decorate: true
                    });

                    $(document).trigger("update_save");
                });
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
            let th = new Hoard({tree: { data: data }});
            for (let act of th.actions_to_recreate()) {
                // this:Hoard, e:Action, next:function
                //if (self.debug) self.debug(act);
                act.path = path.slice().concat(act.path);
                self.hoarder.play_action(new Action(act))
                .then((res) => {
                    if (res.conflict) {
                        if (progress) progress.push({
                            severity: "notice",
                            message: res.conflict
                        });
                    } else
                        self.$DOMtree.tree("action", res.action);
                });
            }

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
            self.hoarder.play_action(new Action(action))
            .then((e) => {
                if (self.debug && e.conflict)
                    self.debug("interactive", action,
                               "had conflict", e.conflict);
                self.$DOMtree.tree("action", e.action)
                .then(() => {
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
    }

    return Squirrel;
});
