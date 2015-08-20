/**
 * Pages are defined by an id that is the id of a div with data-role=page
 * in the HTML.
 * When a page is needed, it is found using Page_get, which constructs a
 * subclass of Page for it. The subclass may have overrides for the
 * construct and open methods (the subclass methods do NOT need to
 * call the superclass, that's automatic)
 */
var Page_stack = [];
var Pages = {};

/**
 * Change to a different page, with an optional follow-on function
 * invoked when the transition is complete.
 */
function Page_change(page_id, on_open) {
    "use strict";

    var lastpage = $("body").pagecontainer("getActivePage").attr("id");
    console.debug("**** Change from " + lastpage + " to " + page_id);
    if (typeof(on_open) !== "undefined") {
        if (lastpage === page_id) {
            // pagecontainer will not fire a change event if the page
            // isn't actually changing
            on_open.call(this);
        } else {
            // Set up an event to call fn() when the transition is complete
            $("body").pagecontainer().on("pagecontainerchange", function () {
                $("body").pagecontainer().off("pagecontainerchange");
                on_open.call(this);
            });
        }
    }
    // else no follow-on function, simply fire the change

    $("body").pagecontainer("change", $("#" + page_id));
};

/**
 * Get the singleton for a page, given it's id.
 * Construct the page as necessary.
 */
Page_get = function(id) {
    "use strict";

    if (!Pages[id])
        Pages[id] = {};

    if (!Pages[id].singleton) {
        window[id + "Page"] = function() {
            Page.call(this, id);
            if (typeof Pages[id].construct === "function")
                Pages[id].construct.call(this);
        };
        window[id + "Page"].prototype = Object.create(Page.prototype);
        Pages[id].singleton = new window[id + "Page"](id);
    }
    return Pages[id].singleton;
};

/**
 * Options may include handlers as follows:
 * on_cancel: called when the cancel button is clicked
 * on_ok: called when the ok button is clicked
 * on_close: called when the page is closed using the .close()
 * method. The close() action indicates that the page is finished
 * with (for now).
 * All handlers must return true to complete the action, or false
 * to abort it.
 */
function Page(id) {
    "use strict";

    this.id = id;

    var self = this;

    // Generic buttons
    // The .off is required to clear handlers on any previous instance
    // of the page
    self.control("close")
        .off("vclick")
        .on("vclick", function() {
            self.close();
            return true;
        });

    self.control("cancel")
        .off("vclick")
        .on("vclick", function () {
            self.close();
            return true;
        });

    self.control("ok")
        .off("vclick")
        .on("vclick", function () {
            if (typeof this.options.on_ok !== "undefined"
                && !this.options.on_ok.call(self))
                return false; // abort the close
            self.close();
            return true;
        });
}

/**
 * Change to a page. Any of the Page handlers (on_close, on_cancel,
 * on_ok) can be overridden in the options. The additional on_open
 * handler will be called when the page is actually known to be open.
 */
Page.prototype.open = function(options) {
    if (!options)
        options = {};
    if (typeof Pages[this.id].open === "function") {
        Pages[this.id].open.call(this, options);
    }
    console.debug("*** open(" + this.id + ") from "
                  + Page_stack[Page_stack.length - 1]);
    Page_stack.push(this.id)
    this.options = options;
    Page_change(this.id, options.on_open);
};

/**
 * Pop to the last visited page, with an optional pass-on function
 * invoked when the transition is complete
 */
Page.prototype.close = function() {
    "use strict";

    Page_stack.pop();
    var new_page = Page_stack[Page_stack.length - 1];
    console.debug("*** close(" + this.id + ") to " + new_page);
    Page_change(new_page, this.options.on_close);

    this.options = null;
};

/**
 * Shorthand to get a control on this page. For a page with
 * id="P", control("Q") is synonymous with $("#P_Q"). With no parameters,
 * returns the page DIV itself.
 */
Page.prototype.control = function(id) {
    "use strict";

    if (id)
        return $('#' + this.id + "_" + id);
    else
        return $('#' + this.id);
};

/**
 * @private
 */
Page.prototype.play_action = function(action) {
    "use strict";

    var res = Squirrel.client.hoard.record_action(
        action,
        function(e) {
            Tree.action(
                e,
                function() {
                    Utils.sometime("update_save");
                }, true);
        });
    if (res !== null)
        this.squeak(res.message);
};

/**
 * Generate a popup with optional "OK" and "Cancel" buttons
 * @param e message (HTML)
 * @param ok callback on OK button press, or dialog closed
 * when there is no cancel callback
 * @param cancel callback on Cancel press, or dialog closed and there is a
 * cancel callback
 */
