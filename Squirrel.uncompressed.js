/*

*/

/**
 * Plugin to generate taphold events on platforms that don't
 * natively support them
 */
$.fn.linger = function() {
    "use strict";

    var eventType = {
        mousedown: "ontouchstart" in window ? "touchstart" : "mousedown",
        mouseup: "ontouchend" in window ? "touchend" : "mouseup"
    };
    return this.each(function() {
        var timeout;
        $(this)
            .on(eventType.mousedown + ".linger", function(e) {
                timeout = window.setTimeout(function() {
                    $(e.currentTarget).trigger("taphold");
                }, 1000);
                return false; // stop bubble
            })
            .on(eventType.mouseup + ".linger", function(e) {
                window.clearTimeout(timeout);
            })
            .on(eventType.click + ".linger", function(e) {
                window.clearTimeout(timeout);
            })
            .on("contextmenu.linger", function(e) {
                window.clearTimeout(timeout);
            });
    });
};

var Squirrel = { // Namespace
    client_store: null,
    cloud_store: null,
    client_hoard: null
};

Squirrel.squeak = function(e) {
    "use strict";

    var $dlg = $("#dlg_alert");
    if (typeof e === "string")
        $dlg.children(".message").html(e);
    else
        $dlg.children(".message").empty().append(e);
    $dlg.dialog({
        modal: true
    });
}

// Generate a new password subject to constraints:
// length: length of password
// charset: characters legal in the password. Ranges can be defined using
// A-Z syntax.
Squirrel.generate_password = function(constraints) {
    "use strict";
    var sor, eor;

    if (typeof constraints.length === "undefined") {
        constraints.length = 24;
    }
    if (typeof constraints.charset === "undefined") {
        constraints.charset = "A-Za-z0-9";
    }
    var cs = constraints.charset;
    var legal = [];
    while (cs.length > 0) {
        if (cs.length >= 3 && cs.charAt(1) === "-") {
            sor = cs.charCodeAt(0);
            eor = cs.charCodeAt(2);
            cs = cs.substring(3);
            while (sor <= eor) {
                legal.push(String.fromCharCode(sor++));
            }
        } else {
            legal.push(cs.charAt(0));
            cs = cs.substring(1);
        }
    }
    var array = new Uint8Array(constraints.length);
    window.crypto.getRandomValues(array);
    var s = "";
    for (var i = 0; i < constraints.length; i++) {
        s += legal[array[i] % legal.length];
    }
    return s;
}

// Reconstruct the tree path from the DOM
Squirrel.get_path = function($node) {
    "use strict";

    var path = [];
    if (typeof $node.attr("data-key") !== "undefined") {
        path.push($node.attr("data-key"));
    }
    $node
        .parents("li")
        .each(function() {
            if (typeof $(this).attr("data-key") !== "undefined") {
                path.unshift($(this).attr("data-key"));
            }
        });
    return path;
}

