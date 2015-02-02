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

var drive;
function gapi_loaded() {
    drive = new GoogleDriveEngine(
        '985219699584-mt1do7j28ifm2vt821d498emarmdukbt.apps.googleusercontent.com');
};
var hoard;

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

function last_mod(time) {
    return 'Double-click to edit. Last modified: ' + time.toLocaleString();
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

// Try and synch with Drive
function sync_with_drive(ready) {
    console.log('Trying to sync with '
                + local_store.userid + ' on Google Drive');
    drive.authorise(
        function() {
            drive.download({
                name: local_store.userid,
                success: function(data) {
                    if (data.substring(0,3) == "AES") {
                        data = data.substring(3);
                        data = Aes.Ctr.decrypt(
                            data.substring(3),
                            local_store.password,
                            AES_BITSINKEY);
                    }

                    try {
                        var drive_db = $.parseJSON(data);
                        if (drive_db !== null)
                            merge_into_local(drive_db);
                    } catch (e) {
                        console.log("Error loading drive db: " + e);
                    }
                    ready();
                },
                error: function(reason) {
                    console.log("Cannot sync: " + reason);
                    ready();
                }
            });
        });
    // Synch local drive with google
}

// We are registered with the local store
function logged_in_to_local_store() {
    console.log(local_store.userid + " is logged in to local store");
    sync_with_drive(function() {
        $('body').loadingOverlay('remove');
        $('.unauthenticated').hide();
        $('.authenticated').show();
    });
}

// Confirm that we want to register by re-entering password
function confirm_password(pass) {
    var $dlg = $('#dlg_confirm_pass');
    $dlg.find('.message').hide();
    $dlg.dialog({
        width: 'auto',
        modal: true,
        buttons: {
            "Confirm" : function(evt) {
                var cpass = $('#confirm_password').val();
                if (cpass === pass) {
                    $(this).dialog("close");
                    // We want to register; create the new registration in the
                    // local drive
                    local_store.register(pass);
                    logged_in_to_local_store();
                } else {
                    $('#password_mismatch').show();
                    $('#show_password').button().click(function() {
                        $dlg.find('#passwords')
                            .text(pass + " and " + cpass)
                            .show();
                    });
                }
            }
        }});
}

// Registration is being offered for the reason shown by clss.
function registration_dialog(clss, pass) {
    $('.' + clss).show();
    $('#dlg_register').dialog({
        modal: true,
        buttons: {
            "Yes" : function(evt) {
                $(this).dialog("close");
                // We want to register; create the new registration in the
                // local drive
                console.log("Registration selected. Confirming password");
                confirm_password(pass);
            },
            "No" : function(evt) {
                $(this).dialog("close");
                // No local store registration; we can't do any more
            }
        }});
}

// The local store didn't allow login using this pass. See if the
// user wants to register
function offer_registration(pass) {
    var $dlg = $('#dlg_register');
    $dlg.find('.message').hide();
    if (drive) {
        drive.authorise(
            function() {
                console.log('Checking Google Drive');
                drive.exists(
		    local_store.make_userid(pass),
		    function() {
			registration_dialog('nuts_on_drive', pass);
		    },
		    function() {
			registration_dialog('not_on_drive', pass);
		    });
            },
            function() {
		registration_dialog('cant_connect', pass);
            });
    } else {
        $('.cant_connect').show();
        // Reject the registration
    }

}

// Load a file from the client. File must be in event list format.
function dlg_local_load_confirmed() {
    var $dlg = $(this);
    // TODO: the loading gif freezes, because of the work done in playlist
    $dlg.loadingOverlay({ loadingText: 'Loading...' });
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
            add_node: function(e) {
                var $node = $('root');
                var i = 0;
                while (i < e.path.length) {
                    var $sub = $node.children('ul > li[data-key="'
                                              + e.path[i] + '"]')
                        .first();
                    if (!$sub)
                        break;
                    $node = $sub;
                }
                var $ul = $node.find('ul').first();
                add_node($ul, e,path[e.path.length - 1], e.data, e.time);
            }} );
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
    $('#authenticate').loadingOverlay({ loadingText: 'Logging in' });
    var pass = $('#password').val();
    if (!pass || pass === '') {
        console.log("Null password not allowed");
        return false;
    }
    console.log("Log in");
    if (local_store.log_in(pass)) {
        logged_in_to_local_store();
    } else {
        console.log("Local store rejected password. Offering registration");
        offer_registration(pass);
    }
}

(function ($) {
    $(document).ready(function() {

        local_store = new EncryptedStorage('squirrel');

        // Log in
        $('#log_in').click(log_in);
        $('#password').change(log_in);

        $('#log_out').button().click(function() {
            $('#tree').empty();
            $('#authenticated').hide();
            $('#unauthenticated').show();
            local_store.log_out();
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


