/*@preserve Copyright (C) 2015-2019 Crawford Currie http://c-dot.co.uk license MIT*/
/* eslint-env browser,jquery */

define("js/Squirrel", ['js/Serror', 'js/Utils', "js/Dialog", "js/Action", "js/Hoarder", "js/Hoard", "js/LocalStorageStore", "js/Translator", "js/Tree", "js-cookie", "js/ContextMenu", "js/jq/simulated_password", "js/jq/scroll_into_view", "js/jq/icon_button", "js/jq/styling", "js/jq/template", "js/jq/twisted" ], function(Serror, Utils, Dialog, Action, Hoarder, Hoard, LocalStorageStore, Translator, Tree, Cookies, ContextMenu) {

    let TX = Translator.instance();

    /**
     * This is the top level application singleton. It is primarily
     * concerned with UI management; database handling is done by the
     * Hoarder object created here.
     *
     * The application startup process proceeds from
     * "begin()" though a sequence of triggered events. Once
     * the final step is reached, control is handed off to the Tree
     * module, which governs most interaction.
     * To help testing, as much as possible is delegated to a
     * paired "Hoarder" singleton.
     */

    // Dialogs for loading in the background. These are loaded in roughly
    // the order they are likely to be used, but the loads are supposed to
    // be asynchronous so the order shouldn't really matter.
    const DIALOGS = [ "alert", "login", "alarm", "store_settings",
                      "choose_changes", "insert", "pick", "add",
                      "delete", "randomise", "extras", "about",
                      "optimise" ];
    
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

            self.options = options || {};

            if (self.options.debug) {
                self.debug = console.debug;
                self.debug("Debug enabled");
            }

            self.hoarder = new Hoarder({debug: self.debug});

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
            if (this.debug) this.debug(`${step}: ${s}`);
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
                    $(".tree-isModified")
                    .removeClass("tree-isModified");
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
         * @private
         * Use classes to mark modifications in the UI tree
         */
        _reset_modified() {
            let self = this;
            
            // Reset the UI modification list
            $(".tree-isModified").removeClass("tree-isModified");
            
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
                            $node.addClass("tree-isModified");
                            return;
                        }
                        path.pop(); // try parent
                    }
                } else {
                    for (let sn in node)
                        mark(path.concat(sn), node[sn]);
                }
            }
            
            for (let record of this.hoarder.get_unsaved_actions()) {
                add(record.redo.path, 0, paths);
                add(record.undo.path, 0, paths);
            }

            mark([], paths);
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

        _add_layers(to, store) {
            let self = this;
            let p = Promise.resolve(store);
            
            for (let algo of this.options.use) {
                if (algo.length === 0)
                    continue;
                let layer = algo.replace(/^([a-z])/, (m) => m.toUpperCase())
                    + "Layer";
                
                p = p.then((store) => {
                    return new Promise((resolve) => {
                        requirejs(
                            [`js/${layer}`],
                            function(module) {
                                if (self.debug)
                                    self.debug('...adding', layer, 'to', to);
                                resolve(new module({
                                    debug: self.debug,
                                    understore: store
                                }));
                            });
                    });
                });
            }
            return p;
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

            let p = new Promise(function(resolve) {
                requirejs(
                    [`js/${self.options.store}`],
                    function(module) {
                        let store = new module({
                            debug: self.debug,
                            network_login: () => {
                                return self._network_login(TX.tx("cloud"));
                            }
                        });
                        resolve(store);
                    });
            });

            return p
            .then((store) => self._add_layers("cloud", store))
            .then((store) => {
                // Tell the hoarder to use this store
                self.hoarder.cloud_store(store);

                if (store.option("needs_url")) {
                    if (self.options.url) {
                        store.option("url", self.options.url);
                    } else {
                        return Dialog.confirm("alert", {
                            alert: {
                                severity: "error",
                                message: TX.tx(
                                    "A URL is required for a $1 store",
                                    store.type)
                            }
                        }).then(() => {
                            throw new Serror(400, "No URL given for store");
                        });
                    }
                }
                return store.init()
            })
            .catch((e) => {
                return Dialog.confirm("alert", {
                    title: TX.tx("Warning"),
                    alert: {
                        severity: "warning",
                        message: [
                            TX.tx("Could not open cloud store: $1", e),
                            TX.tx("If you continue, only the local store will be available"),
                        ]
                    }
                });
            });
        }

        /**
         @private
         * This sets up the store but doesn't read anything
         * yet. Initialisation of the client store *may* provide user
         * information, but it will be overridden by any user
         * information coming from the cloud store.
         */
        _2_init_client_store() {
            let self = this;

            let p = Promise.resolve(
                new LocalStorageStore({
                    debug: self.debug
                }));

            return p
            .then((store) => self._add_layers("client", store))
            .then((store) => {
                // Tell the hoarder to use this store
                self.hoarder.client_store(store);
                // Initialisation of the cloud store may have provided
                // initial user information, either from a network login
                // or from a service login. Seed the login dialog with one
                // of them.
                return store.init();
            })
            .then(() => {
                // Need to confirm encryption user/pass, which may have been
                // seeded from the store initialisation process
                this._stage(TX.tx("Authentication"), 2.1);
                let auth_req = self.hoarder.auth_required();
                if (!auth_req)
                    return Promise.resolve();
                
                return Dialog.confirm("login", {
                    title: TX.tx("Client user"),
                    user: auth_req.user
                }).then((info) => {
                    if (self.debug) self.debug("...login confirmed");
                    self.hoarder.authenticate(info);
                });
            })
            .catch((e) => {
                this._stage(TX.tx("Error"), 2.2);
                return Dialog.confirm("alert", {
                    title: TX.tx("Error"),
                    alert: {
                        severity: "error",
                        message: [
                            TX.tx("Could not open client store: $1", e),
                            TX.tx("Unable to continue"),
                        ]
                    }
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
                    title: TX.tx("Local store read failed"),
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
                return promise;
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
                .then((/*actions*/) => {
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
         * @private
         * Perform a text search for a new search expression. The search is done
         * entirely within the DOM.
         */
        _search(s) {
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
                                ` '${s}': ${e}`
                        }
                    });
                    return;
                }

                self.last_search = s;

                $(".search-hit")
                    .removeClass("search-hit");

                $(".tree")
                    .not(".tree-isRoot")
                    .each(function () {
                        let $node = $(this);
                        if ($node.data("key")
                            .match(re) ||
                            ($node.hasClass("tree-isLeaf") &&
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
                    .parents(".tree-isColl")
                    .each(function () {
                        $(this)
                            .tree("open");
                    });
                $(hits[self.picked_hit])
                    .scroll_into_view();
                self.picked_hit = (self.picked_hit + 1) % hits.length;
            }
        }

        _reset_local_store() {
            let self = this;
            
            return self.hoarder.reset_local()
            .then(() => {
                // Reset UI
                self.$DOMtree.tree("destroy");
                self.$DOMtree.tree({});
                let promise = Promise.resolve();
                for (let act of self.hoarder.tree_actions()) {
                    promise = promise.then(self.$DOMtree.tree("action", act));
                }
                $("#sites-node").tree("open");
                
                self._reset_modified();
                $(document).trigger("update_save");
                $(document).trigger("check_alarms");
            });
        }
        
        /**
         * Main entry point for the application, invoked from main.js
         */
        begin() {
            let self = this;

            let lingo = Cookies.get("tx_lang");
            if (!lingo && window && window.navigator)
                lingo = (window.navigator.userLanguage
                         || window.navigator.language);

            if (!lingo)
                lingo = "en";
            
            Translator.instance().language(lingo, document);
            
            this._stage(TX.tx("Loading application"), 0);
            $.styling.init(self.options);

            // Special keys in sort ordering. Currently only works for
            // English.
            // TODO: translation
            let sort_prio = ["User", "Pass", "Email"];

            Tree.debug = this.debug;
            
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

            Tree.playAction = (action, open) => {
                return self.playAction(action, open);
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
                debug: this.debug
            });

            // Load dialogs
            Promise.all(DIALOGS.map((dn) => {
                // Don't wait, let these load in the background
                return Dialog.load(dn);
            }))
            .then(() => {
                if (self.debug) self.debug("All dialogs loaded");
            });

            $("#sites-node button.tree__toggle").icon_button();
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
                        title: TX.tx("Saving"),
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
                            self._reset_modified();
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
                                title: TX.tx("Saving"),
                                alert: ""
                            }).then((progress) => {
                                return self.hoarder.save_cloud(acts, progress)
                            });
                        },
                        reset_local_store: () => {
                            return self._reset_local_store();
                        },
                        set_language: (lingo) => {
                            // Won't apply until we clear caches and restart
                            Cookies.set("tx_lang", lingo, {
                                expires: 365
                            });
                            TX.language(lingo, document);
                        }
                    })
                    .catch((/*f*/) => {
                        if (self.debug) self.debug("extras closed");
                    });
                });

            $("#search_input")
                .on("change", function ( /*evt*/ ) {
                    self._search($(this)
                                .val());
                });

            $("#search_button")
                .icon_button()
                .on(Dialog.tapEvent(), function ( /*evt*/ ) {
                    self._search($("#search_input")
                                .val());
                });

            self.contextMenu = new ContextMenu(self);

            $.styling.reset();

            // Set up event handlers.
            $(document)
            .on("check_alarms", () => {
                self._handle_alarms();
            })
            .on("update_save", () => {
                self._handle_update_save();
            });

            // Promises work through the Javascript event loop, which should
            // get a look in between each step of the following chain.
            this._stage(TX.tx("Initialising cloud store"), 1);
            self._1_init_cloud_store()
            .then(() => {
                this._stage(TX.tx("Initialising local store"), 2);
                return self._2_init_client_store();
            })
            .then(() => {
                this._stage(TX.tx("Reading from local store"), 3);
                return self._3_load_client();
            })
            .then(() => {
                this._stage(TX.tx("Reading from cloud"), 4);
                return self._4_load_cloud();
            })
            .then(() => {
                this._stage(TX.tx("Preparing UI"), 5);
                
                $(window)
                .on("beforeunload", function () {
                    let us = self.hoarder.get_changes(10);
                    if (us.length > 0) {
                        us = TX.tx("You have unsaved changes")
                        + `\n${us.join("\n")}\n`
                        + TX.tx("Are you really sure?");
                        return us;
                    }
                });

                //Initialise translation?
                
                // Ready to rock
                self._reset_modified();
                $("#whoami").text(self.hoarder.user());
                $("#unauthenticated").hide();
                $("#authenticated").show();
                $("#sites-node").tree("open");

                $(document).trigger("update_save");
                $(document).trigger("check_alarms");
            });
        }

        /**
         * Interface to action playing for interactive functions.
         * This will play a single action into the client hoard, and
         * update the UI to reflect that action.
         * @param action the action to play, in Hoard action format
         * @param open boolean to open the node after a N or I
         */
        playAction(action, open) {
            let self = this;
            return self.hoarder.play_action(new Action(action))
            .then((e) => {
                if (self.debug && e.conflict)
                    self.debug("interactive", action,
                               "had conflict", e.conflict);
                return self.$DOMtree.tree("action", e.action, open);
            })
            .then(() => {
                $(document).trigger("update_save");
            })
            .catch((e) => {
                if (self.debug) self.debug("Error", e);
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
