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
            .on(eventType.mouseup + ".linger", function(/*evt*/) {
                window.clearTimeout(timeout);
            })
            .on(eventType.click + ".linger", function(/*evt*/) {
                window.clearTimeout(timeout);
            })
            .on("contextmenu.linger", function(/*evt*/) {
                window.clearTimeout(timeout);
            });
    });
};

$.fn.scrollView = function () {
    "use strict";

    return this.each(function () {
        $("html, body").animate({
            scrollTop: $(this).offset().top
        }, 250);
    });
};

var Squirrel = {                     // Namespace
    client_store: null,              // The store used actively
    client_hoard: null,              // The hoard in that store
    cloud_store: null,               // Temporary memory used during load
    cloud_is_empty: false,           // Flag used during load
    suppress_update_events: 0,       // Counter used to prevent update events
    PATHSEP: String.fromCharCode(1), // separator used in Path->node mapping
    nodes: {},                       // Path->node mapping
    last_yield: Date.now()
};

//Squirrel.getURLParameter = function(name) {
//    var re = new RegExp('[?|&]' + name + '=' + '([^&;]+?)(&|#|;|$)');
//    var hits = re.exec(location.search) || [,""];
//    return decodeURIComponent(hits[1].replace(/\+/g, '%20'))
//        || null;
//}

// Generate an alert dialog
Squirrel.squeak = function(e) {
    "use strict";

    if (typeof e === "string")
        $("#dlg_alert_message").html(e);
    else
        $("#dlg_alert_message").empty().append(e);

    $("#dlg_alert").dialog({
        modal: true
    });
};

// Allow the UI to have a slice of time at least every 100ms. Used when
// chaining functions.
Squirrel.ui_yield = function(fn) {
    "use strict";

    if (Date.now() - Squirrel.last_yield > 100) {
        window.setTimeout(function() {
            Squirrel.last_yield = Date.now();
            fn();
        }, 1);
    } else
        fn();
};

/**
 * Generate a new password subject to constraints:
 * length: length of password
 * charset: characters legal in the password. Ranges can be defined using
 * A-Z syntax.
 */
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
};

/**
 * Reconstruct the path for an item from the DOM
 */
Squirrel.get_path = function($node) {
    "use strict";

    if (!$node.hasClass("node"))
        $node = $node.closest(".node");

    var path = $node.data("path"), ps;
    if (path)
        return path.split(Squirrel.PATHSEP);

    if (typeof $node.attr("data-key") !== "undefined") {
        path = Squirrel.get_path($node.parents(".node").first());
        path.push($node.attr("data-key"));

        ps = path.join(Squirrel.PATHSEP);
        $node.data("path", ps);

        assert(!Squirrel.nodes[ps]);
        Squirrel.nodes[ps] = $node;
    } else
        path = [];

    return path;
};

/*
 * Escape meta-characters for use in CSS selectors
 */
Squirrel.quotemeta = function(s) {
    "use strict";

    return s.replace(/([\][!"#$%&'()*+,.\/:;<=>?@\\^`{|}~])/g, "\\$1");
};

/**
 * Generate a message for the last modified time
 */
Squirrel.last_mod = function(time) {
    "use strict";

    var d = new Date(time);
    return TX.tx("Last modified: ") + d.toLocaleString() + " "
        + TX.tx("Click and hold to open menu");
};

/**
 * Confirm deletion of a node
 */
Squirrel.confirm_delete = function($node) {
    "use strict";

    var $dlg = $("#dlg_delconf");
    $("#dlg_delconf_message").text(Squirrel.get_path($node).join("/"));
    $("#dlg_delconf_coll").toggle($node.hasClass("treecollection"));
    $dlg.dialog({
        modal: true,
        width: "auto",
        buttons: {
            "Confirm": function(/*evt*/) {
                $(this).dialog("close");
                Squirrel.client_hoard.play_action(
                    {
                        type: "D",
                        path: Squirrel.get_path($node)
                    },
                    function(e) {
                        Squirrel.play_action(e, Squirrel.update_tree);
                    });
            }
        }});
};

/**
 * Update the tree view when data changes
 */
Squirrel.update_tree = function() {
    "use strict";

    $("#treeroot")
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
                $("#treeroot")
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
            select: Squirrel.context_menu_choice
        });
};

/**
 * Edit a span in place, used for renaming and revaluing
 */
Squirrel.in_place_edit = function($span, action) {
    "use strict";
    var h = $span.height();
    var w = $("#tree").width();
    $span.parents().each(function() {
        w -= $(this).position().left;
    });
    $span.hide();
    var $input = $("<input/>");
    $input
        .addClass("in_place_editor")
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
                Squirrel.client_hoard.play_action(
                    { type: action,
                      path: old_path,
                      data: val },
                    function(e) {
                        Squirrel.play_action(e, Squirrel.update_tree);
                    });
            }
        })
        .keydown(function(e) { // cancel
            if (e.keyCode === 27) {
                $input.remove();
                $span.show();
            }
        })
        .blur(function() {
            $(this).remove();
            $span.show();
        })
        .select()
        .focus();
};

