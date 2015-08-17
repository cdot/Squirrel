var Pages = {
    stack: []
};

/**
 * Change to a different page, with an optional follow-on function
 * invoked when the transition is complete.
 */
Pages.change_page = function(page_id, fn) {
    var lastpage = $("body").pagecontainer("getActivePage").attr("id");
    console.debug("**** Change from " + lastpage + " to " + page_id);
    if (typeof(fn) !== "undefined") {
        if (lastpage === page_id) {
            // pagecontainer will not fire a change event if the page
            // isn't actually changing
            fn.call(this);
        } else {
            // Set up an event to call fn() when the transition is complete
            $("body").pagecontainer().on("pagecontainerchange", function () {
                $("body").pagecontainer().off("pagecontainerchange");
                fn.call(this);
            });
        }
    }
    // else no follow-on function, simply fire the change

    $("body").pagecontainer("change", $("#" + page_id));
};

function Page(id) {
    "use strict";

    this.id = id;
    this.on_open = [];
    this.on_close = [];

    var self = this;

    // Generic buttons
    // The .off is required to clear handlers on any previous instance
    // of the page
    self.control("close")
        .off("vclick")
        .on("vclick", function() {
            self.close();
        });

    self.control("cancel")
        .off("vclick")
        .on("vclick", function () {
            self.close();
        });

    this.on_ok = [];
    self.control("ok")
        .off("vclick")
        .on("vclick", function () {
            for (var i = 0; i < self.on_ok.length; i++) {
                if (!self.on_ok[i].call(self))
                    return false; // abort the close
            }
            self.close();
            return true;
        });
}

/**
 * Change to a page, with an optional pass-on function
 * invoked when the transition is complete.
 */
Page.prototype.open = function(pass_on) {
    for (var i = 0; i < this.on_open.length; i++) {
        this.on_open[i].call(this);
    }
    var old_page = Pages.stack[Pages.stack.length - 1];
    Pages.stack.push(this.id)
    console.debug("*** Push " + this.id + " over " + old_page);
    Pages.change_page(this.id, pass_on);
};

/**
 * Pop to the last visited page, with an optional pass-on function
 * invoked when the transition is complete
 */
Page.prototype.close = function(pass_on) {
    for (var i = 0; i < this.on_close.length; i++)
        this.on_close[i].call(this);

    Pages.stack.pop();
    var new_page = Pages.stack[Pages.stack.length - 1];
    console.debug("*** Pop from " + this.id + " to " + new_page);
    Pages.change_page(new_page, pass_on);
};

Page.prototype.control = function(id) {
    if (id)
        return $('#' + this.id + "_" + id);
    else
        return $('#' + this.id);
};

/**
 * @private
 */
