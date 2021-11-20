/*@preserve Copyright (C) 2015-2019 Crawford Currie http://c-dot.co.uk license MIT*/
/* eslint-env browser,jquery */

define("js/Squirrel", [
	'js/Serror', 'js/Utils', "js/Dialog", "js/Action", "js/Hoarder",
	"js/Hoard", "js/LocalStorageStore", "js/Translator", "js/Tree",
	"js-cookie", "js/ContextMenu", "js/jq/simulated_password",
	"js/jq/scroll_into_view", "js/jq/icon_button", "js/jq/styling",
	"js/jq/template", "js/jq/twisted"
], (
	Serror, Utils, Dialog, Action, Hoarder,
	Hoard, LocalStorageStore, Translator, Tree,
	Cookies, ContextMenu
) => {

	const TX = Translator.instance();

    // Dialogs for loading in the background. These are loaded in roughly
    // the order they are likely to be used, but the loads are supposed to
    // be asynchronous so the order shouldn't really matter.
    const DIALOGS = [ "alert", "login", "alarm", "store_settings",
                      "choose_changes", "insert", "pick", "add",
                      "delete", "randomise", "extras", "about",
                      "optimise" ];

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
    class Squirrel {

        /**
         * @param {object} options initialisation
         * @param {boolean} options.debug - boolean
         * @param {string} options.store - string name of the cloud store type
         * @param {string} options.url - store URL, if it requires one
         */
        constructor(options) {
            this.options = options || {};

            if (this.options.debug) {
                this.debug = console.debug;
                this.debug("Debug enabled");
            }

            this.hoarder = new Hoarder({debug: this.debug});

            /**
			 * Pointer to tree widget at root of DOM tree
			 * @member {jQuery}
			 */
            this.$DOMtree = null;

			/**
			 * Last thing searched for
			 * @member {string}
			 */
            this.last_search = "";

			/**
			 * Index of last search hit being displayed
			 * @member {number}
			 */
            this.picked_hit = 0;
        }

        /**
         * Report current stage of startup process
         * @private
         */
        _stage(s, step) {
            if (this.debug) this.debug(`${step}: ${s}`);
            $("#stage").text(s);
        }
        
        /**
         * Event handler code for "check_alarms" event
         * @private
         */
        _handle_alarms( /* event */ ) {
            const lerts = [];

            this.hoarder.check_alarms(
                (path, expired) => {
                    const $node = this.$DOMtree.tree("getNodeFromPath", path);
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
                    Dialog.confirm("alert", {
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
            this.hoarder.save_stores({
                progress: progress,
                selector: actions => Dialog.confirm("choose_changes", {
                    changes: actions
                }),
                uiPlayer: act => this.$DOMtree.tree("action", act)
			})
            .then(saved => {
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
         * Event handler for "update_save" event
         * @private
         */
        _handle_update_save( /*event*/ ) {
            if (this.hoarder.can_undo())
                $("#undo_button")
            .show().attr("title", this.hoarder.next_undo());
            else
                $("#undo_button").hide();
            const $sb = $("#save_button");
            const autosave = (Cookies.get("ui_autosave") === "on");
            const us = this.hoarder.get_changes(10);

            if (us.length === 0)
                $sb.hide(); // nothing to save
            else if (autosave) {
                $sb.hide();
                this._save_stores();
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
         * @private
         */
        _reset_modified() {
            // Reset the UI modification list
            $(".tree-isModified").removeClass("tree-isModified");
            
            // Re-mark all the nodes mentioned in the pending
            // actions list as modified. If a node isn't found,
            // back up the tree until we find a parent that does
            // exist and mark it.
            const paths = {};

            // Add a path to the modified paths tree
            const add = (path, offset, node) => {
                if (offset === path.length)
                    return;
                if (!node[path[offset]])
                    node[path[offset]] = {};
                add(path, offset + 1, node[path[offset]]);
            };

            // Walk the modified paths tree, marking modified nodes
            const mark = (path, node) => {
                if (Object.keys(node).length === 0) {
                    while (path.length > 0 && this.hoarder.node_exists(path)) {
                        const $node = this.$DOMtree.tree("getNodeFromPath", path);
                        if ($node) {
                            $node.addClass("tree-isModified");
                            // return here to  only leaf nodes
							//return;
                        }
                        path.pop(); // mark parent
                    }
                } else {
                    for (let sn in node)
                        mark(path.concat(sn), node[sn]);
                }
            };

            for (let record of this.hoarder.get_unsaved_actions()) {
                add(record.redo.path, 0, paths);
                add(record.undo.path, 0, paths);
            }

            mark([], paths);
        }

        /**
         * 401 network login handler. Normally a 401 will be handled by
         * the browser. This is a "just in case".
         * @param domain what we are logging in to (cloud or client)
         * @private
         */
        _network_login(domain) {
            if (this.debug) this.debug(domain, "network login");

            return Dialog.confirm("login", {
                title: TX.tx("Network login for $1", domain),
                // Copy default user from the stores if there
                user: this.hoarder.probableUser()
            });
        }

        _add_layers(to, store) {
            let p = Promise.resolve(store);
            
            for (let algo of this.options.use) {
                if (algo.length === 0)
                    continue;
                const layer = algo.replace(/^([a-z])/, m => m.toUpperCase())
                      + "Layer";

                p = p.then(
					store => Utils.require(`js/${layer}`)
					.then(module => {
                        if (this.debug)
                            this.debug(`...adding ${layer} to ${to}`);
                        return new module({
                            debug: this.debug,
                            understore: store
                        });
					}));
            }
            return p;
        }
        
        /**
         * Initialisation of the cloud store *may* provide user
         * information - for example, initialisation of a
         * GoogleDriveStore will require a google login to a specific
         * user. We leverage this to get initial user information
         * which can be used in determining the encryption user for
         * the client store.
         * @private
         */
        _1_init_cloud_store() {
            return Utils.require(`js/${this.options.store}`)
			.then(module => new module({
                debug: this.debug,
                network_login: () =>
                this._network_login(TX.tx("cloud"))
			}))
            .then(store => this._add_layers("cloud", store))
            .then(store => {
                // Tell the hoarder to use this store
                this.hoarder.cloud_store(store);

                if (store.option("needs_url")) {
                    if (this.options.url) {
                        store.option("url", this.options.url);
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
                return store.init();
            })
            .catch(e => Dialog.confirm("alert", {
                title: TX.tx("Warning"),
                alert: {
                    severity: "warning",
                    message: [
                        TX.tx("Could not open cloud store: $1", e),
                        TX.tx("If you continue, only the local store will be available"),
                    ]
                }
            }));
        }

        /**
         * This sets up the store but doesn't read anything
         * yet. Initialisation of the client store *may* provide user
         * information, but it will be overridden by any user
         * information coming from the cloud store.
         * @private
         */
        _2_init_client_store() {
            return this._add_layers("client", new LocalStorageStore({
                debug: this.debug
            }))
            .then(store => {
                // Tell the hoarder to use this store
                this.hoarder.client_store(store);
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
                const auth_req = this.hoarder.auth_required();
                if (!auth_req)
                    return Promise.resolve();
                
                return Dialog.confirm("login", {
                    title: TX.tx("Client user"),
                    user: auth_req.user
                }).then(info => {
                    if (this.debug) this.debug("...login confirmed");
                    this.hoarder.authenticate(info);
                });
            })
            .catch(e => {
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
         * Once the stores have been initialised, we can load the
         * client. This will give us the client hoard and the location
         * of the cloud hoard, so we can then load and merge the cloud
         * hoard.
         * @private
         */
        _3_load_client() {
            
            return this.hoarder.load_client()
            .catch(lerts => Dialog.confirm("alert", {
                title: TX.tx("Local store read failed"),
                alert: lerts
			}))
			.then(async () => {
                // Add steganography image, if required
                if (this.hoarder.needs_image()) {
                    const $img = $("<img id='stegamage' src='"
                                   + this.hoarder.image_url() + "'>");
                    $img.hide();
                    $("body").append($img);
                }
                // Load the tree into the UI by replaying actions
				// sequentially
                for (let act of this.hoarder.action_stream()) {
                    await this.$DOMtree.tree("action", act);
                }
                return Promise.resolve();
            });
        }

        /**
         * Called when we have a client hoard.
         * Synch it from the cloud.
         * @private
         */
        _4_load_cloud() {
            const cloud_store = this.hoarder.cloud_store();

            if (!cloud_store)
                return Promise.resolve(false);

            let p;

            // Make sure we have a cloud path. The client
            // store records the path, which is used to load
            // the cloud store/
            const clop = this.hoarder.cloud_path();
            if (typeof clop === 'string' && clop !== "")
                p = Promise.resolve();
            else {
                // Use the store_settings dlg to initialise the cloud store
                // path and optional steganography image
                p = Dialog.confirm("store_settings", {
                    cloud_path: path => 
                    this.hoarder.cloud_path(path),
                    needs_image: this.hoarder.needs_image(),
                    image_url: path => {
                        path = this.hoarder.image_url(path);
                        $("#stegamage").attr("src", path);
                        return path;
                    }
                })
                .then(paths => {
                    this.hoarder.cloud_path(paths.cloud_path);
                    this.hoarder.image_url(paths.image_url);
                    $(document).trigger("update_save");
                });
            }

			// Load the action stream from the cloud
            return p.then(() => this.hoarder.load_cloud())
            .then(actions => {
                const conflicts = [];

                // Merge updates from cloud hoard to client
                return this.hoarder.update_from_cloud({
                    progress: conflicts,
                    selector: actions => Dialog.confirm("choose_changes", {
                        changes: actions
                    }),
                    uiPlayer: act => this.$DOMtree.tree("action", act),
                    actions: actions
				})

                .then(() => {
                    if (conflicts.length === 0)
						return Promise.resolve();

                    return Dialog.confirm("alert", {
                        title: TX.tx("Conflicts"),
                        alert: conflicts
                    });
                });
            })
            .catch(e => {
                if (this.debug) this.debug(e);
                const mess = [];
                mess.push({
                    severity: "error",
                    message: TX.tx("Could not load cloud store '$1'",
                                   this.hoarder.cloud_path())
                });
                if (e instanceof Serror && e.status === 404) {
                    // Could not contact cloud; continue all the same
                    if (this.debug) this.debug(
                        this.hoarder.cloud_path(), "not found in the cloud");
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
         * Perform a text search for a new search expression. The search is done
         * entirely within the DOM.
         * @private
         */
        _search(s) {
            let hits;
            $(".picked-hit")
            .removeClass("picked-hit");
            if (s !== this.last_search) {
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

                this.last_search = s;

                $(".search-hit")
                .removeClass("search-hit");

                $(".tree")
                .not(".tree-isRoot")
                .each(function() {
                    const $node = $(this);
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

                this.picked_hit = 0;
            }

            hits = hits || $(".search-hit");
            if (this.picked_hit < hits.length) {
                $("#search_hits")
                .text(TX.tx(
                    "$1 of $2 found", this.picked_hit + 1, hits.length));
                $(hits[this.picked_hit])
                .addClass("picked-hit")
                .parents(".tree")
                .each(function() {
                    $(this)
                    .tree("open");
                });
                $(hits[this.picked_hit])
                .scroll_into_view();
                this.picked_hit = (this.picked_hit + 1) % hits.length;
            }
        }

        _reset_local_store() {           
            return this.hoarder.reset_local()
            .then(async () => {
                // Reset UI
                this.$DOMtree.tree("destroy");
                this.$DOMtree.tree({});
                let promise = Promise.resolve();
                for (let act of this.hoarder.tree_actions()) {
                    await this.$DOMtree.tree("action", act);
                }
                $("#sites-node").tree("open");
                
                this._reset_modified();
                $(document).trigger("update_save");
                $(document).trigger("check_alarms");
            });
        }

        nodeContents(path) {
			return this.hoarder.nodeContents(path);
		}

        /**
         * Main entry point for the application, invoked from main.js
         */
        begin() {
            let lingo = Cookies.get("ui_lang");
            if (!lingo && window && window.navigator)
                lingo = (window.navigator.userLanguage
                         || window.navigator.language);

            if (!lingo)
                lingo = "en";
            
            Translator.instance().language(lingo, document);
            
            this._stage(TX.tx("Loading application"), 0);
            $.styling.init({ debug: this.debug});

            // Special keys in sort ordering. Currently only works for
            // English.
            // TODO: translation
            const sort_prio = ["User", "Pass", "Email"];

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

            Tree.treePlayAction = (action, open) => {
				Serror.assert(action instanceof Action);
                return this.appPlayAction(action, open);
            };
            
            Tree.onTitleHoverIn = () => {
                $("body").contextmenu("close"); return false;
            };
            
            Tree.onTitleHoverOut = () => $("body").contextmenu("isOpen");
            
            Tree.hidingValues = tf => {
                if (typeof tf !== 'undefined') {
                    Cookies.set(
						"ui_hidevalues", tf ? "on" : null, {
							expires: 365,
							sameSite: "strict"
						});
                }
                return (Cookies.get("ui_hidevalues") === "on");
            };
            
            Tree.showingChanges = tf => {
                if (typeof tf !== 'undefined') {
                    Cookies.set("ui_showchanges", tf ? "on" : null, {
						expires: 365,
						sameSite: "strict"
					});
                }
                return (Cookies.get("ui_showchanges") === "on");
            };

            this.$DOMtree = $("#sites-node");
            this.$DOMtree.tree({});

            // Set options for squirrel dialogs
            Dialog.set_default_options({
                autoOpen: false,
                app: this,
                debug: this.debug
            });

            // Load dialogs
            Promise.all(DIALOGS.map(
                // Don't wait, let these load in the background
				dn => Dialog.load(dn)))
			.then(() => {
                if (this.debug) this.debug("All dialogs loaded");
            });

            $("#sites-node button.tree_t_toggle").icon_button();
            $("#help_button")
            .icon_button()
            .on(Dialog.tapEvent(), function() {
                const url = requirejs.toUrl("help.html");
                $(this).closest("a").attr("href", url);
				// Allow event to bubble
                return true;
            });

            $("#save_button")
            .icon_button()
            .hide()
            .on(Dialog.tapEvent(), ( /*evt*/ ) => {
                Dialog.open("alert", {
                    title: TX.tx("Saving"),
                    alert: ""
                }).then(progress => this._save_stores(progress));
                return false;
            });

            $("#undo_button")
            .icon_button()
            .hide()
            .on(Dialog.tapEvent(), () => {
                this.hoarder.undo(
					{
						uiPlayer: act => {
							return this.$DOMtree.tree("action", act)
							.then(() => {
								this._reset_modified();
								$(document).trigger("update_save");
							});
						}
					})
                .catch(e => {
                    if (this.debug) this.debug("undo failed", e);
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
            .on(Dialog.tapEvent(), () => {
                Dialog.confirm("extras", {
                    needs_image: this.hoarder.needs_image(),
                    image_url: path => {
                        path = this.hoarder.image_url(path);
                        $(document).trigger("update_save");
                        return path;
                    },
                    cloud_path: path => {
                        path = this.hoarder.cloud_path(path);
                        $(document).trigger("update_save");
                        return path;
                    },
                    encryption_pass: pass => {
                        pass = this.hoarder.encryption_pass(pass);
                        $(document).trigger("update_save");
                        return pass;
                    },
                    tree_json: json => {
                        json = this.hoarder.JSON();
                        $(document).trigger("update_save");
                        return json;
                    },
                    analyse: () => this.hoarder.analyse(),
                    optimise: () => {
                        const acts = this.hoarder.tree_actions();
                        return Dialog.open("alert", {
                            title: TX.tx("Saving"),
                            alert: ""
                        }).then(progress => 
								this.hoarder.save_cloud(acts, progress));
                    },
                    reset_local_store: () => {
                        return this._reset_local_store();
                    },
                    set_language: lingo => {
                        // Won't apply until we clear caches and restart
                        Cookies.set("ui_lang", lingo, {
                            expires: 365,
							sameSite: "strict"
                        });
                        TX.language(lingo, document);
                    }
                })
                .catch((/*f*/) => {
                });
            });

            $("#search_input")
            .on("change", () => this._search($("#search_input").val()));

            $("#search_button")
            .icon_button()
            .on(Dialog.tapEvent(),
				() => this._search($("#search_input").val()));

            this.contextMenu = new ContextMenu(this);

            // Set up event handlers.
            $(document)
            .on("check_alarms", () => this._handle_alarms())
            .on("update_save", () => this._handle_update_save());

            // Promises work through the Javascript event loop, which should
            // get a look in between each step of the following chain.
            this._stage(TX.tx("Initialising cloud store"), 1);
            this._1_init_cloud_store()
            .then(() => {
                this._stage(TX.tx("Initialising local store"), 2);
                return this._2_init_client_store();
            })
            .then(() => {
                this._stage(TX.tx("Reading from local store"), 3);
                return this._3_load_client();
            })
            .then(() => {
                this._stage(TX.tx("Reading from cloud"), 4);
                return this._4_load_cloud();
            })
            .then(() => {
                this._stage(TX.tx("Preparing UI"), 5);
                
                $(window)
                .on("beforeunload", () => {
                    let us = this.hoarder.get_changes(10);
                    if (us.length > 0) {
                        us = TX.tx("You have unsaved changes")
                        + `\n${us.join("\n")}\n`
                        + TX.tx("Are you really sure?");
                        return us;
                    }
					return undefined;
                });

                //Initialise translation?
                
                // Ready to rock
                this._reset_modified();
                $("#whoami").text(this.hoarder.user());
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
         * @param {Action} action the action to play, in Hoard action format
         * @param {boolean} open to open the node after a N or I
		 * @return {Promise} Promise to play the action.
         */
        appPlayAction(action, open) {
			Serror.assert(action instanceof Action);
            return this.hoarder.play_action(
				action,
				{
					undoable: true,
					uiPlayer: act => this.$DOMtree.tree("action", act, open)
					.then(() => {
						//if (this.debug && pr.conflict)
						//	this.debug("interactive", action,
						//			   "had conflict", pr.conflict);
						$(document).trigger("update_save");
					})
				})
			.catch(e => Dialog.confirm("alert", {
				title: TX.tx("Error"),
				alert: {
					severity: "error",
					message: e.message
				}}));
		}
    }

    return Squirrel;
});