Page.prototype.squeak = function(e, ok, cancel) {
    "use strict";

    Page_get("squeak").open({
        message: e,
        on_ok: ok,
        on_cancel: cancel
    });
}
/**
 * options:
 * ok - function called on dialog closed, passing the user and password
 *      and with this set to the options.store
 * user_required - set true if the store requires a username
 * pass_required - set true if the store requires a password
 * store - store we are logging in to
 */
Pages.login = {
    open: function(options) {
        "use strict";

        var self = this;

        self.control("uReq").toggle(options.user_required);
        self.control("pReq").toggle(options.pass_required);

        var $user = self.control("user");
        var $pass = self.control("pass");
        var $signin = self.control("signin");

        var sign_in = function(evt) {
            $signin.off("vclick");
            $user.off("change");
            $pass.off("change");
            self.options.on_close = function() {
                options.on_signin.call(options.store,
                                   $user.val(),
                                   $pass.val());
            };
            self.close();
            return false;
        };

        $signin
            .off("vclick")
            .on("vclick", "p", sign_in);

        $user.off("change").val(options.store.user());
        $pass.off("change").val(options.store.pass());

        if (options.user_required) {
            $user.attr("autofocus", "autofocus");
            if (options.pass_required) {
                $user
                    .off("change")
                    .on("change", function() {
                        $pass.focus();
                    });
            } else {
                $user
                    .off("change")
                    .on("change", sign_in);
            }
        }
        if (options.pass_required) {
            self.control("foruser")
                .toggle(options.store.user() !== null)
                .text(options.store.user() || "");
            $pass.attr("autofocus", "autofocus");
            if (options.user_required) {
                $pass.on("change", function() {
                    $signin.focus();
                });
            } else {
                $pass.on("change", sign_in);
            }
        }
    }
};

Pages.squeak = {
    open: function(options) {
        if (typeof options.message === "string")
            this.control("message").html(options.message);
        else
            this.control("message").empty().append(options.message);
    }
};

Pages.extras = {
    construct: function() {
        var self = this;

        self.control("autosave")
            .on("change", function(e) {
                Squirrel.client.hoard.options.autosave =
                    (self.control("autosave").val() === "on");
                Utils.sometime("update_save");
            });

        self.control("chpw").on("vclick", function() {
            Page_get("ChpwPage").open();
        });

        self.control("chss").on("vclick", function() {
            Page_get("StoreSettingsPage").open();
        });

        self.control("json").on("vclick", function() {
            Page_get("JsonPage").open();
        });

        self.control("about").on("vclick", function() {
            Page_get("AboutPage").open();
        });
    },

    open: function(options) {
        options.on_open = function() {
            if (!(Squirrel.client.store.options.needs_path
                  || Squirrel.client.store.options.needs_image
                  || Squirrel.cloud.store.options.needs_path
                  || Squirrel.cloud.store.options.needs_image)) {
                this.control("chss").hide();
            }
            this.control("autosave").val(
                Squirrel.client.hoard.options.autosave ? "on" : "off");
        };
    }
};

/**
 * Master password change dialog
 */
Pages.chpw = {
    construct: function() {
        "use strict";

        Page.call(this, "chpw");

        var self = this;

        self.control("show")
            .on("change", function() {
                if (self.control("show").prop("checked")) {
                    self.control("pass").attr("type", "text");
                    self.control("conf").attr("type", "text");
                } else {
                    self.control("pass").attr("type", "password");
                    self.control("conf").attr("type", "password");
                }
            });
    },

    open: function(options) {
        "use strict";

        var self = this;
        options.on_ok = function() {
            var p = self.control("pass").val(),
            c = self.control("conf").val();
            if (p !== c) {
                this.squeak("Passwords do not match");
                return false;
            }
            Squirrel.client.store.pass(p);
            Squirrel.client.status = Squirrel.NEW_SETTINGS;
            Squirrel.cloud.store.pass(p);
            Squirrel.cloud.status = Squirrel.NEW_SETTINGS;
            Utils.sometime("update_save");

            return true;
        };
    }
};

