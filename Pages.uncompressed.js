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

    $("body").pagecontainer("change", $("#" + page_id), {
        transition: "fade",
        changeHash: false
    });
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

    self.control("close")
        .on("vclick", function() {
            if (typeof self.options.on_close !== "undefined"
                && !self.options.on_close.call(self))
                return false; // abort the close
            self.close();
            return true;
        });

    self.control("cancel")
        .on("vclick", function () {
            if (typeof self.options.on_cancel !== "undefined"
                && !self.options.on_cancel.call(self))
                return false; // abort the close
            self.close();
            return true;
        });

    self.control("ok")
        .on("vclick", function () {
            if (typeof self.options.on_ok !== "undefined"
                && !self.options.on_ok.call(self))
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
if (!this.options)
    debugger;
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
        Page_get("activity").open({
            title: TX.tx("Error"),
            message: res.message
        });
};

Pages.activity = {
    open: function(options) {
        this.control("title").text(options.title ? options.title : "");
        this.control("cancel").toggle(typeof options.on_cancel === "function");
        this.control("ok").toggle(typeof options.on_ok === "function");
        this.control("close").toggle(
            !(typeof options.on_ok === "function"
              || typeof options.on_cancel === "function"));

        this.control("message").empty();
        if (typeof options.message === "string")
            this.control("message").html(options.message);
        else
            this.control("message").empty().append(options.message);
    }
};

Pages.authenticated = {
    construct: function() {
        this.control("search")
            .on("change", function(/*evt*/) {
                Squirrel.search($(this).val());
            });
        this.control("save")
            .hide()
            .on("vclick", function(/*evt*/) {
                Squirrel.save_hoards();
                return false;
            });

        this.control("undo")
            .hide()
            .on("vclick", function(/*evt*/) {
                Tree.undo(function(mess) {
                    Page_get("activity").open({
                        title: "Undo",
                        message: mess
                    });
                });
                return false;
            });

    this.control("extras")
        .on("vclick", function(/*evt*/) {
            Page_get("extras").open();
        });
    },

    open: function(options) {
        this.control("whoami").text(Squirrel.client.store.user());
    }
};

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
            Page_get("chpw").open();
        });

        self.control("chss").on("vclick", function() {
            Page_get("store_settings").open();
        });

        self.control("json").on("vclick", function() {
            Page_get("json").open();
        });

        self.control("about").on("vclick", function() {
            Page_get("about").open();
        });
    },

    open: function(options) {
        if (!(USE_STEGANOGRAPHY
              || Squirrel.cloud.store.options().needs_path)) {
            this.control("chss").hide();
        }
        this.control("autosave").val(
            Squirrel.client.hoard.options.autosave ? "on" : "off");
    }
};

/**
 * Master password change dialog
 */
Pages.chpw = {
    construct: function() {
        "use strict";

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
        this.validate = function() {
            var p = self.control("pass").val(),
            c = self.control("conf").val();

            self.control("nomatch").toggle(p != c);
            return (p == c);
        };
        self.control("conf").on("change", this.validate);
    },

    open: function(options) {
        "use strict";

        this.validate();

        var self = this;

        options.on_ok = function() {
            if (!self.validate)
                return false;
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
        if (USE_STEGANOGRAPHY) {
            this.control("file")
                .hide()
                .on("vclick", function (e) {
                    Pages.store_settings.ss_change_image.call(self);
                });

            this.control("choose_image")
                .on("vclick", function(e) {
                    self.control("file").trigger("change", e);
                });
        }
    },

    open: function(options) {
        var self = this;

        this.control("message").empty();

        if (Squirrel.cloud.store.options().needs_path) {

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

        } else
            self.control("path").hide();
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

        var data = Squirrel.client.hoard.cache;
        if (data)
            data = data.data;
        this.control("text")
            .text(JSON.stringify(data))
            .select();
        this.control("ok").prop("disabled", true);

        options.on_ok = function () {
            var data;
            try {
                data = JSON.parse(this.control("text").val());
            } catch (e) {
                Page_get("activity").open({
                    title: TX.tx("JSON could not be parsed"),
                    message: e
                });
                return false;
            }
            this.control("ok").prop("disabled", true);
            if (DEBUG) console.debug("Importing...");
            Squirrel.insert_data([], data);
            return true;
        };
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
            if (res !== null) {
                Page_get("activity").open({
                    title: TX.tx("Error"),
                    message: res.message
                });
                return false;
            }
            return true;
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

const units_days = [
    'y', 365,
    'm', 30,
    'w', 7,
    'd', 1
];

const ms_in_day = 24 * 60 * 60 * 1000;

/**
 * Reminder setting dialog
 */
Pages.alarm = {

    construct: function() {
        var self = this;
        this.update_next = function() {
            var numb = self.control("number").val();
            if (numb !== "") {
                self.control("set").hide();
                return;
            }
            self.control("set").show();
            numb = numb * units_days[self.control("units").val()];
            var elapsed = Math.round(
                (Date.now() - self.options.node.data("last-time")) / ms_in_day);
            if (elapsed < numb)
                numb -= elapsed;
            self.control().find(".alarm_next").hide();
            for (var i = 0; i < units_days.length; i += 2) {
                var uns = units_days[i];
                var n = units_days[i + 1];
                var v = Math.round(numb / n);
                if (v !== 0) {
                    numb = numb % n;
                    self.control().find(".alarm_next." + uns)
                        .val(v)
                        .show();
                }
            }
        };

        this.control("units")
            .on("change", this.update_next);

        this.control("number")
            .on("change", this.update_next);
   },
    
    open: function(options) {
        var $node = options.node;
        var $alarm = $node.children(".alarm");
        var number = 6;
        var units = "m";

        if ($alarm.length > 0) {
            number = $alarm.data("alarm");
            for (var i = 0; i < units_days.length; i += 2) {
                var uns = units_days[i];
                var n = units_days[i + 1];
                var v = Math.round(number / n);
                if (v === 0) {
                    number /= n;
                    units = uns;
                    break;
                }
            }
        }

        this.control("number").val(number);
        this.control("units").val(units);

        var self = this;
        options.on_ok = function() {
            var numb = self.control("number").val()
                * units_days[self.control("units").val()];
            self.play_action(
                { type: "A",
                  path: this.options.path,
                  data: numb
                });
            self.close();
            return false;
        };

        options.on_cancel = function() {
            if ($alarm) {
                self.play_action(
                    { type: "C",
                      path: this.options.path
                    });
            }
            self.close();
            return false;
        };

        this.update_next();
    }
};