/**
 * A (manual) new tree node action
 */
Squirrel.add_child_node = function($parent, title, value) {
    "use strict";

    var $li = $parent.parents("li").first();
    var $ul = $li.parent();
    $ul.bonsai("expand", $li);

    var p = Squirrel.get_path($parent);
    var action = {
        type: "N",
        path: p
    };
    if (typeof value !== "undefined") {
        action.data = value;
    }
    p.push(title);
    Squirrel.client_hoard.play_action(
        action,
        function(e) {
            Squirrel.play_action(e, function($n) {
                // Want the result of the action play to grab the focus?
                Squirrel.update_tree();
                Squirrel.in_place_edit(
                    $n.children(".node_div").children(".key"));
            });
        });
};

/**
 * Dialog password generation
 */
Squirrel.make_password = function(set) {
    "use strict";
    var $dlg = $("#dlg_gen_pw");
    var buttons = {};
    var opts = {
        length: $("#dlg_gen_pw_len").val(),
        charset: $("#dlg_gen_pw_chs").val()
    };

    buttons[TX.tx("Use this")] = function() {
        $dlg.dialog("close");
        var pw = $("#dlg_gen_pw_idea").text();
        set.call(this, pw);
    };
    buttons[TX.tx("Try again")] = function() {
        opts.length = $("#dlg_gen_pw_len").val();
        opts.charset = $("#dlg_gen_pw_chs").val();
        $("#dlg_gen_pw_idea").text(Squirrel.generate_password(opts));
    };
    buttons[TX.tx("Forget it")] = function() {
        $dlg.dialog("close");
    };

    $("#dlg_gen_pw_idea").text(Squirrel.generate_password(opts));

    $dlg.dialog({
        width: "auto",
        modal: true,
        buttons: buttons});
};

/**
 * Convert a path to an HTTP fragment
 */
Squirrel.fragment_id = function(path) {
    "use strict";

    var fid = path.join(":");
    return fid.replace(/[^A-Za-z0-9:_]/g, function(m) {
        return m.charCodeAt(0);
    });
};

/**
 * Perform a text search
 */
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
                    $("#treeroot")
                        .bonsai("collapseAll")
                        .bonsai("expand", $li);
                    // Zoom up the tree opening each level we find
                    $li.parents("li.node").each(function() {
                        $("#treeroot").bonsai("expand", $(this));
                    });
                });
            $sar.append($res).append("<br />");
        }
    });
};

/**
 * Handler for context menu
 */
Squirrel.context_menu_choice = function(e, ui) {
    "use strict";

    var $li = ui.target.parents("li").first();
    var $div = $li.children(".node_div");

    switch (ui.cmd) {
    case "copy":
        //console.debug("Copying to clipboard");
        ZeroClipboard.setData($div.children(".value").text());
        break;

    case "rename":
        //console.debug("Renaming");
	Squirrel.in_place_edit($div.children(".key"), "R");
        break;

    case "edit":
        //console.debug("Editing");
	Squirrel.in_place_edit($div.children(".value"), "E");
        break;

    case "add_value":
        //console.debug("Adding value");
        Squirrel.add_child_node($div, TX.tx("New value"), TX.tx("None"));
        break;

    case "add_subtree":
        //console.debug("Adding subtree");
        Squirrel.add_child_node($div, TX.tx("New sub-tree"));
        break;

    case "generate_password":
        Squirrel.make_password(function(pw) {
            $div.children(".value").text(pw);
        });
        break;

    case "delete":
        Squirrel.confirm_delete($div);
        break;

    default:
        throw "Unknown ui.cmd " + ui.cmd;
    }
};

