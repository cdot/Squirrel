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
var chosen_language="en";
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
    return s.replace(/([][!"#$%&'()*+,.\/:;<=>?@\\^`{|}~])/g, "\\\\$1");
}

function getstring(s) {
    return $('#strings > .' + s).text();
}

function last_mod(time) {
    "use strict";

    var d = new Date(time);
    return getstring("lastmod") + d.toLocaleString();
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
                    play_action);
            }
        }});
}

// Action on double-clicking a tree entry - rename
function change_key($node) {
    "use strict";

    var h = $node.parent().css("height");
    $node.hide();
    var $input = $("<input class='renamer' id='renamer'/>");
    $input
        .addClass("renamer")
        .attr("id", "renamer")
        .val($node.text())
        .css("height", h)
        .insertBefore($node)
        .change(function() {
            if ($input.val() !== $node.text()) {
                var old_path = get_path($node);
                client_hoard.play_action(
                    { type: "R",
                      path: old_path,
                      data: $input.val() }, play_action);
            }
            // Re-sort?
        })
        .blur(function() {
            $(this).remove();
            $node.show();
        })
        .focus();
}

// Action on double-clicking a tree entry - revalue
function change_value($node) {
    "use strict";

    var h = $node.parent().css("height"), $input;
    $node.hide();
    $input = $("<input></input>");
    $input
        .addClass("revaluer")
        .attr("id", "revaluer")
        .val($node.text())
        .css("height", h)
        .insertBefore($node)
        .change(function() {
            if ($input.val() !== $node.text()) {
                client_hoard.play_action(
                    {
                        type: "E",
                        path: get_path($node),
                        data: $node.text()
                    },
                    play_action);
            }
        })
        .blur(function() {
            $input.remove();
            $node.show();
        })
        .focus();
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
    $dlg.dialog({
        width: "auto",
        modal: true,
        buttons: {
            "Value": function(evt) {
                $(this).dialog("close");
                client_hoard.play_action(
                    {
                        type: "N",
                        path: get_path($ul).push(getstring("new_value")),
                        data: "None"
                    },
                    play_action);
            },
            "Sub-tree": function(evt) {
                $(this).dialog("close");
                client_hoard.play_action(
                    {
                        type: "N",
                        path: get_path($ul).push(getstring("new_tree")),
                    },
                    play_action);
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
            .addClass("item_button")
            .button({
                icons: {
                    primary: "ui-icon-plus"
                },
                text: false
            })
            .attr("title", getstring("add_child"))
            .click(function() {
                add_new_child($div.closest("li").find("ul").first());
            });
        $div.append($adder);
    }
    var $killer = $("<button></button>")
        .addClass("item_button")
        .button({
            icons: {
                primary: "ui-icon-scissors"
            },
            text: false
        })
        .attr("title", getstring("delete_this"))
        .click(function() {
            confirm_delete($div.closest("li"));
        });
    $div.append($killer);
}

// Callback for use when managing hoards; plays an action that is being
// played into the hoard into the DOM as well.
function play_action(e) {
    "use strict";

    console.log("Playing " + e.type + " @" + new Date(e.time)
                + " " + e.path.join("/")
                + (typeof e.data !== 'undefined' ? " " + e.data : ""));

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
            // var $add_child = $("<button>+</button>").button();
            // var $remove = $("<button>-</button>").button();

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
        throw "Unrecognised action type " + e.type;
    }
    $("#tree").bonsai("update");
}

// Load a file from the client. File must be in action list format.
function load_local_file() {
    "use strict";

    var dlg_local_load_confirmed = function() {
        var $dlg = $(this), read_complete, fileData, reader;

        // TODO: the loading gif freezes, because of the work done in playlist
        $dlg.loadingOverlay({ loadingText: getstring("loading") });
        read_complete = function(error) {
            $dlg.loadingOverlay("remove");
            if (typeof error !== "undefined") {
                alert(error);
            }
            $dlg.dialog("close");
        };
        fileData = $("#local_file_pick")[0].files[0];
        reader = new FileReader();
        reader.onload = function(evt) {
            $("#tree").empty();
            client_hoard.empty();
            client_hoard.thaw(reader.result, {
                pass_on: play_action
                // ignore conflicts
            });
            $("#tree").bonsai("update");
            read_complete();
        };
        reader.onabort = read_complete;
        reader.onerror = read_complete;
        reader.readAsBinaryString(fileData);
    };

    $("#dlg_local_load").dialog({
        width: "auto",
        modal: true,
        autoOpen: true,
        buttons: [
            {
                text: "OK",
                click: dlg_local_load_confirmed
            }
        ]
    });
}

function log_in() {
    "use strict";

    var user, pass, confirm_password, registration_dialog, offer_registration,
    load_attempted, hoard_loaded, logged_in_to_client;

    $("#authenticated").loadingOverlay({ loadingText: getstring("login") });

    // Callback invoked when either of the client or cloud hoards
    // is loaded
    load_attempted = { client: false, cloud: false };
    hoard_loaded = function(hoard, error) {

        if (error) {
            console.log(error);
        } else {
            console.log(hoard + " hoard loaded");

            if (client_hoard && !load_attempted.client) {
                console.log("Reconstructing from cache");
                client_hoard.reconstruct(play_action);
            }
            if (client_hoard && cloud_hoard) {
                console.log("Synching with cloud");
                var conflicts = [];
                if (client_hoard.sync(cloud_hoard, play_action, conflicts)) {
                    // A cloud update is required
                    $('#save_required').show();
                }
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
            $("#authenticated").loadingOverlay("remove");
            if (client_hoard) {
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
        client_store.getData(
            "squirrel",
            function(cloud_data) {
                client_hoard = new Hoard(cloud_data);
                hoard_loaded("client");
            },
            function(reason) {
                hoard_loaded("client", reason);
            }
        );
    };

    // Confirm that we want to register by re-entering password
    confirm_password = function() {
        var $dlg = $("#dlg_confirm_pass"),
        buttons = {};
        $dlg.find(".message").hide();
        $dlg.find("#userid").text(user);

        buttons[getstring("confirm")] = function(evt) {
            var cpass = $("#confirm_password").val();
            if (cpass === pass) {
                $dlg.dialog("close");
                // We want to register; create the new registration in the
                // local drive
                client_store.register(pass);
                logged_in_to_client();
            } else {
                $("#password_mismatch").show();
                $("#show_password").button().click(function() {
                    $dlg.find("#passwords")
                        .text(pass + " and " + cpass)
                        .show();
                });
            }
        };
        buttons[getstring("cancel")] = function() {
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
        $dlg.find(".message").text($("#string > ." + message).text());
        buttons[getstring("yes")] = function(evt) {
            $dlg.dialog("close");
            // We want to register; create the new registration in the
            // local drive
            console.log("Registration selected. Confirming password");
            confirm_password();
        };
        buttons[getstring("no")] = function(evt) {
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
                    cloud_store.exists(
                        user,
                        function() {
                            registration_dialog("existing_hoard");
                        },
                        function() {
                            registration_dialog("no_nuts");
                        });
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
        console.log("Null password not allowed");
        return false;
    }

    console.log("Log in to stores");
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
                this.getData(
                    "squirrel",
                    function(data) {
                        cloud_hoard = new Hoard(data);
                        hoard_loaded("cloud");
                    },
                    function(e) {
                        hoard_loaded("cloud", e);
                    });
            },
            function(e) {
                hoard_loaded("cloud", "Cloud store rejected password.");
            });
    }
}

// TODO: synch passwords
const MINUTE          = 60 * 1000;
const HOUR            = 60 * MINUTE;
const CLOUD_BUILD     = 1398600000;
const LAST_SYNC       = CLOUD_BUILD + HOUR;
const SINCE_LAST_SYNC = LAST_SYNC + HOUR;
const CLOUD_CHANGE_1  = SINCE_LAST_SYNC + MINUTE;
const CLOUD_CHANGE_2  = CLOUD_CHANGE_1 + HOUR;

const CLIENT_DATA = {
    "::passwords::": JSON.stringify({
        "x": "x"
    }),
    "x:squirrel": JSON.stringify({
        last_sync: LAST_SYNC,
        cache: {
            time: CLOUD_BUILD,
            data: {
                "LocalSite": {
                    data: {
                        "User": {
                            time: SINCE_LAST_SYNC,
                            data: "local_user"
                        },
                        "Pass": {
                            time: SINCE_LAST_SYNC,
                            data: "5678"
                        },
                        "Dead": {
                            time: CLOUD_BUILD,
                            data: "Zone"
                        }
                    },
                    time: CLOUD_BUILD
                }
            }
        },
        actions: [
            { type: "N", time: SINCE_LAST_SYNC,
              path: ["LocalSite", "Pass"], data: "5678" },
            { type: "R", time: SINCE_LAST_SYNC,
              path: ["LocalSite", "grunt"], data: "User" }
        ]
    })
};

const CLOUD_DATA = {
    "::passwords::": JSON.stringify({
        "x": "x"
    }),
    "x:squirrel": JSON.stringify({
        "last_sync": 0,
        cache: {},
        actions: [
            { type: "N", path: [ "LocalSite" ],
              time: CLOUD_BUILD },
            { type: "N", path: [ "LocalSite", "grunt" ],
              time: CLOUD_BUILD },
            { type: "N", path: [ "LocalSite", "grunt" ],
              time: CLOUD_BUILD },
            { type: "N", path: [ "NewSite" ],
              time: CLOUD_CHANGE_2 },
            { type: "D", path: [ "LocalSite", "Dead" ],
              time: CLOUD_CHANGE_2 + MINUTE },
            { type: "R", path: [ "LocalSite", "Pass" ], data: "Password",
              time: CLOUD_CHANGE_2 + MINUTE * 2 },
            { type: "N", path: [ "LocalSite", "Down" ],
              time: CLOUD_CHANGE_2 + MINUTE * 3 },
            { type: "N", path: [ "LocalSite", "Down", "Stairs" ],
              time: CLOUD_CHANGE_2 + MINUTE * 4, data: "Maid" },
            { type: "D", path: [ "LocalSite", "Does", "Not", "Exist" ],
              time: CLOUD_CHANGE_2 + MINUTE * 5 }
        ]
    })
};

(function ($) {
    "use strict";

    $(document).ready(function() {

        if (chosen_language === "tx" ) {
            // Extract translatable strings
            var words = {};
            $(".TX_title").each(function() {
                words[$(this).attr("title")] = true;
            });

            $(".TX_text").each(function() {
                words[$(this).text()] = true;
            });
            var $ta = $("<textarea cols='120' rows='100'></textarea>");
            $ta.text(Object.keys(words).sort().join("\n"));
            $("body").empty().append($ta);
            return;
        }
        else if (chosen_language !== "en") {
            // TODO: implement TX somehow. FileReader, probably.
            $(".TX_title").each(function() {
                $(this).attr("title", TX($(this).attr("title")));
            });

            $(".TX_text").each(function() {
                $(this).text(TX($(this).text()));
            });
        }

        //client_store = new LocalStorageStore("squirrel");
        //client_store = new EncryptedStore(client_store);

        cloud_store = new MemoryStore(CLOUD_DATA);
        client_store = new MemoryStore(CLIENT_DATA);

        // Log in
        $("#log_in").click(log_in);
        $("#password")
            .change(log_in);

        $("#log_out").button().click(function() {
            $("#tree").empty();
            $("#authenticated").hide();
            $("#unauthenticated").show();
            client_store.log_out();
            client_hoard = null;
            if (cloud_store) {
                cloud_store.log_out();
                cloud_hoard = null;
            }
        });

        $("#tree").bonsai({
            expandAll: false });

        $("#load_local").button().click(function() {
            load_local_file();
        });

        $("#add_root_child")
            .button({
                icons: {
                    primary: "ui-icon-plus"
                },
                text: false
            })
            .click(function() {
                add_new_child($("#tree"));
            });

        $("#search").change(function(evt) {
            search($(this).val());
        });
    });
})(jQuery);
