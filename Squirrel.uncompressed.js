// TODO:
// Synch with Drive
// Hide extra functions in a twisty
/*
Local cache - executed up to a point
Script beyond that point

Remote - script.

Local cache built from script
Tabs built from local cache

*/
var client_store;
var cloud_store;
var client_hoard;
var cloud_hoard;

function gapi_loaded() {
    "use strict";

    console.log("Google API loaded");
/*
    if (!cloud_store) {
        cloud_store = new GoogleDriveStore(
            "985219699584-mt1do7j28ifm2vt821d498emarmdukbt.apps.googleusercontent.com");
        cloud_store = new EncryptedStore(client_store);
    }
*/
}

// Generate taphold events on platforms that don't natively support them
$.fn.linger = function() {

    var eventType = {
        mousedown: 'ontouchstart' in window ? 'touchstart' : 'mousedown',
        mouseup: 'ontouchend' in window ? 'touchend' : 'mouseup'
    };
    return this.each(function() {
        var timeout;
        $(this)
            .on(eventType.mousedown + '.linger', function(e) {
                timeout = window.setTimeout(function() {
                    $(e.currentTarget).trigger("taphold");
                }, 1000)
                return false; // stop bubble
            })
            .on(eventType.mouseup + '.linger', function(e) {
                window.clearTimeout(timeout);
            })
            .on(eventType.click + '.linger', function(e) {
                window.clearTimeout(timeout);
            })
            .on('contextmenu.linger', function(e) {
                window.clearTimeout(timeout);
            });
    });
};

// Generate a new password subject to constraints:
// length: length of password
// charset: characters legal in the password. Ranges can be defined using
// A-Z syntax.
function generate_password(constraints) {
    if (typeof constraints.length === 'undefined') {
        constraints.length = 24;
    }
    if (typeof constraints.charset === 'undefined') {
        constraints.charset = 'A-Za-z0-9';
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
    return s
}

// Reconstruct the tree path from the DOM
function get_path($node) {
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
function quotemeta(s) {
    return s.replace(/([\][!"#$%&'()*+,.\/:;<=>?@\\^`{|}~])/g, "\\$1");
}

// Generate a message for the last modified time
function last_mod(time) {
    "use strict";

    var d = new Date(time);
    return TX("Last modified: ") + d.toLocaleString() + " "
        + TX("Click and hold to open menu");
}

// Confirm deletion of a node
function confirm_delete($node) {
    "use strict";

    var $dlg = $("#dlg_confirm_delete");
    $dlg.find(".message").text(get_path($node).join("/"));
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
                    { type: "D", path: get_path($node) },
                    function(e) {
                        play_action(e);
                        update_tree();
                    });
            }
        }});
}

// Update the tree view
function update_tree() {
    $("#tree")
        .bonsai("update")
        .contextmenu({
            delegate: ".node_div",
            menu: [
                {
                    // Need the area that handles this to be covered with
                    // the zeroclipboard
                    title: TX("Copy value"),
                    cmd: "copy",
                    uiIcon: "silk-icon-camera"
                },
                {
                    title: TX("Rename"),
                    cmd: "rename",
                    uiIcon: "silk-icon-pencil" 
                },
                {
                    title: TX("Edit value"),
                    cmd: "edit",
                    uiIcon: "silk-icon-comment-edit" 
                },
                {
                    title: TX("Generate new password"),
                    cmd: "generate_password",
                    uiIcon: "silk-icon-bullet-key" 
                },               
                {
                    title: TX("Add new value"),
                    cmd: "add_value",
                    uiIcon: "silk-icon-comment-add" 
                },
                {
                    title: TX("Add new sub-tree"),
                    cmd: "add_subtree",
                    uiIcon: "silk-icon-chart-organisation-add" 
                },
                {
                    title: TX("Delete"),
                    cmd: "delete",
                    uiIcon: "silk-icon-delete" 
                }
            ],
            beforeOpen: function(e, ui) {
                var $div, isvalue, $el, client;
                if (ui.target.is(".node_div"))
                    $div = ui.target;
                else
                    $div = ui.target.parents('.node_div').first();

                isvalue = ($div.children('.value').length > 0);
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
                            $div.children('.value').text());
                    });
                }
            },
            // We map long mouse hold to taphold in the plugin above
            // Right click still works
            taphold: true,
            select: node_tapheld
        });
}