/**
 * Update the save button based on hoard state
 */
Squirrel.update_save_button = function() {
    "use strict";

    var needed = Squirrel.client_hoard.modified || Squirrel.cloud_is_empty;
    console.debug("Update save button " + needed);
    $("#save_button").toggle(needed);
};

/**
 * Callback for use when managing hoards; plays an action that is being
 * played into the hoard into the DOM as well.
 * @param e action to play
 * @param chain function to call once the action has been played. May
 * be undefined. Passed the modified node.
 */
Squirrel.play_action = function(e, chain) {
    "use strict";

    //console.debug("Playing " + Squirrel.stringify_action(e));

    var $li, $div, key, $parent_ul,
    p = e.path, inserted;

    switch (e.type) {

    case "N": // Construct new node
        p = p.slice();
        key = p.pop();
        $li = Squirrel.nodes[p.join(Squirrel.PATHSEP)]; // get the parent
        $parent_ul = $li.children("ul").first();

        $li = $("<li></li>")
            .addClass("node")
            .attr("data-key", key)
            .attr("name", key)
            .attr("title", Squirrel.last_mod(e.time));

        $div = $("<div></div>")
            .addClass("node_div")
            .appendTo($li);

        $("<span></span>")
            .addClass("key")
            .dblclick(function() {
                Squirrel.in_place_edit(
                    $div.children(".key"), "R");
            })
            .text(key)
            .appendTo($div);

        if (typeof e.data !== "undefined" && e.data !== null) {
            $div
                .addClass("treeleaf")
                .append(" : ")
                .append(
                    $("<span></span>")
                        .addClass("value")
                        .dblclick(function() {
                            Squirrel.in_place_edit(
                                $div.children(".value"), "E");
                        })
                        .text(e.data));
        } else {
            $div.addClass("treecollection");
            $("<ul></ul>")
                .addClass("node_ul")
                .appendTo($li);
        }

        // Insert-sort into the $parent_ul
        inserted = false;
        key = key.toLowerCase();
        $parent_ul.children("li.node").each(function() {
            if ($(this).attr("data-key").toLowerCase() > key) {
                $li.insertBefore($(this));
                inserted = true;
                return false;
            }
        });
        if (!inserted)
            $parent_ul.append($li);

        Squirrel.get_path($li); // add to cache

        // Add anchor
        $li.prepend(
            $("<a></a>")
                .addClass("node_fragment")
                .attr("name", Squirrel.fragment_id(Squirrel.get_path($li))));

        // Enable taphold events
        $div
            .linger()
            .click(function() {
            });
        break;

    case "R": // Rename
        // Detach the li from the DOM
        $li = Squirrel.nodes[p.join(Squirrel.PATHSEP)];

        $parent_ul = $li.closest("ul");
        $li
            .detach()
            .attr("data-key", e.data)
            .data("path", null)
            .attr("title", Squirrel.last_mod(e.time))
            .children(".node_div")
            .children("span.key")
            .text(e.data);

        // Re-insert the element in it's sorted position
        inserted = false;
        key = e.data.toLowerCase();
        $parent_ul.children("li.node").each(function() {
            if ($(this).attr("data-key").toLowerCase() > key) {
                $li.insertBefore($(this));
                inserted = true;
                return false;
            }
        });
        if (!inserted)
            $parent_ul.append($li);

        // refresh data-path and update get fragment ID
        $li .children("a.node_fragment")
            .attr("name", Squirrel.fragment_id(Squirrel.get_path($li)))
            .scrollView();
        break;

    case "E": // Change data
        $li = Squirrel.nodes[p.join(Squirrel.PATHSEP)];
        $li .attr("title", Squirrel.last_mod(e.time))
            .children(".node_div")
            .children("span.value")
            .text(e.data);
        break;

    case "D": // Delete node
        $li = Squirrel.nodes[p.join(Squirrel.PATHSEP)];

        $li .parents("li.node")
            .first()
            .attr("title", Squirrel.last_mod(e.time));

        $li.find("li.node").each(function() {
            delete Squirrel.nodes[Squirrel.get_path($(this))];
        });
        delete Squirrel.nodes[Squirrel.get_path($li)];
        
        $li.remove();

        break;

    default:
        throw "Unrecognised action '" + e.type + "'";
    }

    if (Squirrel.suppress_update_events === 0)
        $(document).trigger("update_save_button");

    if (typeof chain !== "undefined") {
        Squirrel.ui_yield(function() {
            chain($li);
        });
    }
};

