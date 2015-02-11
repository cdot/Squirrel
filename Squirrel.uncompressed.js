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
// Google Drive initialisation, called when the
// https://apis.google.com/js/client.js is loaded
const AES_BITSINKEY = 32 * 8;

var cloud_store;
var hoard;
function gapi_loaded() {
    console.log("Google API loaded");
    if (!cloud_store) {
	cloud_store = new GoogleDriveStore(
            '985219699584-mt1do7j28ifm2vt821d498emarmdukbt.apps.googleusercontent.com');
        //cloud_store = new EncryptedStore(client_store);
    }
};

function get_path($node) {
    var path = [];
    if (typeof($node.attr('data-key')) !== 'undefined')
        path.push($node.attr('data-key'));
    $node.parents("li").each(function() {
        if (typeof($(this).attr('data-key')) !== 'undefined')
            path.unshift($(this).attr('data-key'));
    });
    return path;
}

function getstring(id) {
    return $('#strings > span.' + id).text();
}

function last_mod(time) {
    return getstring('lastmod_string') + time.toLocaleString();
}

function confirm_delete($node) {
    var $dlg = $('#dlg_confirm_delete');
    $dlg.find('.message').text(get_path($node).join('/'));
    if ($node.hasClass('treecollection'))
        $dlg.find('.is_collection').show();
    else
        $dlg.find('.is_collection').hide();
    $dlg.dialog({
        modal: true,
        width: 'auto',
        buttons: {
            "Confirm" : function(evt) {
                $(this).dialog('close');
                var $mum = $node.parents('li');
                var when = new Date();
                hoard.record_event('D', get_path($node));
                $node.remove();
                if ($mum)
                    $mum
                        .attr('data-timestamp', when)
                        .attr('title', last_mod(when));
            }
        }});
}