Pages.store_settings = {
    construct: function() {
        var self = this;
        this.control("file")
            .hide()
            .on("vclick", function (e) {
                Pages.store_settings.ss_change_image.call(self);
            });

        this.control("choose")
            .on("vclick", function(e) {
                self.control("file").trigger("change", e);
            });

        this.on_open = function() {
            this.control("message").empty();
        };
    },

    open: function(options) {
        var self = this;

        if (Squirrel.cloud.store.options.needs_image
            || Squirrel.client.store.options.needs_image) {

            // Show the "change image" controls
            this.control("image").show();
        }

        if (Squirrel.cloud.store.options.needs_path
            || Squirrel.client.store.options.needs_path) {

            this.control("storepath").val(
                Squirrel.client.hoard.options.store_path);

            options.on_ok = function(e) {
                if (self.control("storepath").val() === "") {
                    self.control("message").text(TX.tx(
                        "Store path may not be empty"));
                    return false;
                }                
                if (Squirrel.client.hoard.options.store_path !==
                    self.control("storepath").val()) {
                    Squirrel.client.hoard.options.store_path =
                        self.control("storepath").val();
                    if (Squirrel.client.status === Squirrel.IS_LOADED)
                        Squirrel.client.status = Squirrel.NEW_SETTINGS;
                    if (Squirrel.cloud.status === Squirrel.IS_LOADED)
                        Squirrel.cloud.status = Squirrel.NEW_SETTINGS;
                }
                return true;
            };

            // Show the "change path" controls
            self.control("path").show();
        }
    },

    /* Helper */
    ss_change_image: function() {
        "use strict";

        var fail = function(e) {
            $("#store_settings_message").text(TX.tx(
                "Cannot use this image because of this error: $1", e));
        };
        $("#store_settings_ok").attr("disabled", true);
        var file = $(this)[0].files[0];
        Utils.read_file(
            file,
            function(data) {
                data = "data:" + file.type + ";base64,"
                    + Utils.ArrayBufferToBase64(data);
                if (data !== $("#stegamage").attr("src", data)) {
                    $("#stegamage")
                        .attr("src", data)
                        .off("load")
                        .on("load", function() {
                            $(this).off("load");
                            // Check that we can use the image.
                            var steg = new Steganographer(this);
                            try {
                                steg.inject("tada");
                            } catch (e) {
                                if (DEBUG) console.debug("Caught " + e);
                                fail(e);
                                return;
                            }
                            $("#store_settings #ok").attr("disabled", false);
                            var h = this.naturalHeight;
                            var w = this.naturalWidth;
                            this.height = 100;
                            $("#store_settings_message")
                                .html("<br>" + w + " x " + h);
                            if (Squirrel.client.status === Squirrel.IS_LOADED)
                                Squirrel.client.status = Squirrel.NEW_SETTINGS;
                            if (Squirrel.cloud.status === Squirrel.IS_LOADED)
                                Squirrel.cloud.status = Squirrel.NEW_SETTINGS;
                            Utils.sometime("update_save");
                        });
                }
            },
            fail,
            "arraybuffer");
    }
};

Pages.json = {
    construct: function() {
        var self = this;

        self.control("text")
            .on("input", function () {
                self.control("load").prop("disabled", false);
            });
    },

    open: function(options) {

        options.on_open = function() {
            var data = Squirrel.client.hoard.cache;
            if (data)
                data = data.data;
            this.control("text")
                .text(JSON.stringify(data))
                .select();
            this.control("load").prop("disabled", true);
        };

        options.on_ok = function () {
            var data;
            try {
                data = JSON.parse(this.control("text").val());
            } catch (e) {
                Page.prototype.squeak(TX.tx(
                    "JSON could not be parsed") + ": " + e);
                return false;
            }
            this.control("load").prop("disabled", true);
            if (DEBUG) console.debug("Importing...");
            Squirrel.insert_data([], data);
            return true;
        };
    }
};

Pages.menu = {
    construct: function() {
        self = this;
        this.control("pick").on("vclick", function() {
            var opts = $.extend({}, self.options);
            self.close();
            Page_get("pick").open(opts);
        });
        this.control("add_alarm").on("vclick", function() {
            var opts = $.extend({}, self.options);
            self.close();
            Page_get("alarm").open(opts);
        });
        this.control("rename").on("vclick", function() {
            var $node = self.options.node;
            self.close();
            Squirrel.edit_node($node, "key");
        });
        this.control("edit").on("vclick", function() {
            var $node = self.options.node;
            self.close();
            Squirrel.edit_node($node, "value");
        });
        this.control("randomise").on("vclick", function() {
            var opts = $.extend({}, self.options);
            self.close();
            Page_get("randomise").open(opts);
        });
        this.control("add_value").on("vclick", function() {
            var opts = $.extend({}, self.options);
            self.close();
            Page_get("add_value").open(opts);
        });
        this.control("add_subtree").on("vclick", function() {
            var opts = $.extend({}, self.options);
            self.close();
            Page_get("add_subtree").open(opts);
        });
        this.control("delete_node").on("vclick", function() {
            var opts = $.extend({}, self.options);
            self.close();
            Page_get("delete_node").open(opts);
        });
    },

    open: function(options) {
        this.control("nav").text(options.path.join("/"));
        $("#menu").find(".leaf_only").toggle(options.is_leaf);
        $("#menu").find(".collection_only").toggle(!options.is_leaf);
    }
};

/**
 * Confirm deletion of a node
 */