Squirrel.get_updates_from_cloud = function(cloard, chain) {
    "use strict";

    // This will get triggered whenever both hoards are
    // successfully loaded.
    console.debug("Merging from cloud hoard");
    Squirrel.suppress_update_events++;
    Squirrel.client_hoard.merge_from_cloud(
        cloard,
        Squirrel.play_action,
        function(conflicts) {
            Squirrel.suppress_update_events--;
            if (conflicts.length > 0) {
                var $dlg = $("#dlg_conflicts");
                $("#dlg_conflicts_message").empty();
                $.each(conflicts, function(i, c) {
                    var e = c.action;
                    $("<div></div>")
                        .text(Hoard.stringify_action(e)
                              + ": " + c.message)
                        .appendTo($dlg.children(".message"));
                });
                $dlg.dialog({
                    width: "auto"
                });
            }
            // Finished with the cloud hoard (for now)
            chain();
        });
};

// Determine if there are unsaved changes, and generate a warning
// message for the caller to use.
Squirrel.unsaved_changes = function() {
    "use strict";

    if (Squirrel.client_hoard.modified || Squirrel.cloud_is_empty) {

        var changed = "";
        $(".modified").each(function() {
            changed += "   " + $(this).attr("name") + "\n";
        });
        if (Squirrel.cloud_is_empty)
            changed += TX.tx("The Cloud store is empty") + "\n";
        return changed;
    }
    return null;
};