// Escape meta-characters for use in CSS selectors
Squirrel.quotemeta = function(s) {
    "use strict";

    return s.replace(/([\][!"#$%&'()*+,.\/:;<=>?@\\^`{|}~])/g, "\\$1");
}

// Generate a message for the last modified time
Squirrel.last_mod = function(time) {
    "use strict";

    var d = new Date(time);
    return TX.tx("Last modified: ") + d.toLocaleString() + " "
        + TX.tx("Click and hold to open menu");
}

// Confirm deletion of a node
Squirrel.confirm_delete = function($node) {
    "use strict";

    var $dlg = $("#dlg_confirm_delete");
    $dlg.find(".message").text(Squirrel.get_path($node).join("/"));
    if ($node.hasClass("treecollection")) {
        $dlg.find(".is_collection").show();
    } else {
        $dlg.find(".is_collection").hide();
    }
    $dlg.dialog({
        modal: true,
        width: "auto",
        buttons: {
            "Confirm": function(evt) {
                $(this).dialog("close");
                client_hoard.play_action(
                    { type: "D", path: Squirrel.get_path($node) },
                    function(e) {
                        play_action(e);
                        Squirrel.update_tree();
                    });
            }
        }});
}

// Update the tree view
Squirrel.update_tree = function() {
    "use strict";

    $("#tree")
        .bonsai("update")
        .contextmenu({
            delegate: ".node_div",
            menu: [
                {
                    // Need the area that handles this to be covered with
                    // the zeroclipboard
                    title: TX.tx("Copy value"),
                    cmd: "copy",
                    uiIcon: "silk-icon-camera"
                },
                {
                    title: TX.tx("Rename"),
                    cmd: "rename",
                    uiIcon: "silk-icon-pencil" 
                },
                {
                    title: TX.tx("Edit value"),
                    cmd: "edit",
                    uiIcon: "silk-icon-comment-edit" 
                },
                {
                    title: TX.tx("Generate new password"),
                    cmd: "generate_password",
                    uiIcon: "silk-icon-bullet-key" 
                },               
                {
                    title: TX.tx("Add new value"),
                    cmd: "add_value",
                    uiIcon: "silk-icon-comment-add" 
                },
                {
                    title: TX.tx("Add new sub-tree"),
                    cmd: "add_subtree",
                    uiIcon: "silk-icon-chart-organisation-add" 
                },
                {
                    title: TX.tx("Delete"),
                    cmd: "delete",
                    uiIcon: "silk-icon-delete" 
                }
            ],
            beforeOpen: function(e, ui) {
                var $div, isvalue, $el, client;
                if (ui.target.is(".node_div"))
                    $div = ui.target;
                else
                    $div = ui.target.parents(".node_div").first();

                isvalue = ($div.children(".value").length > 0);
                $("#tree")
                    .contextmenu("showEntry", "copy", isvalue)
                    .contextmenu("showEntry", "edit", isvalue)
                    .contextmenu("showEntry", "generate_password", isvalue)
                    .contextmenu("showEntry", "add_subtree", !isvalue)
                    .contextmenu("showEntry", "add_value", !isvalue);

                if (isvalue) {
                    // SMELL: is it safe to do this every time?
                    // Trust that the copy item will always be first!
                    $el = ui.menu.children().first();
                    // Whack the Flash movie over the menu item li
                    client = new ZeroClipboard($el);
                    // Now handle the "copy" event that comes from
                    // the Flash movie
                    client.on("copy", function(event) {
                        event.clipboardData.setData(
                            "text/plain",
                            $div.children(".value").text());
                    });
                }
            },
            // We map long mouse hold to taphold in the plugin above
            // Right click still works
            taphold: true,
            select: Squirrel.node_tapheld
        });
}

// Edit a span in place
Squirrel.inplace_edit = function($span, action) {
    "use strict";
    var h = $span.height();
    var w = $span.width();

    $span.hide();
    var $input = $("<input/>");
    $input
        .addClass("inplace_editor")
        .val($span.text())
        .css("height", h)
        .css("width", w)
        .insertBefore($span)
        .change(function() {
            var val = $input.val();
            $input.remove();
            $span.show();
            if (val !== $span.text()) {
                var old_path = Squirrel.get_path($span);
                client_hoard.play_action(
                    { type: action,
                      path: old_path,
                      data: val },
                    function(e) {
                        play_action(e);
                        Squirrel.update_tree();
                    });
            }
        })
        .blur(function() {
            $(this).remove();
            $span.show();
        })
        .select()
        .focus();
}

// Action on a new tree node
Squirrel.add_child_node = function($div, title, value) {
    "use strict";
    var $li = $div.parents("li").first();
    var $ul = $li.parent();
    $ul.bonsai("expand", $li);

    var p = Squirrel.get_path($div);
    var action = {
        type: "N",
        path: p
    };
    if (typeof value !== "undefined") {
        action.data = value;
    }
    p.push(title);
    client_hoard.play_action(
        action,
        function(e) {
            var $n = play_action(e);
            // Want the result of the action play to grab the focus?
            Squirrel.update_tree();
            Squirrel.inplace_edit($n);
        });
}

// Dialog password generation
Squirrel.make_password = function(set) {
    "use strict";
    var $dlg = $("#dlg_gen_password");
    var buttons = {};
    var opts = {
        length: $dlg.find(".pw_length").val(),
        charset: $dlg.find(".pw_chars").val()
    };

    buttons[TX.tx("Use this")] = function() {
        $dlg.dialog("close");
        var pw = $dlg.find(".pw").text();
        set.call(this, pw);
    };
    buttons[TX.tx("Try again")] = function() {
        opts.length = $dlg.find(".pw_length").val();
        opts.charset = $dlg.find(".pw_chars").val();
        $dlg.find(".pw").text(Squirrel.generate_password(opts));
    };
    buttons[TX.tx("Forget it")] = function() {
        $dlg.dialog("close");
    };

    $dlg.find(".pw").text(Squirrel.generate_password(opts));

    $dlg.dialog({
        width: "auto",
        modal: true,
        buttons: buttons});
}

// Convert a path to an HTTP fragment
Squirrel.fragment_id = function(path) {
    "use strict";

    var fid = path.join(":");
    return fid.replace(/[^A-Za-z0-9:_]/g, function(m) {
        return m.charCodeAt(0);
    });
}

Squirrel.search = function(s) {
    "use strict";

    var $sar = $("#search_results");
    $sar.empty();
    var re = new RegExp(s, "i");
    $(".key").each(function() {
        if ($(this).text().match(re)) {
            var $li = $(this).closest("li");
            var path = Squirrel.get_path($li);
            var $res = $("<a></a>");
            $res
                .attr("href", "#" + Squirrel.fragment_id(path))
                .addClass("search_result")
                .text(path.join("/"))
                .click(function() {
                    $("#tree").bonsai("collapseAll");
                    $("#tree").bonsai("expand", $li);
                    $li.parents("li").each(function() {
                        $("#tree").bonsai("expand", $(this));
                    });
                });
            $sar.append($res).append("<br />");
        }
    });
}

// Handler for taphold event on a contextmenu item
Squirrel.node_tapheld = function(e, ui) {
    "use strict";
    var $li = ui.target.parents("li").first();
    var $div = $li.children(".node_div");
    if (ui.cmd === "copy") {
        //log("Copying to clipboard");
        ZeroClipboard.setData($div.children(".value").text());
    }
    else if (ui.cmd === "rename") {
        //console.debug("Renaming");
	Squirrel.inplace_edit($div.children(".key"), "R");
    }
    else if (ui.cmd === "edit") {
        //console.debug("Editing");
	Squirrel.inplace_edit($div.children(".value"), "E");
    }
    else if (ui.cmd === "add_value") {
        //log("Adding value");
        Squirrel.add_child_node($div, TX.tx("New value"), TX.tx("None"));
    }
    else if (ui.cmd === "add_subtree") {
        //log("Adding subtree");
        Squirrel.add_child_node($div, TX.tx("New sub-tree"));
    }
    else if (ui.cmd === "generate_password") {
        Squirrel.make_password(function(pw) {
            $div.children(".value").text(pw);
        });
    }
    else if (ui.cmd === "delete") {
        Squirrel.confirm_delete($div);
    }
    else {
        throw "Unknown ui.cmd " + ui.cmd;
    }
}

// Update the save button based on hoard state
Squirrel.update_save_button = function() {
    "use strict";
    $("#save_button").toggle(Squirrel.client_hoard.is_modified());
}

// Callback for use when managing hoards; plays an action that is being
// played into the hoard into the DOM as well.
Squirrel.play_action = function(e) {
    "use strict";

    //log("Playing " + e.type + " @" + new Date(e.time)
    //            + " " + e.path.join("/")
    //            + (typeof e.data !== "undefined" ? " " + e.data : ""));

    var $parent_ul = $("#tree"), key, $li, $div, menu, $keyspan, $valspan;

    // Locate the parent of the node who"s path we are given
    for (var i = 0; i < e.path.length - 1; i++) {
        $parent_ul = $parent_ul.find("li[data-key='" + Squirrel.quotemeta(e.path[i]) + "'] > ul");
    }

    key = e.path[e.path.length - 1];

    if (e.type === "N") {
        $li = $("<li></li>")
            .attr("data-key", key)
            .attr("name", key)
            .attr("title", Squirrel.last_mod(e.time));

        $div = $("<div></div>")
            .addClass("node_div")
;//            .hover(
//            function() {
//                $(this).addClass("selected");
//            },
//            function() {
//                $(this).removeClass("selected");
//            });
        $li.append($div);

        $keyspan = $("<span class='key'>" + key + "</span>");
        $div.append($keyspan);

        if (typeof e.data !== "undefined" && e.data !== null) {
            $div.addClass("treeleaf");
            $valspan = $("<span class='value'>" + e.data + "</span>");
            $div.append(" : ").append($valspan);
        } else {
            $div.addClass("treecollection");
            var $subul = $("<ul></ul>");
            $li.append($subul);
        }

        // Insert-sort into the $parent_ul
        var inserted = false;
        key = key.toLowerCase();
        $parent_ul.children("li").each(function() {
            if ($(this).attr("data-key").toLowerCase() > key) {
                $li.insertBefore($(this));
                inserted = true;
                return false;
            }
        });
        if (!inserted) {
            $parent_ul.append($li);
        }

        // Add anchor
        $li.prepend($("<a></a>").attr("name", Squirrel.fragment_id(Squirrel.get_path($li))));

        // Enable taphold events
        $div
            .linger()
            .click(function() {
            });

    } else if (e.type === "R") {
        $parent_ul
            .children("li[data-key='" + Squirrel.quotemeta(key) + "']")
            .attr("data-key", e.data)
            .attr("title", Squirrel.last_mod(e.time))
            .children(".node_div")
            .children("span.key")
            .text(e.data);
        // TODO: re-sort
    } else if (e.type === "E") {
        $parent_ul
            .children("li[data-key='" + Squirrel.quotemeta(key) + "']")
            .attr("title", Squirrel.last_mod(e.time))
            .children(".node_div")
            .children("span.value")
            .text(e.data);
    } else if (e.type === "D") {
        $parent_ul
            .children("li[data-key='" + Squirrel.quotemeta(e.path[i]) + "']")
            .remove();
        $parent_ul
            .parents("li")
            .first()
            .attr("title", Squirrel.last_mod(e.time));
    } else {
        throw "Unrecognised action '" + e.type + "'";
    }
    Squirrel.update_save_button();

    return $keyspan;
}

Squirrel.get_updates_from_cloud = function(cloard) {
    "use strict";

    // This will get triggered whenever both hoards are
    // successfully loaded.
    console.debug("Merging from cloud hoard");
    var conflicts = [];
    client_hoard.merge_from_cloud(
        cloard, Squirrel.play_action, conflicts);
    if (conflicts.length > 0) {
        var $dlg = $("#dlg_conflicts");
        $dlg.children(".message").empty();
        $.each(conflicts, function(i, c) {
            var e = c.action;
            $("<div></div>")
                .text(
                    e.type + ":" + e.path.join("/")
                        + (typeof e.data !== "undefined" ?
                           " " + e.data : "")
                        + " @" + new Date(e.time)
                        + ": " + c.message)
                .appendTo($dlg.children(".message"));
        });
        $dlg.dialog({
            width: "auto"
        });
    }
    // Finished with the cloud hoard (for now)
    Squirrel.update_save_button();
    Squirrel.update_tree();
}

// Determine if there are unsaved changes, and generate a warning
// message for the caller to use.
Squirrel.unsaved_changes = function() {
    "use strict";
    if (client_hoard && client_hoard.is_modified()) {

        var changed = "";
        $(".modified").each(function() {
            changed += "   " + $(this).attr("name") + "\n";
        });
        return TX.tx("You have unsaved changes") + "\n"
             + TX.tx("Are you really sure?");
    }
};

Squirrel.save_hoards = function() {
    "use strict";
    var $messy = $("<div class='notice'>"
                   + TX.tx("Saving....")
                   + "</div>");
    Squirrel.squeak($messy);

    var save_client = function() {
        Squirrel.client_store.data = client_hoard;
        Squirrel.client_store.save(
            function() {
                $(".modified").removeClass("modified");
                $messy.append(
                    "<div class='notice'>"
                        + TX.tx("Saved in this browser")
                        + "</div>");

                Squirrel.update_save_button();
            },
            function(e) {
                $messy.append(
                    "<div class='warn'>"
                        + TX.tx("Failed to save in the browser: ") + e
                        + "</div>");

                Squirrel.update_save_button();
            });
    };

    // Reload and save the cloud hoard
    Squirrel.cloud_store.refresh(
        function() {
            var conflicts = [];
            var cloard = new Hoard(Squirrel.cloud_store.data);
            client_hoard.merge_from_cloud(
                cloard, Squirrel.play_action, conflicts);
            if (client_hoard.is_modified()) {
                cloard.actions =
                    cloard.actions.concat(client_hoard.actions);
                Squirrel.cloud_store.data = cloard;
                Squirrel.cloud_store.save(
                    function() {
                        client_hoard.actions = [];
                        client_hoard.last_sync =
                            new Date().valueOf();
                        $messy.append(
                            "<div class='notice'>"
                                + TX.tx("Saved in the Cloud")
                                + "</div>");
                        save_client();
                    },
                    function(e) {
                        $messy.append(
                            "<div class='error'>"
                                + TX.tx("Failed to save in the Cloud")
                                + "<br>" + e + "</div>");
                        save_client();
                    });
            }
        },
        function(e) {
            $messy.append(
                "<div class='error'>"
                    + TX.tx("Failed to refresh from the Cloud")
                    * "<br>" + e + "</div>");
            save_client();
        });
};

Squirrel.hoards_loaded = function() {
    var autosave = (Squirrel.client_hoard.last_sync === null
                    && Squirrel.client_hoard.cache === null);

    console.debug("Reconstructing UI tree from cache");
    // Use reconstruct_actions to drive creation of
    // the UI
    Squirrel.client_hoard.reconstruct_actions(Squirrel.play_action);
    // Reset the UI modification list; we just loaded the
    // client hoard
    $(".modified").removeClass("modified");
    
    $("#unauthenticated").loadingOverlay("remove");
    Squirrel.update_save_button();
    Squirrel.update_tree();
    $("#unauthenticated").hide();
    $("#authenticated").show();
};

Squirrel.load_cloud_hoard = function() {
    if (Squirrel.cloud_store) {
        Squirrel.cloud_store.read(
            function(data) {
                try {
                    var hoard = JSON.parse(data);
                    Squirrel.get_updates_from_cloud(new Hoard(hoard));
                    Squirrel.hoards_loaded();
                } catch (e) {
                    Squirrel.squeak("Cloud hoard data is malformed: " + e);
                };
            },
            function(e) {
                if (e === AbstractStore.NODATA) {
                    console.debug("Cloud hoard contains no data");
                    Squirrel.hoards_loaded();
                } else {
                    Squirrel.squeak("Cloud store error: " + e);
                }
            });
    } else {
        Squirrel.hoards_loaded();
    }
};

Squirrel.load_hoards = function() {
    Squirrel.client_store.read(
        function(data) {
            try {
                Squirrel.client_hoard = new Hoard(JSON.parse(data));
                if (Squirrel.cloud_store)
                    Squirrel.load_cloud_hoard();
            } catch (e) {
                Squirrel.squeak("Client hoard data is malformed: " + e);
            };
        },
        function(e) {
            if (e === AbstractStore.NODATA) {
                console.debug("Client hoard contains no data");
                Squirrel.client_hoard = new Hoard();
                if (Squirrel.cloud_store)
                    Squirrel.load_cloud_hoard();
            } else {
                Squirrel.squeak("Client store error: " + e);
            }
        });
};

Squirrel.init_ui = function() {
    $("#save_button")
        .button({
            icons: {
                primary: "silk-icon-disk"
            },
            text: false
        })
        .hide()
        .click(Squirrel.save_hoards);

    $("#tree").bonsai({
        expandAll: false });

    $("#add_root_child")
        .button({
            icons: {
                primary: "silk-icon-add"
            },
            text: false
        })
        .click(function() {
            add_new_child($("#tree"));
        });

    $("#search")
        .change(function(evt) {
            search($(this).val());
        });
};

Squirrel.log_in_dialog = function(ok, fail, uReq, pReq) {
    var $dlg = $("#dlg_login"),
    b = {},
    self = this;
    $dlg.find("#uReq").toggle(uReq);
    $dlg.find("#pReq").toggle(pReq);
    b[TX.tx("Sign In")] = function(evt) {
        $(this).dialog("close");
        ok.call(self,
                $dlg.find("#user").val(),
                $dlg.find("#password").val());
    };
    $dlg.dialog({
        modal: true,
        width: "auto",
        buttons: b
    });
};

Squirrel.init_client_store = function() {
    var cls = new LocalStorageStore({
        dataset: "Squirrel",
        ok: function() {
            console.debug("Client store is ready");
            $("#whoami").text(this.user);
            Squirrel.client_store = this;
            Squirrel.load_hoards();
        },
        fail: function(e) {
            // We did our best!
            Squirrel.squeak("Failed" + e);
        },
        identify: function(ok, fail, uReq, pReq) {
            var user, pass;
            assert(uReq || pReq);
            if (uReq && Squirrel.cloud_store) {
                if (!pReq) {
                    ok.call(this, Squirrel.cloud_store.user);
                    return;
                } else {
                    // Just prompt for password
                    $("#dlg_login").find("#user").val(Squirrel.cloud_store.user);
                    uReq = false;
                }
            }
            Squirrel.log_in_dialog.call(this, ok, fail, uReq, pReq);
        }
    });
};

Squirrel.init_cloud_store = function() {
    var cls =  new DropboxStore({
        dataset: "Squirrel",
        ok: function() {
            Squirrel.cloud_store = this;
            Squirrel.init_client_store();
        },
        fail: function(e) {
            Squirrel.squeak("Could not contact cloud store");
            Squirrel.init_client_store();
        },
        identify: Squirrel.log_in_dialog
    });
};

(function ($) {
    "use strict";

    $(document)
        .ready(function() {
            // Initialise UI components
            Squirrel.init_ui();
            // Initialise translation module
            new TX("en", Squirrel.init_cloud_store);
        })
    .on("stores_ready", function() {
    });

    $(window).on("beforeunload", function() {
        return Squirrel.unsaved_changes();
    });
})(jQuery);