// Action on double-clicking a tree entry - rename
function rename_key($node) {
    var h = $node.parent().css('height');
    $node.hide();
    var $input = $('<input class="renamer" id="renamer" value="'
               + $node.text() + '"/>');

        $input.css('height', h)
        .insertBefore($node)
        .change(function() {
            if ($input.val() !== $node.text()) {
                var old_path = get_path($node);
                $node.text($input.val());
                var when = new Date();
                $node.parents("li").first()
                    .attr('data-key', $input.val())
                    .attr('data-timestamp', when)
                    .attr('title', last_mod(when));
                hoard.record_event('R', old_path, get_path($node));
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
    var h = $node.parent().css('height');
    $node.hide();
    $input = $('<input class="revaluer" id="revaluer" value="'
               + $node.text() + '"/>');
    $input.css('height', h);
    $input.insertBefore($node);
    $input
        .change(function() {
            if ($input.val() !== $node.text()) {
                $node.text($input.val());
                var when = new Date();
                $node.parents("li").first()
                    .attr('data-timestamp', when)
                    .attr('title', last_mod(when));
                hoard.record_event('E', get_path($node), $node.text());
            }
            // Re-sort?
        })
        .blur(function() {
            $input.remove();
            $node.show();
        })
        .focus();
}

// Make a case-insensitive selector
$.expr[":"].contains = $.expr.createPseudo(function(arg) {
    return function( elem ) {
        return $(elem).text().toUpperCase().indexOf(arg.toUpperCase()) >= 0;
    };
});

function fragment_id(path) {
    var fid = path.join(':');
    return fid.replace(/[^A-Za-z0-9:_]/g, function(m) {
        return m.charCodeAt(0);
    });
}

function search(s) {
    var $sar = $('#search_results');
    $sar.empty();
    s = s.replace(/'/g, "\\'");
    $(".key:contains('" + s + "')")
        .each(function() {
            var $li = $(this).closest('li');
            var path = get_path($li);
            var $res = $('<a href="#'
                        + fragment_id(path)
                        + '" class="search_result">'
                        + path.join('/')
                        + '</a>');
            $res.click(function() {
                $('#tree').bonsai('collapseAll');
                $('#tree').bonsai('expand', $li);
                $li.parents('li').each(function() {
                    $('#tree').bonsai('expand', $(this));
                });
            });
            $sar.append($res).append('<br />');
        });
}

function add_new_child($ul) {
    var $dlg = $('#dlg_add_node');
    $dlg.dialog({
        width: 'auto',
        modal: true,
        buttons: {
            "Value" : function(evt) {
                $(this).dialog('close');
                var $li = add_node($ul, 'New Value', 'None');
                hoard.record_event('N', get_path($li), 'None');
            },
            "Sub-tree" : function(evt) {
                $(this).dialog('close');
                var $li = add_node($ul, 'New Tree');
                hoard.record_event('N', get_path($li));
            }
        }});
}

function node_clicked() {
    var $div = $(this);
    $('.selected')
        .removeClass('selected')
        .find('.item_button').remove();
    $div.addClass('selected');
    if ($div.hasClass('treecollection')) {
        var $adder = $('<button class="item_button"></button>')
            .button({
                icons: {
                    primary: "ui-icon-plus"
                },
                text: false
            })
            .attr('title', "Add new child")
            .click(function() {
                add_new_child($div.closest('li').find('ul').first());
            });
        $div.append($adder);
    }
    var $killer = $('<button class="item_button"></button>')
        .button({
            icons: {
                primary: "ui-icon-scissors"
            },
            text: false
        })
        .attr('title', "Delete this")
        .click(function() {
            confirm_delete($li);
        });
    $div.append($killer);
}

function add_node($ul, key, value, time) {
    if (!time)
        time = new Date();

    var $li = $('<li></li>');
    $li.attr('data-key', key);
    $li.attr('data-timestamp', time);
    $li.attr('title', last_mod(time));
    var $div = $("<div></div>");
    $div.click(node_clicked);
    var $keyspan = $("<span class='key'>" + key + "</span>");
    $keyspan.dblclick(function() {
        // in-place editor
        rename_key($(this));
    });
    $div.append($keyspan);

    $li.append($div);
    
    if (typeof(value) !== 'undefined' && value !== null) {
	$div.addClass("treeleaf");
        var $valspan = $("<span class='value'>" + value + "</span>");
        $valspan.dblclick(function() {
            // in-place editor
            change_value($(this));
        });
        $div.append(" : ").append($valspan);
    } else {
	$div.addClass("treecollection");
        var $add_child = $('<button>+</button>').button();
        var $remove = $('<button>-</button>').button();

        var $subul = $("<ul></ul>");
        $li.append($subul);
    }

    var inserted = false;
    key = key.toLowerCase();
    $ul.children('li').each(function() {
        if ($(this).attr('data-key').toLowerCase() > key) {
            $li.insertBefore($(this));
            inserted = true;
            return false;
        }
    });
    if (!inserted)
        $ul.append($li);

    // Add anchor
    $li.prepend('<a name="' + fragment_id(get_path($li)) + '"></a>');

    return $li;
}

// Play an event into the DOM, usually under control of a hoard
function play_event(e) {
    if (e.type == 'N') {
	var $ul = $('#tree');
	for (var i = 0; i < e.path.length - 1; i++) {
	    $ul = $ul.find('li[data-key="' + e.path[i] + '"] > ul');
	}
	add_node($ul, e.path[e.path.length - 1], e.data, e.time);
    } else
	throw "up";
}

function load_client_store(ok, fail) {
    client_store.getData(
        'squirrel',
        function(db) {
            hoard = new Hoard(db);
            ok.call(this);
        }, fail);
}

// Try and synch with content in remote store
function sync_with_cloud_store(ready) {
    console.log('Trying to sync local with cloud ');

    cloud_store.getData(
        'squirrel',
        function(cloud_hoard) {
            hoard.sync(cloud_hoard, play_event);
	    ready();
        },
        function(reason) {
            alert(getstring("errsync_ddb") + reason);
            ready();
        }
    );
}

// We are registered with the local store
function logged_in_to_client_store() {
    console.log(client_store.user + " is logged in to local store");
    var ready = function() {
        $('.unauthenticated').hide();
        $('.authenticated').show();
    };
    load_client_store(
        function() {
            if (cloud_store)
                sync_with_cloud_store(ready);
            else
                ready();
        },
        function(e) {
            alert(e);
            // TODO: something here.
        });
}

// Confirm that we want to register by re-entering password
function confirm_password(user, pass) {
    var $dlg = $('#dlg_confirm_pass');
    $dlg.find('.message').hide();
    $dlg.find('#userid').text(user);

    var buttons = {};
    buttons[getstring('confirm_button')] = function(evt) {
        var cpass = $('#confirm_password').val();
        if (cpass === pass) {
            $dlg.dialog("close");
            // We want to register; create the new registration in the
            // local drive
            client_store.register(pass);
            logged_in_to_client_store();
        } else {
            $('#password_mismatch').show();
            $('#show_password').button().click(function() {
                $dlg.find('#passwords')
                    .text(pass + " and " + cpass)
                    .show();
            });
        }
    };
    buttons[getstring('cancel_button')] = function() {
        $dlg.dialog("close");
    };

    $dlg.dialog({
        width: 'auto',
        modal: true,
        buttons: buttons});
}

// Registration is being offered for the reason shown by clss.
function _registration_dialog(message, user, pass) {
    var $dlg = $('#dlg_register');
    $dlg.find('.message').text(getstring(message));
    var buttons = {};
    buttons[getstring('yes_button')] = function(evt) {
        $dlg.dialog("close");
        // We want to register; create the new registration in the
        // local drive
        console.log("Registration selected. Confirming password");
        confirm_password(user, pass);
    };
    buttons[getstring('no_button')] = function(evt) {
        $dlg.dialog("close");
        // No local store registration; we can't do any more
    };
    $dlg.dialog({
        modal: true,
        buttons: buttons});
}

// The local store didn't allow login using this pass. See if the
// user wants to register
function _offer_registration(user, pass, finished) {
    if (cloud_store) {
        // Remote store is there; see if it has a file
        cloud_store.log_in(
            user, pass,
            function() {
                console.log('Checking Remote Store');
                cloud_store.exists(
	            user,
	            function() {
		        _registration_dialog('nuts_in_cloud', user, pass);
                        finished();
	            },
	            function() {
		        _registration_dialog('not_in_cloud', user, pass);
                        finished();
	            });
            },
            function(message) {
	        _registration_dialog('mismatch_with_cloud', user, pass);
                finished();
            });
    } else {
	_registration_dialog('cant_connect', user, pass);
        finished();
    }
}

// Load a file from the client. File must be in event list format.
function dlg_local_load_confirmed() {
    var $dlg = $(this);
    // TODO: the loading gif freezes, because of the work done in playlist
    $dlg.loadingOverlay({ loadingText: getstring('string') });
    var read_complete = function(error) {
        $dlg.loadingOverlay('remove');
        if (typeof(error) !== 'undefined')
            alert(error);
        $dlg.dialog("close");
    };
    var fileData = $('#local_file_pick')[0].files[0];
    var reader = new FileReader();
    reader.onload = function(evt) {
        $('#tree').empty();
        hoard.empty();
        hoard.thaw(reader.result, {
	    pass_on: play_event
	    // ignore conflicts
        });
        $('#tree').bonsai('update');
        read_complete();
    };
    reader.onabort = read_complete;
    reader.onerror = read_complete;
    reader.readAsBinaryString(fileData);
}

function load_local_file() {
    $('#dlg_local_load').dialog({
        width: 'auto',
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
    $('#authenticate').loadingOverlay({ loadingText: getstring('login_string') });
    var finished = function() {
        $('#authenticate').loadingOverlay('remove');
    };

    var user = $('#user').val();
    var pass = $('#password').val();
    if (!pass || pass === '') {
        console.log("Null password not allowed");
        return false;
    }
    console.log("Log in to local store");
    client_store.log_in(
	user, pass,
	function() {
            console.log("Logged in to local store");
            finished();
            logged_in_to_client_store();
	},
	function(e) {
            console.log("Local store rejected password. Offering registration");
            _offer_registration(user, pass, finished);
	});
}

(function ($) {
    $(document).ready(function() {

        client_store = new LocalStorageStore('squirrel');
        //client_store = new EncryptedStore(client_store);

        // DEBUG - use unencrypted file store as a source for sync data
	$('#init_store').dialog({
	    modal: true,
	    buttons: {
		"Open": function(evt) {
		    $(this).dialog("close");
		    var fileData = $('#init_store_pick')[0].files[0];
		    cloud_store = new FileStore(fileData);
                    logged_in_to_client_store();
		}
	    }
	});

        // Log in
        $('#log_in').click(log_in);
        $('#password').change(log_in);

        $('#log_out').button().click(function() {
            $('#tree').empty();
            $('#authenticated').hide();
            $('#unauthenticated').show();
            if (client_store)
                client_store.log_out();
            if (cloud_store)
                cloud_store.log_out();
            if ($tabs.hasClass('ui-tabs'))
                $tabs.tabs("destroy");
        });

        $('#tree').bonsai();

        $('#load_local').button().click(function() {
            load_local_file();
        });

	$('#add_root_child').button().click(function() {
	    add_new_child($('#tree'));
	});

        $('#search').change(function(evt) {
            search($(this).val());
        });
    });
})(jQuery);


