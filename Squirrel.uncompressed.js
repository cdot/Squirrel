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
var zeroclipboard;

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

function last_mod(time) {
    "use strict";

    var d = new Date(time);
    return TX("Double-click to edit. Last modified: ") + d.toLocaleString();
}

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
                        $("#tree").bonsai("update");
                    });
            }
        }});
}

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
                        $("#tree").bonsai("update");
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

// Action on double-clicking a tree entry - rename
function change_key($span) {
    "use strict";
    inplace_edit($span, "R");
    // Re-sort?
}

// Action on double-clicking a tree entry - revalue
function change_value($span) {
    "use strict";

    inplace_edit($span, "E");
}

function copy_to_clipboard(data) {
    "use strict";
    var copyEvent = new ClipboardEvent(
        'copy',
        {
            dataType: 'text/plain',
            data: data
        }
    );
    document.dispatchEvent(copyEvent);
}

// Make a case-insensitive selector
/*
$.expr[":"].contains = $.expr.createPseudo(function(arg) {
    "use strict";

    return function( elem ) {
        return $(elem).text().toUpperCase().indexOf(arg.toUpperCase()) >= 0;
    };
});
*/

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

function add_new_child($ul) {
    "use strict";

    var $dlg = $("#dlg_add_node");
    var p = get_path($ul);
    $dlg.dialog({
        width: "auto",
        modal: true,
        buttons: {
            "Add Value": function(evt) {
                $(this).dialog("close");
                p.push(TX("New value"));
                client_hoard.play_action(
                    {
                        type: "N",
                        path: p,
                        data: "None"
                    },
                    function(e) {
                        play_action(e);
                        $("#tree").bonsai("update");
                    });
            },
            "Add Sub-tree": function(evt) {
                $(this).dialog("close");
                p.push(TX("New sub-tree"));
                client_hoard.play_action(
                    {
                        type: "N",
                        path: p
                    },
                    function(e) {
                        play_action(e);
                        $("#tree").bonsai("update");
                    });
            }
        }});
}

function node_clicked() {
    "use strict";

    var $div = $(this);
    $(".selected")
        .removeClass("selected")
        .find(".item_button").remove();
    $div.addClass("selected");
    if ($div.hasClass("treecollection")) {
        var $adder = $("<button></button>")
            .addClass("icon_button item_button")
            .button({
                icons: {
                    primary: "silk-icon-add"
                },
                text: false
            })
            .attr("title", TX("Add new child node"))
            .click(function() {
                add_new_child($div.closest("li").find("ul").first());
            });
        $div.append($adder);
    } else {
        var $val = $div.children('.value');
        var $copier =  $("<button></button>")
            .addClass("icon_button item_button")
            .button({
                icons: {
                    primary: "silk-icon-camera"
                },
                text: false
            })
            .attr("title", TX("Copy value to clipboard"));
        $div.append($copier);
        zeroclipboard = new ZeroClipboard($copier)
            .on("copy", function(e) {
                var cb = e.clipboardData;
                cb.setData("text/plain", $val.text());
            });
    }
    var $killer = $("<button></button>")
        .addClass("icon_button item_button")
        .button({
            icons: {
                primary: "silk-icon-delete"
            },
            text: false
        })
        .attr("title", TX("Delete this node"))
        .click(function() {
            confirm_delete($div.closest("li"));
        });
    $div.append($killer);
}

function update_save_button() {
    $('#save_button').toggle(
        client_hoard.modified
            || (cloud_hoard && cloud_hoard.modified)
            || $(".modified").length > 0
    );
}

// Callback for use when managing hoards; plays an action that is being
// played into the hoard into the DOM as well.
function play_action(e) {
    "use strict";

    //console.log("Playing " + e.type + " @" + new Date(e.time)
    //            + " " + e.path.join("/")
    //            + (typeof e.data !== 'undefined' ? " " + e.data : ""));

    var $parent_ul = $("#tree");

    // Locate the parent of the node who's path we are given
    for (var i = 0; i < e.path.length - 1; i++) {
        $parent_ul = $parent_ul.find("li[data-key='" + quotemeta(e.path[i]) + "'] > ul");
    }

    var key = e.path[e.path.length - 1];

    if (e.type === "N") {
        var $li = $("<li></li>")
            .attr("data-key", key)
            .attr("name", key)
            .addClass("modified")
            .attr("title", last_mod(e.time));

        var $div = $("<div></div>")
            .addClass("node_div")
            .click(node_clicked);
        $li.append($div);

        var $keyspan = $("<span class='key'>" + key + "</span>");
        $keyspan.dblclick(function() {
            // in-place editor
            change_key($(this));
        });
        $div.append($keyspan);

        if (typeof e.data !== "undefined" && e.data !== null) {
            $div.addClass("treeleaf");
            var $valspan = $("<span class='value'>" + e.data + "</span>");
            $valspan.dblclick(function() {
                // in-place editor
                change_value($(this));
            });
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

    } else if (e.type === "R") {
        $parent_ul
            .children("li[data-key='" + quotemeta(key) + "']")
            .attr("data-key", e.data)
            .addClass("modified")
            .attr("title", last_mod(e.time))
            .children(".node_div")
            .children("span.key")
            .text(e.data);
        // TODO: re-sort
    } else if (e.type === "E") {
        $parent_ul
            .children("li[data-key='" + quotemeta(key) + "']")
            .addClass("modified")
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
            .addClass("modified")
            .attr("title", last_mod(e.time));
    } else {
        throw "Unrecognised action '" + e.type + "'";
    }
    update_save_button();
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
                // Reset the modification count; we just loaded the
                // client hoard
                $(".modified").removeClass("modified");
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
                $("#tree").bonsai("update");
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
        || cloud_hoard && cloud_hoard.modified
        || $('.modified').length > 0) {

        var changed = '';
        $('.modified').each(function() {
            changed += '   ' + $(this).attr("name") + '\n';
        });
        return TX("You have unsaved changes") + "\n"
            + changed
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
                            $(".modified").removeClass("modified");
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