Page.play_action = function(action) {
    "use strict";

    var res = Squirrel.client.hoard.record_action(
        action,
        function(e) {
            Squirrel.Tree.action(
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

    // Popups declared outside a page are not automatically
    // inited. There doesn't seem to be any problem with re-initing
    // repeatedly, so.....
    $("#squeak").popup();

    if (typeof e === "string")
        $("#squeak_message").html(e);
    else
        $("#squeak_message").empty().append(e);

    var was_ok = false;

    $("#squeak_ok")
        .off("vclick")
        .on("vclick", function() {
            was_ok = true;
        })
        .toggle(typeof ok !== "undefined");

    $("#squeak")
        .off("afterclose")
        .on("afterclose", function(e) {
            if (typeof ok !== "undefined" && was_ok)
                ok();
            else if (typeof cancel !== "undefined")
                cancel();
                
        });

    $("#squeak").popup("open");
};

function UnauthenticatedPage() {
    Page.call(this, "unauthenticated");
}

UnauthenticatedPage.prototype = Object.create(Page.prototype);

function AuthenticatedPage() {
    Page.call(this, "authenticated");
}

AuthenticatedPage.prototype = Object.create(Page.prototype);

/**
 * The login dialog should never be called more than once. If it is,
 * then the uReq/pReq params will be ignored in the second call.
 * @param ok called on dialog closed, passing the user and password
 * and with this set to the store
 * @param fail never called, but could be used if the login failed
 * @param uReq set true if the store requires a username
 * @param pReq set true if the store requires a password
 */
function LoginPage(store, ok, fail, uReq, pReq) {
    "use strict";

    Page.call(this, "login");

    var self = this;

    self.control("uReq").toggle(uReq);
    self.control("pReq").toggle(pReq);

    var $user = self.control("user");
    var $pass = self.control("pass");
    var $signin = self.control("signin");

    var sign_in = function(evt) {
        $signin.off("vclick");
        $user.off("change");
        $pass.off("change");
        self.close(function() {
            ok.call(store,
                    $user.val(),
                    $pass.val());
        });
        return false;
    };

    console.debug("Attaching handler");
    $signin
        .off("vclick")
        .on("vclick", "p", sign_in);

    $user.off("change").val(store.user());
    $pass.off("change").val(store.pass());

    if (uReq) {
        $user.attr("autofocus", "autofocus");
        if (pReq) {
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
    if (pReq) {
        self.control("foruser")
            .toggle(store.user() !== null)
            .text(store.user() || "");
        $pass.attr("autofocus", "autofocus");
        if (uReq) {
            $pass.on("change", function() {
                $signin.focus();
            });
        } else {
            $pass.on("change", sign_in);
        }
    }
}

LoginPage.prototype = Object.create(Page.prototype);

function ExtrasPage(ok, reason) {

    Page.call(this, "extras");

    var self = this;

    self.control("autosave")
        .off("change")
        .on("change", function(e) {
            Squirrel.client.hoard.options.autosave =
                (self.control("autosave").val() === "on");
            Utils.sometime("update_save");
        });

    self.control("chpw").on("vclick", function() {
        var page = new ChpwPage();
        page.open();
    });

    self.control("chss").on("vclick", function() {
        var page = new StoreSettingsPage();
        page.open();
    });

    self.control("json").on("vclick", function() {
        var page = new JsonPage();
        page.open();
    });

    self.control("about").on("vclick", function() {
        var page = new AboutPage();
        page.open();
    });

    self.on_open.push(function() {
        if (!(Squirrel.client.store.options.needs_path
              || Squirrel.client.store.options.needs_image
              || Squirrel.cloud.store.options.needs_path
              || Squirrel.cloud.store.options.needs_image)) {
            self.control("chss").hide();
        }
        self.control("autosave").val(
            Squirrel.client.hoard.options.autosave ? "on" : "off");
    });
};

ExtrasPage.prototype = Object.create(Page.prototype);

/**
 * Master password change dialog
 */
function ChpwPage() {
    "use strict";

    Page.call(this, "chpw");

    var $page = $("#chpw");
    var self = this;

    self.control("show")
        .off("change")
        .on("change", function() {
            if (self.control("show").prop("checked")) {
                self.control("pass").attr("type", "text");
                self.control("conf").attr("type", "text");
            } else {
                self.control("pass").attr("type", "password");
                self.control("conf").attr("type", "password");
            }
        });
    
    self.on_ok.push(function() {
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
    });
};

ChpwPage.prototype = Object.create(Page.prototype);

function StoreSettingsPage(ok, reason) {
    "use strict";

    Page.call(this, "store_settings");

    var self = this;

    if (Squirrel.cloud.store.options.needs_image
        || Squirrel.client.store.options.needs_image) {

        this.control("file")
            .hide()
            .off("click")
            .on("vclick", function (e) {
                self.ss_change_image();
            });

        this.control("choose")
            .off("click")
            .on("vclick", function(e) {
                self.control("file").trigger("change", e);
            });

        // Don't need a check, there is always an available image
        $("#store_settings_image").show();
    }

    if (Squirrel.cloud.store.options.needs_path
        || Squirrel.client.store.options.needs_path) {

        this.control("storepath").val(
            Squirrel.client.hoard.options.store_path);

        self.on_ok.push(function(e) {
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
        });

        self.control("path").show();
    }

    self.on_open.push(function() {
        self.control("message").empty();
    });
}

StoreSettingsPage.prototype = Object.create(Page.prototype);

/* Helper */
StoreSettingsPage.prototype.ss_change_image = function() {
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
};

function JsonPage() {
    Page.call(this, "json");
    var self = this;
    self.on_open.push(function() {
        var data = Squirrel.client.hoard.cache;
        if (data)
            data = data.data;
        self.control("text")
            .text(JSON.stringify(data))
            .select();
        self.control("load").prop("disabled", true);
    });
    self.control("text")
        .off("input")
        .on("input", function () {
            self.control("load").prop("disabled", false);
        });
    self.on_ok.push(function () {
        var data;
        try {
            data = JSON.parse(self.control("text").val());
        } catch (e) {
            Page.prototype.squeak(TX.tx(
                "JSON could not be parsed") + ": " + e);
            return false;
        }
        self.control("load").prop("disabled", true);
        if (DEBUG) console.debug("Importing...");
        Squirrel.insert_data([], data);
        return true;
    });
}

JsonPage.prototype = Object.create(Page.prototype);

function AboutPage() {
    Page.call(this, "about");
}

AboutPage.prototype = Object.create(Page.prototype);

/****************************/

/**
 * Confirm deletion of a node
 */
Page.confirm_delete = function($node) {
    "use strict";

    var $dlg = $("#dlg_delconf"),
    p = Squirrel.Tree.path($node);

    $dlg.data("path", p);

    $("#dlg_delconf_message").text(p.join("/"));
    $("#dlg_delconf_coll").toggle($node.hasClass("treecollection"));

    if (!$dlg.data("squirrel_ready")) {
        $("#dlg_delconf_delete")
            .off("vclick")
            .on("vclick", function(/*evt*/) {
                var $ddlg = $("#dlg_delconf");
                $ddlg.popup("close");
                var res = Squirrel.client.hoard.record_action(
                    {
                        type: "D",
                        path: $ddlg.data("path")
                    },
                    function(e) {
                        Squirrel.Tree.action(
                            e,
                            function() {
                                Utils.sometime("update_save");
                                Utils.sometime("update_tree");
                            }, true);
                    });
                if (res !== null)
                    this.squeak(res.message);
                return false;
            });

        $("#dlg_delconf_cancel")
            .off("vclick")
            .on("vclick", function(/*evt*/) {
                $("#dlg_delconf").popup("close");
                return false;
            });
        $dlg.data("squirrel_ready", true);
    }

    $dlg.popup("open");
};

/**
 * Password generation for the given leaf node
 */
Page.make_random = function($node) {
    "use strict";

    var $dlg = $("#dlg_gen_rand");
    var opts = {
        length: $("#dlg_gen_rand_len").val(),
        charset: $("#dlg_gen_rand_chs").val()
    };

    $("#dlg_gen_rand_key").text(
        $node.children(".node_div").children(".key").text());
    $("#dlg_gen_rand_idea").text(Utils.generate_password(opts));

    $dlg.data("node", $node);
    $dlg.data("opts", opts);

    if (!$dlg.data("squirrel_ready")) {
        $("#dlg_gen_rand_use")
            .off("vclick")
            .on("vclick", function() {
                var $ddlg = $("#dlg_gen_rand");
                $ddlg.popup("close");
                var pw = $("#dlg_gen_rand_idea").text();
                var old_path = Squirrel.Tree.path($ddlg.data("node"));
                Page.play_action(
                    { type: "E",
                      path: old_path,
                      data: pw });
                return false;
            });

        $("#dlg_gen_rand_again")
            .off("vclick")
            .on("vclick", function() {
                var $ddlg = $("#dlg_gen_rand");
                opts = $ddlg.data("opts");
                opts.length = $("#dlg_gen_rand_len").val();
                opts.charset = $("#dlg_gen_rand_chs").val();
                $("#dlg_gen_rand_idea").text(Utils.generate_password(opts));
                return false;
            });

        $("#dlg_gen_rand_cancel")
            .off("vclick")
            .on("vclick", function() {
                $("#dlg_gen_rand").popup("close");
                return false;
            });
        $dlg.data("squirrel_ready", true);
    }

    $dlg.popup("open");
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
Page.alarm = function($node) {
    "use strict";

    var $dlg = $("#dlg_alarm");
    var $alarm = $node.children(".alarm");
    var path = Squirrel.Tree.path($node);
    var number = 6;
    var units = "m";
    var is_new = (!$dlg.data("squirrel_ready"));

    var update_next = function() {
        var numb = $("#dlg_alarm_number").val()
            * units_days[$("#dlg_alarm_units").val()];
        var elapsed = Math.round((Date.now() - $node.data("last-time"))
                                 / ms_in_day);
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
        $("#dlg_alarm_next").text(numb);
        $(".dlg_alarm_next").hide();
        $(".dlg_alarm_next." + uns).show();
    };

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

    $dlg.data("path", path);
    $("#dlg_alarm_number").val(number);
    $("#dlg_alarm_units").val(units);
    update_next();

    $dlg.popup("open");

    // Doing this after the dialog is initialised, because otherwise the
    // selectmenu is covered
    if (is_new) {
        $("#dlg_alarm_units")
            .selectmenu()
            .off("change")
            .on("change", update_next);

        $("#dlg_alarm_number")
            .spinner({
                min: 1
            })
            .off("change")
            .on("change", update_next);

        $("#dlg_alarm_set")
            .off("vclick")
            .on("vclick", function() {
                $dlg.popup("close");

                var numb = $("#dlg_alarm_number").val()
                    * units_days[$("#dlg_alarm_units").val()];

                Page.play_action(
                    { type: "A",
                      path: $dlg.data("path"),
                      data: numb
                    });
                return false;
            });

        $("#dlg_alarm_cancel")
            .off("vclick")
            .on("vclick", function() {
                $dlg.popup("close");
                if ($alarm) {
                    Page.play_action(
                        { type: "C",
                          path: $dlg.data("path")
                        });
                }
                return false;
            });

        // Hack around http://bugs.jqueryui.com/ticket/10543
        $dlg.parent().css("overflow", "visible");
        $dlg.data("squirrel_ready", true);
    }
};

Page.pick_from = function($node) {
    "use strict";

    var $dlg = $("#dlg_pick"),
    val = $node.children(".node_div").children(".value").text(),
    $which = $("#dlg_pick_which"),
    $from = $("#dlg_pick_from"), i, $f,

    item_clicked = function() {
        var ii = $(this).data("i");
        $dlg
            .find("td.i" + ii)
            .addClass("picked");
    };

    if (!$dlg.data("squirrel_ready")) {
        $("#dlg_pick_clear")
            .off("vclick")
            .on("vclick", function() {
                $dlg.find(".picked").removeClass("picked");
            });
        $dlg.data("squirrel_ready", true);
    }

    for (i = 0; i < val.length; i++) {
        $f = $from.children("td.i" + i);
        if ($f.length === 0) {
            $("<td></td>")
                .data("i", i)
                .addClass("pick_cell i" + i)
                .text(i + 1)
                .off("change")
                .on("change", item_clicked)
                .appendTo($which);
            $f = $("<td></td>")
                .data("i", i)
                .addClass("pick_cell i" + i)
                .off("change")
                .on("change", item_clicked)
                .appendTo($from);
        }
        $f.text(val.charAt(i));
    }

    while (i < $from.children("td").length) {
        $from.children("td").last().remove();
        i++;
    }

    $dlg.find(".picked").removeClass("picked");

    $dlg.popup("open");
};