// Edit a span in place
function inplace_edit($span, action) {
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
                var old_path = get_path($span);
                client_hoard.play_action(
                    { type: action,
                      path: old_path,
                      data: val },
                    function(e) {
                        play_action(e);
                        update_tree();
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
function add_child_node($div, title, value) {
    var $li = $div.parents("li").first();
    var $ul = $li.parent();
    $ul.bonsai("expand", $li);

    var p = get_path($div);
    var action = {
        type: "N",
        path: p
    };
    if (typeof(value) !== 'undefined') {
        action.data = value;
    }
    p.push(title);
    client_hoard.play_action(
        action,
        function(e) {
            var $n = play_action(e);
            // Want the result of the action play to grab the focus?
            update_tree();
            inplace_edit($n);
        });
}

// Dialog password generation
function make_password(set) {
    var $dlg = $("#dlg_gen_password");
    var buttons = {};
    var opts = {
        length: $dlg.find(".pw_length").val(),
        charset: $dlg.find(".pw_chars").val()
    };

    buttons[TX("Use this")] = function() {
        $dlg.dialog("close");
        var pw = $dlg.find(".pw").text();
        set.call(this, pw);
    };
    buttons[TX("Try again")] = function() {
        opts.length = $dlg.find(".pw_length").val();
        opts.charset = $dlg.find(".pw_chars").val();
        $dlg.find(".pw").text(generate_password(opts));
    };
    buttons[TX("Forget it")] = function() {
        $dlg.dialog("close");
    };

    $dlg.find(".pw").text(generate_password(opts));

    $dlg.dialog({
        width: "auto",
        modal: true,
        buttons: buttons});
}

// Convert a path to an HTTP fragment
function fragment_id(path) {
    "use strict";

    var fid = path.join(":");
    return fid.replace(/[^A-Za-z0-9:_]/g, function(m) {
        return m.charCodeAt(0);
    });
}

function search(s) {
    "use strict";

    var $sar = $("#search_results");
    $sar.empty();
    var re = new RegExp(s, "i");
    $(".key").each(function() {
        if ($(this).text().match(re)) {
            var $li = $(this).closest("li");
            var path = get_path($li);
            var $res = $("<a></a>");
            $res
                .attr("href", "#" + fragment_id(path))
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
function node_tapheld(e, ui) {
    var $li = ui.target.parents("li").first();
    var $div = $li.children('.node_div');
    if (ui.cmd === 'copy') {
        //console.log("Copying to clipboard");
        ZeroClipboard.setData($div.children('.value').text());
    }
    else if (ui.cmd === "rename") {
        //console.log("Renaming");
	inplace_edit($div.children('.key'), "R");
    }
    else if (ui.cmd === "edit") {
        //console.log("Editing");
	inplace_edit($div.children('.value'), "E");
    }
    else if (ui.cmd === "add_value") {
        //console.log("Adding value");
        add_child_node($div, TX("New value"), TX("None"));
    }
    else if (ui.cmd === "add_subtree") {
        //console.log("Adding subtree");
        add_child_node($div, TX("New sub-tree"));
    }
    else if (ui.cmd === "generate_password") {
        make_password(function(pw) {
            $div.children('.value').text(pw);
        });
    }
    else if (ui.cmd === "delete") {
        confirm_delete($div);
    }
    else {
        throw "Unknown ui.cmd " + ui.cmd;
    }
}

// Update the save button based on hoard state
function update_save_button() {
    $('#save_button').toggle(
        client_hoard.modified
            || (cloud_hoard && cloud_hoard.modified)
    );
}

// Callback for use when managing hoards; plays an action that is being
// played into the hoard into the DOM as well.
function play_action(e) {
    "use strict";

    //console.log("Playing " + e.type + " @" + new Date(e.time)
    //            + " " + e.path.join("/")
    //            + (typeof e.data !== 'undefined' ? " " + e.data : ""));

    var $parent_ul = $("#tree"), key, $li, $div, menu, $keyspan, $valspan;

    // Locate the parent of the node who's path we are given
    for (var i = 0; i < e.path.length - 1; i++) {
        $parent_ul = $parent_ul.find("li[data-key='" + quotemeta(e.path[i]) + "'] > ul");
    }

    key = e.path[e.path.length - 1];

    if (e.type === "N") {
        $li = $("<li></li>")
            .attr("data-key", key)
            .attr("name", key)
            .attr("title", last_mod(e.time));

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
        $li.prepend($("<a></a>").attr("name", fragment_id(get_path($li))));

        // Enable taphold events
        $div
            .linger()
            .click(function() {
            });

    } else if (e.type === "R") {
        $parent_ul
            .children("li[data-key='" + quotemeta(key) + "']")
            .attr("data-key", e.data)
            .attr("title", last_mod(e.time))
            .children(".node_div")
            .children("span.key")
            .text(e.data);
        // TODO: re-sort
    } else if (e.type === "E") {
        $parent_ul
            .children("li[data-key='" + quotemeta(key) + "']")
            .attr("title", last_mod(e.time))
            .children(".node_div")
            .children("span.value")
            .text(e.data);
    } else if (e.type === "D") {
        $parent_ul
            .children("li[data-key='" + quotemeta(e.path[i]) + "']")
            .remove();
        $parent_ul
            .parents("li")
            .first()
            .attr("title", last_mod(e.time));
    } else {
        throw "Unrecognised action '" + e.type + "'";
    }
    update_save_button();

    return $keyspan;
}

function log_in() {
    "use strict";

    var user, pass, confirm_password, registration_dialog, offer_registration,
    load_attempted, hoard_loaded, logged_in_to_client;

    // Callback invoked when either of the client or cloud hoards
    // is loaded
    load_attempted = { client: false, cloud: false };

    hoard_loaded = function(hoard, error) {
        if (error) {
            console.log(error);
        } else {
            console.log(hoard + " hoard loaded");

            if (client_hoard && !load_attempted.client) {
                //console.log("Reconstructing actions from cache");
                client_hoard.reconstruct(play_action);
                // Reset the modification flag; we just loaded the
                // client hoard
                client_hoard.modified = false;
            }
            if (client_hoard && cloud_hoard) {
                $("#unauthenticated").loadingOverlay("remove");
                $("#unauthenticated").loadingOverlay({
                    loadingText: TX("Updating...") });
                //console.log("Synching with cloud");
                var conflicts = [];
                client_hoard.stream_to_cache(
                    cloud_hoard, play_action, conflicts);

                if (conflicts.length > 0) {
                    var $dlg = $('#dlg_conflicts');
                    $dlg.children('.message').empty();
                    $.each(conflicts, function(i, c) {
                        var e = c.action;
                        $("<div></div>")
                            .text(
                                e.type + ":" + e.path.join("/")
                                    + (typeof e.data !== 'undefined' ?
                                       " " + e.data : "")
                                    + " @" + new Date(e.time)
                                    + ": " + c.message)
                            .appendTo($dlg.children(".message"))
                    });
                    $dlg.dialog({
                        width: "auto"
                    });
                }
            }
        }
        load_attempted[hoard] = true;
        if (load_attempted.client && load_attempted.cloud) {
            // Finished
            $("#unauthenticated").loadingOverlay("remove");
            if (client_hoard) {
                update_save_button();
                update_tree();
                $("#unauthenticated").hide();
                $("#authenticated").show();
            }
        }
    };

    // We are logged in (or freshly registered) with the local store
    // If we haven't already logged in to the cloud store, do so now.
    logged_in_to_client = function() {
        console.log("'" + client_store.user + "' is logged in to client store");
        $("#whoami").text(client_store.user);
        console.log("Loading client hoard");
        client_hoard = new Hoard(client_store.data);
        hoard_loaded("client");
    };

    // Confirm that we want to register by re-entering password
    confirm_password = function() {
        var $dlg = $("#dlg_confirm_pass"),
        buttons = {};
        $dlg.find(".message").hide();
        $dlg.find("#userid").text(user);

        buttons[TX("Confirm")] = function(evt) {
            var cpass = $("#confirm_password").val();
            if (cpass === pass) {
                $dlg.dialog("close");
                // We want to register; create the new registration in the
                // client drive
                client_store.register(
                    user, pass,
                    function() {
                        logged_in_to_client();
                    },
                    function(e) {
                        var $dlg = $("#dlg_alert");
                        $dlg.children(".message").text(e);
                        $dlg.dialog({
                            modal: true
                        });
                    }
                );
            } else {
                $("#password_mismatch").show();
                $("#show_password").button().click(function() {
                    $dlg.find("#passwords")
                        .text(pass + TX(" and ") + cpass)
                        .show();
                });
            }
        };
        buttons[TX("Cancel")] = function() {
            $dlg.dialog("close");
        };

        $dlg.dialog({
            width: "auto",
            modal: true,
            buttons: buttons});
    };

    // Registration is being offered for the reason shown by clss.
    registration_dialog = function(message) {
        var $dlg = $("#dlg_register"), buttons = {};
        $dlg.find(".message").hide();
        $dlg.find("." + message).show();
        buttons[TX("Yes")] = function(evt) {
            $dlg.dialog("close");
            // We want to register; create the new registration in the
            // local drive
            console.log("Registration selected. Confirming password");
            confirm_password();
        };
        buttons[TX("No")] = function(evt) {
            $dlg.dialog("close");
            // No local store registration; we can't do any more
        };
        $dlg.dialog({
            modal: true,
            buttons: buttons});
    };

    // The local store didn't allow login using this pass. See if the
    // user wants to register
    offer_registration = function() {
        if (cloud_store) {
            // Remote store is there; see if it has the user
            cloud_store.log_in(
                user, pass,
                function() {
                    console.log("Checking Remote Store");
                    registration_dialog("existing_hoard");
                },
                function(message) {
                    registration_dialog("unknown_user");
                });
        } else {
            registration_dialog("cant_connect");
        }
    };

    user = $("#user").val();
    pass = $("#password").val();
    if (!pass || pass === "") {
        var $dlg = $("#dlg_alert");
        var $messy = $dlg.children(".message");
        $messy.html("<div class='warning'>" +
                    TX("Empty password not permitted")
                    + "</div>");
        $dlg.dialog({
            modal: true
        });
        return false;
    }

    $("#unauthenticated").loadingOverlay({ loadingText: TX("Signing in...") });

    //console.log("Log in to stores");
    client_store.log_in(
        user, pass,
        function() {
            logged_in_to_client();
        },
        function(e) {
            console.log(e + "; Local store rejected password. Offering registration");
            offer_registration();
        });
    if (cloud_store) {
        cloud_store.log_in(
            user, pass,
            function() {
                console.log("'" + cloud_store.user
                            + "' is logged in to cloud store");
                cloud_hoard = new Hoard(cloud_store.data);
                hoard_loaded("cloud");
            },
            function(e) {
                hoard_loaded("cloud", "Cloud store rejected password.");
            });
    }
}

// Determine if there are unsaved changes, and generate a warning
// message for the caller to use.
function unsaved_changes() {
    if (client_hoard && client_hoard.modified
        || cloud_hoard && cloud_hoard.modified) {
        return TX("You have unsaved changes") + "\n"
            +  TX("Are you really sure?");
    }
}

// Clear down
function log_out() {
    $("#tree").empty();
    $("#authenticated").hide();
    $("#unauthenticated").show();
    client_store.log_out();
    client_hoard = null;
    if (cloud_store) {
        cloud_store.log_out();
        cloud_hoard = null;
    }
}

(function ($) {
    "use strict";

    var ready = function() {
        client_store = new LocalStorageStore("client/");
        //client_store = new EncryptedStore(client_store);

        client_store = new LocalStorageStore();

        // Log in
        $("#log_in").
            button({
                icons: {
                    primary: "silk-icon-lock-open"
                }
            })
            .click(log_in);
        $("#password")
            .change(log_in);

        $("#log_out")
            .button({
                icons: {
                    primary: "silk-icon-lock"
                }
            })
            .click(function() {
                var mess = unsaved_changes();
                if (mess) {
                    if (window.confirm(mess)) {
                        log_out();
                    }
                } else {
                    log_out();
                }
            });

        $("#save_button")
            .button({
                icons: {
                    primary: "silk-icon-disk"
                },
                text: false
            })
            .hide()
            .click(function() {
                var $dlg = $("#dlg_alert");
                var $messy =  $dlg.children(".message");
                $messy.html("<div class='notice'>"
                            + TX("Saving....")
                            + "</div>");
                $dlg.dialog({
                    modal: true
                });
                if (client_hoard.modified) {
                    client_hoard.save(
                        client_store,
                        function() {
                            $messy.append(
                                "<div class='notice'>"
                                    + TX("Saved in this browser")
                                    + "</div>");
                        },
                        function(e) {
                            $messy.append(
                                "<div class='warn'>"
                                + TX("Failed to save in the browser: ") + e
                                    + "</div>");
                        });
                } else {
                    $messy.append(
                        "<div class='notice'>"
                            + TX("Nothing to save in the browser")
                            + "</div>");
                }
                if (cloud_hoard && cloud_hoard.modified) {
                    // TODO: check that the cloud hoard hasn't changed
                    // since we last synched
                    cloud_hoard.save(
                        cloud_store,
                        function() {
                            if (!client_hoard.modified) {
                                client_store.actions = [];
                            }
                            $messy.append(
                                "<div class='notice'>"
                                    + TX("Saved in the Cloud")
                                    + "</div>");
                        },
                        function(e) {
                            $messy.append(
                                "<div class='warning'>"
                                    + TX("Cloud save failed: ") + e
                                    + "</div>");
                        });
                }
                else {
                    if (!client_hoard.modified) {
                        client_store.actions = [];
                    }
                    $messy.append(
                        "<div class='notice'>"
                            + TX("Nothing to save to the Cloud")
                            + "</div>");
                }
                update_save_button();
            });

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

    $(document).ready(function() {
        // Initialise translation module
        init_Translation("en", function() {
            /*
            // Development - init from file on disk
            var $dlg = $("#init_store");
            $dlg.dialog({
                modal: true,
                width: "500px",
                buttons: {
                    "Continue": function() {
                        $dlg.dialog("close");
                        cloud_store = new FileStore($("#init_store_pick")[0].files[0]);
                        ready();
                    }
                }
            });
            */
            cloud_store = new LocalStorageStore("cloud/");
            ready();
        });
    });

    $(window).on('beforeunload', function() {
        return unsaved_changes();
    });
})(jQuery);