Squirrel.save_hoards = function() {
    "use strict";

    var $messy = $("<div class='notice'>"
                   + TX.tx("Saving....")
                   + "</div>");

    Squirrel.squeak($messy);

    var save_client = function() {
        Squirrel.client_store.write(
            JSON.stringify(Squirrel.client_hoard),
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
    },

    update_cloud_store = function(cloard) {
        cloard.actions = cloard.actions.concat(Squirrel.client_hoard.actions);
        Squirrel.cloud_store.write(
            JSON.stringify(cloard),
            function() {
                Squirrel.client_hoard.actions = [];
                Squirrel.client_hoard.last_sync = Date.now();
                $messy.append(
                    "<div class='notice'>"
                        + TX.tx("Saved in the Cloud")
                        + "</div>");
                Squirrel.cloud_is_empty = false;
                save_client();
            },
            function(e) {
                $messy.append(
                    "<div class='error'>"
                        + TX.tx("Failed to save in the Cloud")
                        + "<br>" + e + "</div>");
                save_client();
            });
    };

    // Reload and save the cloud hoard
    Squirrel.cloud_store.read(
        function(data) {
            var cloard;
            try {
                cloard = new Hoard(JSON.parse(data));
            } catch (e) {
                // We'll get here if decryption failed....
                Squirrel.squeak(TX.tx("Overwriting malformed cloud hoard")
                                + " (" + e + ")");
                cloard = new Hoard();
                Squirrel.cloud_is_empty = true;
            }
            if (!Squirrel.cloud_is_empty) {
                Squirrel.suppress_update_events++;
                Squirrel.client_hoard.merge_from_cloud(
                    cloard, Squirrel.play_action);
                Squirrel.suppress_update_events--;
            }
            if (Squirrel.client_hoard.modified || Squirrel.cloud_is_empty)
                update_cloud_store(cloard);
        },
        function(e) {
            if (e === AbstractStore.NODATA) {
                Squirrel.cloud_is_empty = true;
                var cloard = new Hoard();
                Squirrel.client_hoard.reconstruct_actions(
                    function(a, next) {
                        cloard.actions.push({
                            type: a.type,
                            time: a.time,
                            data: a.data,
                            path: a.path.slice()
                        });
                        next();
                    });
                update_cloud_store(cloard);
            } else {
                $messy.append(
                    "<div class='error'>"
                        + TX.tx("Failed to refresh from the Cloud")
                        * "<br>" + e + "</div>");
                save_client();
            }
        });
};

// Last in the initial hoard load sequence
Squirrel.hoards_loaded = function() {
    "use strict";

    $(window).on("beforeunload", function() {
        var us = Squirrel.unsaved_changes();
        if (us !== null) {
            us = TX.tx("You have unsaved changes")
                + "\n" + us
                + "\n" + TX.tx("Are you really sure?");
            return us;
        }
    });

    Squirrel.suppress_update_events--;

    Squirrel.update_save_button();
    Squirrel.update_tree();
    $(".unauthenticated").hide();
    $(".authenticated").show();
};

Squirrel.load_cloud_store = function() {
    "use strict";

    if (Squirrel.cloud_store) {
        console.debug("Reading cloud store");
        Squirrel.cloud_store.read(
            function(data) {
                var hoard;
                console.debug("Cloud store is ready " + this.identifier());
                try {
                    hoard = JSON.parse(data);
                } catch (e) {
                    Squirrel.squeak(TX.tx("Cloud hoard data is malformed")
                                    + ": " + e);
                    return;
                }
                Squirrel.get_updates_from_cloud(
                    new Hoard(hoard),
                    Squirrel.hoards_loaded);
            },
            function(e) {
                if (e === AbstractStore.NODATA) {
                    console.debug("Cloud store contains NODATA");
                    Squirrel.cloud_is_empty = true;
                    Squirrel.ui_yield(Squirrel.hoards_loaded);
                } else {
                    Squirrel.squeak(TX.tx("Cloud store error") + ": " + e);
                }
            });
    } else {
        Squirrel.hoards_loaded();
    }
};

Squirrel.load_client_store = function() {
    "use strict";

    Squirrel.client_store.read(
        function(data) {
            try {
                Squirrel.client_hoard = new Hoard(JSON.parse(data));
            } catch (e) {
                Squirrel.squeak(TX.tx("Client hoard data is malformed")
                                + ": " + e);
                return;
            }
            // If the cloud hoard had no data, force a save
            if (Squirrel.cloud_is_empty)
                Squirrel.client_hoard.modified = true;
            console.debug("Reconstructing UI tree from cache");
            Squirrel.client_hoard.reconstruct_actions(
                Squirrel.play_action,
                function() { // on complete
                    // Reset the UI modification list; we just loaded the
                    // client hoard
                    $(".modified").removeClass("modified");
                    Squirrel.ui_yield(Squirrel.load_cloud_store);
                });
        },
        function(e) {
            if (e === AbstractStore.NODATA) {
                console.debug("Client hoard contains NODATA");
                Squirrel.client_hoard = new Hoard();
                Squirrel.client_hoard.modified = true;
                Squirrel.ui_yield(Squirrel.load_cloud_store);
            } else {
                Squirrel.squeak(TX.tx("Client store error")
                                + ": " + e);
            }
        });
};

Squirrel.init_ui = function() {
    "use strict";

    $("#save_button")
        .button({
            icons: {
                primary: "silk-icon-disk"
            },
            text: false
        })
        .hide()
        .click(Squirrel.save_hoards);

    Squirrel.nodes[""] = $("#tree");

    $("#treeroot").bonsai({
        expandAll: false });

    $("#add_root_child")
        .button({
            icons: {
                primary: "silk-icon-add"
            },
            text: false
        })
        .click(function() {
            Squirrel.add_child_node($("#tree"), "New site");
        });

    $("#search")
        .change(function(/*evt*/) {
            Squirrel.search($(this).val());
        });
};

Squirrel.log_in_dialog = function(ok, fail, uReq, pReq) {
    "use strict";

    var $dlg = $("#dlg_login"),
    b = {},
    self = this,
    sign_in = function(/*evt*/) {
        $dlg.dialog("close");
        ok.call(self,
                uReq ? $("#dlg_login_user").val() : undefined,
                pReq ? $("#dlg_login_pass").val() : undefined);
    },
    $uReq = $("#dlg_login_uReq").toggle(uReq).find("input"),
    $pReq = $("#dlg_login_pReq").toggle(pReq).find("input");

    if (uReq && pReq) {
         $uReq.change(function() {
             $pReq.focus();
         });
         $pReq.change(sign_in);
    }
    else if (uReq)
        $uReq.change(sign_in);
    else if (pReq) {
        $("#dlg_login_foruser")
            .toggle(this.user !== null)
            .text(this.user || "");
        $pReq.change(sign_in);
    }

    b[TX.tx("Sign In")] = sign_in;
    $dlg.dialog({
        modal: true,
        width: "auto",
        buttons: b
    });
};

Squirrel.init_client_store = function() {
    "use strict";

    //Squirrel.ignore = new LocalStorageStore({
    new EncryptedStore({
        engine: LocalStorageStore,

        dataset: "Local Hoard",
        ok: function() {
            console.debug("Client store is ready: " + this.identifier());
            $("#whoami").text(this.user);
            Squirrel.client_store = this;
            $(".unauthenticated").text(TX.tx("Loading..."));
            Squirrel.ui_yield(Squirrel.load_client_store);
        },
        fail: function(e) {
            // We did our best!
            Squirrel.squeak(TX.tx("Failed ") + e);
        },
        identify: function(ok, fail, uReq, pReq) {
            // Won't ever get here unless uReq || pReq
            if (uReq && Squirrel.cloud_store
                && typeof Squirrel.cloud_store.user !== "undefined") {

                uReq = false; // user is in cloud store

                if (pReq) {
                    if (Squirrel.cloud_store
                         && typeof Squirrel.cloud_store.pass !== "undefined") {
                        // The cloud store loaded OK, we will re-use the
                        // password for the client store
                        ok.call(this,
                                Squirrel.cloud_store.user,
                                Squirrel.cloud_store.pass);
                        return;
                    } else {
                        // The cloud store loaded but didn't require a
                        // password. SMELL: as they are both Encrypted,
                        // this should never happen.
                        console.debug("I didn't expect to have to prompt for a client password");
                        $("#dlg_login_user").val(
                            Squirrel.cloud_store.user);
                        // Fall through to prompt for password
                    }
                } else {
                    ok.call(this, Squirrel.cloud_store.user);
                    return;
                }
            } else if (Squirrel.cloud_store
                       && typeof Squirrel.cloud_store.pass !== "undefined") {
                if (!uReq) {
                    // We were only asked for a password.
                    ok.call(this, undefined, Squirrel.cloud_store.pass);
                    return;
                }
                // Fall through to prompt for the username
                $("#dlg_login_pass").val(
                    Squirrel.cloud_store.pass);
                pReq = false;
            }
            Squirrel.log_in_dialog.call(this, ok, fail, uReq, pReq);
        }
    });
};

Squirrel.init_cloud_store = function() {
    "use strict";

    var params = {
        dataset: "Cloud Hoard",
        ok: function() {
            Squirrel.cloud_store = this;
            Squirrel.init_client_store();
        },
        fail: function(/*e*/) {
            Squirrel.squeak(TX.tx("Could not contact cloud store"));
            Squirrel.init_client_store();
        },
        identify: Squirrel.log_in_dialog
    };

    if (typeof DropboxStore !== "undefined") {
        console.debug("Using Dropbox for the Cloud");
        params.engine = DropboxStore; // Uncomment the one you want to use
    } else if (typeof GoogleDriveStore !== "undefined") {
        console.debug("Using Google Drive for the Cloud");
        params.engine = GoogleDriveStore;
    } else {
        console.debug("Using LocalStorage for the Cloud");
        params.engine = LocalStorageStore;
        params.uReq = true;
    }

    // Disable update events until the hoards are loaded and updated
    Squirrel.suppress_update_events++;

//  new params.engine(params);
    new EncryptedStore(params);
};

(function ($) {
    "use strict";

    $(document)
        .ready(function() {
            // Initialise UI components
            Squirrel.init_ui();
            // Initialise translation module
            TX.init(Squirrel.init_cloud_store);
        })
    .on("update_save_button", Squirrel.update_save_button);

})(jQuery);