Pages.delete_node = {
    open: function(options) {
        options.on_ok = function(options) {
            var res = Squirrel.client.hoard.record_action(
                {
                    type: "D",
                    path: this.options.path
                },
                function(e) {
                    Tree.action(
                        e,
                        function() {
                            Utils.sometime("update_save");
                            Utils.sometime("update_tree");
                        }, true);
                });
            if (res !== null)
                this.squeak(res.message);
            return false;
        };

        this.control("path").text(options.path.join("/"));
        this.control("coll").toggle(!options.is_leaf);
    }
};

/**
 * Password generation for the given leaf node
 */
Pages.randomise = {
    construct: function() {
        var self = this;
        this.generator_options = {
            length: this.control("len").val(),
            charset: this.control("chs").val()
        };

        this.control("again")
            .on("vclick", function() {
                self.generator_options.length = self.control("len").val();
                self.generator_options.charset = self.control("chs").val();
                self.control("idea").text(Utils.generate_password(
                    self.generator_options));
                return false;
            });
    },

    open: function(options) {
        this.control("path").text(options.path.join("/"));
        this.control("key").text(
            options.node.find(".key:first").text());
        this.control("idea").text(Utils.generate_password(
            this.generator_options));

        options.on_ok = function() {
            var pw = this.control("idea").text();
            var old_path = this.options.path;
            this.play_action(
                { type: "E",
                  path: old_path,
                  data: pw });
            this.close();
            return true;
        };
    }
};

Pages.pick = {
    construct: function() {
        var self = this;
        this.control("clear")
            .on("vclick", function() {
                self.control().find(".picked").removeClass("picked");
            });
    },

    open: function(options) {

        var self = this;
        var val = options.node.find(".value:first").text();
        var $which = this.control("which");
        var $from = this.control("from");
        var i, $f;

        this.control().find("pick_cell").remove();

        var item_clicked = function() {
            var ii = $(this).data("i");
            self.control()
                .find("td.i" + ii)
                .addClass("picked");
        };

        for (i = 0; i < val.length; i++) {
            $f = $from.children("td.i" + i);
            if ($f.length === 0) {
                $("<td></td>")
                    .data("i", i)
                    .addClass("pick_cell i" + i)
                    .text(i + 1)
                    .on("vclick", item_clicked)
                    .appendTo($which);
                $f = $("<td></td>")
                    .data("i", i)
                    .addClass("pick_cell i" + i)
                    .on("vclick", item_clicked)
                    .appendTo($from);
            }
            $f.text(val.charAt(i));
        }

        while (i < $from.children("td").length) {
            $from.children("td").last().remove();
            i++;
        }

        this.control().find(".picked").removeClass("picked");
    }
};

const units_days = {
    d: 1,
    w: 7,
    m: 30,
    y: 365
};
const ms_in_day = 24 * 60 * 60 * 1000;

/**
 * Reminder setting dialog
 */
Page.alarm = {

    construct: function() {
        this.update_next = function() {
            var numb = self.control("number").val()
                * units_days[self.control("units").val()];
            var elapsed = Math.round(
                (Date.now() - self.options.node.data("last-time")) / ms_in_day);
            if (elapsed < numb)
                numb -= elapsed;
            var uns = "d";
            if (numb % units_days.y === 0) {
                numb /= units_days.y; uns = "y";
            } else if (numb % units_days.m === 0) {
                numb /= units_days.m; uns = "m";
            } else if (numb % units_days.w === 0) {
                numb /= units_days.w; uns = "w";
            }
            self.control("next").text(numb);
            self.control().find(".alarm_next").hide();
            self.control.find(".alarm_next." + uns).show();
        };
        this.control("units")
            .on("change", this.update_next);

        this.control("number")
            .spinner({
                min: 1
            })
            .on("change", this.update_next);
   },
    
    open: function(options) {
        var self = this;
        var $node = this.options.node;
        var $alarm = $node.children(".alarm");
        var path = this.options.path;
        var number = 6;
        var units = "m";

        if ($alarm.length > 0) {
            number = $alarm.data("alarm");
            if (number % units_days.y === 0) {
                number /= units_days.y; units = "y";
            } else if (number % units_days.m === 0) {
                number /= units_days.m; units = "m";
            } else if (number % units_days.w === 0) {
                number /= units_days.w; units = "w";
            } else
                units = "d";
        }

        this.control("number").val(number);
        this.control("units").val(units);

        options.on_ok = function() {
            var numb = self.control("number").val()
                * units_days[self.control("units").val()];

            self.play_action(
                { type: "A",
                  path: self.options.path,
                  data: numb
                });
            self.close();
            return false;
        };

        options.on_cancel = function() {
            if ($alarm) {
                self.play_action(
                    { type: "C",
                      path: self.options.path
                    });
            }
            self.close();
            return false;
        };

        this.update_next();
    }
};


