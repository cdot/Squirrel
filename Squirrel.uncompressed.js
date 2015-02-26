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

const SQUIRREL_LOG = true;

function log(e) {
    if (SQUIRREL_LOG)
        console.log(e);
}

function gapi_loaded() {
    "use strict";
/*
    log("Google API loaded");
    if (!cloud_store) {
    var gstore = new GoogleDriveStore(
    "985219699584-mt1do7j28ifm2vt821d498emarmdukbt.apps.googleusercontent.com");
    cloud_store = new EncryptedStore(gstore);
    $(document).trigger("cloud_store_ready");
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

function squeak(e) {
    var $dlg = $("#dlg_alert");
    if (typeof(e) === 'string')
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
        //log("Copying to clipboard");
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
        //log("Adding value");
        add_child_node($div, TX("New value"), TX("None"));
    }
    else if (ui.cmd === "add_subtree") {
        //log("Adding subtree");
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
    $('#save_button').toggle(client_hoard.is_modified());
}

// Callback for use when managing hoards; plays an action that is being
// played into the hoard into the DOM as well.
function play_action(e) {
    "use strict";

    //log("Playing " + e.type + " @" + new Date(e.time)
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

function get_updates_from_cloud(cloard) {
    // This will get triggered whenever both hoards are
    // successfully loaded.
    log("Merging from cloud hoard");
    var conflicts = [];
    client_hoard.merge_from_cloud(
        cloard, play_action, conflicts);
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
    // Finished with the cloud hoard (for now)
    update_save_button();
    update_tree();
}

function log_in() {
    "use strict";

    // Confirm that we want to register by re-entering password
    var confirm_password = function() {
        var $dlg = $("#dlg_confirm_pass"),
        buttons = {};
        $dlg.find(".message").hide();
        $dlg.find("#userid").text(user);

        buttons[TX("Confirm")] = function(evt) {
            var cpass = $("#confirm_password").val();
            if (cpass === pass) {
                $dlg.dialog("close");
                // We want to register; create the new registration in the
                // client store
                client_store.register(
                    user, pass,
                    function() {
                        $(document).trigger("logged_in_to_client");
                    },
                    squeak);
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
    },

    // Registration is being offered for the reason shown by clss.
    registration_dialog = function(message) {
        var $dlg = $("#dlg_register"), buttons = {};
        $dlg.find(".message").hide();
        $dlg.find("." + message).show();
        buttons[TX("Yes")] = function(evt) {
            $dlg.dialog("close");
            // We want to register; create the new registration in the
            // local drive
            log("Registration selected. Confirming password");
            confirm_password();
        };
        buttons[TX("No")] = function(evt) {
            $dlg.dialog("close");
            // No local store registration; we can't do any more
        };
        $dlg.dialog({
            modal: true,
            buttons: buttons});
    },

    // The local store didn't allow login using this pass. See if the
    // user wants to register
    offer_client_registration = function() {
        log("Offering client registration");
        // See if remote store has the user
        cloud_store.log_in(
            user, pass,
            function() {
                log("Checking Remote Store");
                registration_dialog("existing_hoard");
            },
            function(message) {
                registration_dialog("unknown_user");
            });
    },

    register_in_cloud = function() {
        // Create new user in the cloud, initialising it from
        // the client hoard.
        cloud_store.register(
            user, pass,
            function() {
                var acts = [];
                client_hoard.reconstruct_actions(function(a) {
                    acts.push(a);
                });
                cloud_store.data = new Hoard(
                    {
                        last_sync: null,
                        actions: acts,
                        cache: null
                    });
                cloud_store.save(
                    function () {
                        log("Cloud saved");
                        $(document).trigger(
                            "hoard_loaded", "cloud", cloud_store.data);
                    },
                    function(e) {
                        log("Cloud save failed: " + e);
                    });
            },
            squeak);
    },

    cloud_hoard = null,

    cloud_hoard_loaded = function() {
        log("Cloud hoard loaded");
        if (client_hoard) {
            get_updates_from_cloud(cloud_hoard);
            cloud_hoard = null;
        }
    },

    client_hoard_loaded = function() {
        // Callback invoked when either of the client or cloud hoards
        // is loaded. Effectively a join.
        log("Client hoard loaded");

        var autosave = (client_hoard.last_sync === null
                        && client_hoard.cache === null);

        log("Reconstructing UI tree from cache");
        // Use reconstruct_actions to drive creation of
        // the UI
        client_hoard.reconstruct_actions(play_action);
        // Reset the UI modification list; we just loaded the
        // client hoard
        $(".modified").removeClass("modified");
    
        if (cloud_hoard) {
            get_updates_from_cloud(cloud_hoard);
            cloud_hoard = null;
        }
    
        $("#unauthenticated").loadingOverlay("remove");
        update_save_button();
        update_tree();
        $("#unauthenticated").hide();
        $("#authenticated").show();
        if (autosave) {
            // Client store had no data, so do an initial save
            client_store.data = client_hoard;
            client_store.save(
                function() {
                    log("Client store initial save");
                },
                function(e) {
                    log("Client store initial save failed: " + e);
                });
        }
    },

    user = $("#user").val(),
    pass = $("#password").val();

    // We are logged in (or freshly registered) with the local store
    // If we haven't already logged in to the cloud store, do so now.
    $(document)
        .on("logged_in_to_client", function() {
            log("'" + client_store.user + "' is logged in to client store");
            $("#whoami").text(client_store.user);
            client_hoard = new Hoard(client_store.data);
            client_hoard_loaded(client_hoard);
        })
        .on("logged_in_to_cloud", function() {
            log("'" + cloud_store.user
                + "' is logged in to cloud store");
            cloud_hoard = new Hoard(cloud_store.data);
            cloud_hoard_loaded();
        });

    if (!pass || pass === "") {
        squeak("<div class='warning'>" +
               TX("Empty password not permitted")
               + "</div>");
        return false;
    }

    $("#unauthenticated").loadingOverlay({ loadingText: TX("Signing in...") });

    log("Log in to client store");

    client_store.log_in(
        user, pass,
        function() {
            $(document).trigger("logged_in_to_client");
        },
        function(e) {
            log("Local store rejected login: " + e);
            if (e === client_store.UDNE) {
                offer_client_registration();
            } else {
                squeak(e);
            }
        });

    log("Log in to cloud store");
    cloud_store.log_in(
        user, pass,
        function() {
            $(document).trigger("logged_in_to_cloud");
        },
        function(e) {
            if (e === cloud_store.UDNE) {
                log("'" + user
                    + "' does not exist in cloud; registering")
                register_in_cloud();
            } else {
                squeak(e);
            }
        });
}

// Determine if there are unsaved changes, and generate a warning
// message for the caller to use.
function unsaved_changes() {
    if (client_hoard && client_hoard.is_modified()) {

        var changed = '';
        $('.modified').each(function() {
            changed += '   ' + $(this).attr("name") + '\n';
        });
        return TX("You have unsaved changes") + "\n"
            +  TX("Are you really sure?");
    }
}

// Clear down
function log_out() {
    $("#tree").empty();
    $("#authenticated").hide();
    $("#unauthenticated").show();
    client_hoard = null;
}

function save_hoards() {
    var $messy = $("<div class='notice'>"
                   + TX("Saving....")
                   + "</div>");
    squeak($messy);

    var save_client = function() {
        client_store.data = client_hoard;
        client_store.save(
            function() {
                $(".modified").removeClass("modified");
                $messy.append(
                    "<div class='notice'>"
                        + TX("Saved in this browser")
                        + "</div>");

                update_save_button();
            },
            function(e) {
                $messy.append(
                    "<div class='warn'>"
                        + TX("Failed to save in the browser: ") + e
                        + "</div>");

                update_save_button();
            });
    };

    // Reload and save the cloud hoard
    cloud_store.refresh(
        function() {
            var conflicts = [];
            var cloard = new Hoard(cloud_store.data);
            client_hoard.merge_from_cloud(
                cloard, play_action, conflicts);
            if (client_hoard.is_modified()) {
                cloard.actions =
                    cloard.actions.concat(client_hoard.actions);
                cloud_store.data = cloard;
                cloud_store.save(
                    function() {
                        client_hoard.actions = [];
                        client_hoard.last_sync =
                            new Date().valueOf();
                        $messy.append(
                            "<div class='notice'>"
                                + TX("Saved in the Cloud")
                                + "</div>");
                        save_client();
                    },
                    function(e) {
                        $messy.append(
                            "<div class='error'>"
                                + TX("Failed to save in the Cloud")
                                + "<br>" + e + "</div>");
                        save_client();
                    });
            }
        },
        function(e) {
            $messy.append(
                "<div class='error'>"
                    + TX("Failed to refresh from the Cloud")
                    * "<br>" + e + "</div>");
            save_client();
        });
}

(function ($) {
    "use strict";

    var ready = function() {
        client_store = new LocalStorageStore("client/");
        log("Client store is ready");
        //client_store = new EncryptedStore(client_store);
        //client_store = new LocalStorageStore();

        $(document)
            .on("cloud_store_ready", function() {
                log("Cloud store is ready, waiting for login");
                $("#password,#user").removeAttr("disabled");
                $("#log_in").button("option", "disabled", false);
            });

        // Log in
        $("#log_in")
            .button({
                icons: {
                    primary: "silk-icon-lock-open"
                },
                disabled: true
            })
            .click(log_in);

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
            .click(save_hoards);

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
            $(document).trigger("cloud_store_ready");
        });
    });

    $(window).on('beforeunload', function() {
        return unsaved_changes();
    });
})(jQuery);
