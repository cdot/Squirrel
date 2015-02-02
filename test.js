var drive;
var test_date = new Date();

function unexpected_error(e) {
    debugger;
    throw "Unexpected error: " + e;
}

function test_engine_get(engine, name) {
    engine.getData("HoardOfNuts", function(d) {
        //console.log("Received back " + d);
        if (d !== "some data " + test_date)
            throw name + ' tests failed d !=== "some data " + test_date';
        console.log(name + " tests passed OK");
    }, unexpected_error);
}

function test_engine_set(engine, name) {
    engine.setData("HoardOfNuts", "some data " + test_date, function() {
        test_engine_get(engine, name);
    }, unexpected_error);
}

// test GoogleDriveEngine
function gapi_loaded() {
    drive = new GoogleDriveEngine(
        '985219699584-mt1do7j28ifm2vt821d498emarmdukbt.apps.googleusercontent.com');
    $('#gd_button').show();
};

function cascade(fns, index) {
    window.setTimeout(function() {
        fns[index++].call();
        if (index < fns.length)
            cascade(fns, index);
    }, 5);
}

$(document).ready(function() {

    $('body')
        .empty();

    var b = $('<button id="gd_button">Test GoogleDriveEngine</button>');
    b.hide().click(
        function() {
            test_engine_set(drive);
        });
    $('body').append(b);

    b = $('<button>Test LocalStorageEngine</button>');
    b.click(
        function() {
            // test LocalStorageEngine
            var local = new LocalStorageEngine('base_test');
            test_engine_set(local, "LocalStorageEngine");
        });
    $('body').append(b);

    b = $('<button>Test EncryptedStorage</button>');
    b.click(
        function() {
            // test EncryptedStorage (with LocalStorageEngine)
            var local = new LocalStorageEngine('es_test');
            var es = new EncryptedStorage(local, 'test_app ' + test_date);

            var expected_userid;
            es.register("worm", "ToadFlax",
                        function(uid) {
                            expected_userid = uid;
                        },
                        unexpected_error);

            es.log_out();

            var lid = es.log_in("worm", "ToadFlax",
                                function(uid) {
                                    //console.log("userid " + uid + " logged in");
                                },
                                unexpected_error);

            es.setData('oompa', "some data " + test_date,
                       function() {
                           //console.log("es set OK");
                       },
                       unexpected_error);

            es.getData('oompa', function(d) {
                if (d !== "some data " + test_date)
                    throw name + ' tests failed "'+ d + '" !=== "'
                    + "some data " + test_date + '"';
                console.log("EncryptedStorage tests passed");
            }, unexpected_error);
        });
    $('body').append(b);

    b = $('<button>Test Hoard</button>');
    b.click(
        function() {
            var locs = new LocalStorageEngine('hoard_test_1');
            var loc = new Hoard(locs);
            var rems = new LocalStorageEngine('hoard_test_2');
            var rem = new Hoard(rems);
            var fns = [
                function() {
                    rem.play_event({type: 'N', path: ['rem' ]});
                },
                function() {
                    rem.play_event({type: 'N', path: ['rem', 'rem_branch' ]});
                },
                function() {
                    loc.play_event({type: 'N', path: ['loc' ]});
                },
                function() {
                    rem.play_event({type: 'N', path: [ 'rem', 'rem_branch2' ]});
                },
                function() {
                    loc.play_event({type: 'N', path: ['loc', 'loc_branch' ]});
                },
                function() {
                    loc.play_event({type: 'N', path: ['loc', 'loc_branch', 'loc_leaf' ], data: 'local leaf data'});
                },
                function() {
                    rem.play_event({type: 'N',
                                   path: ['rem', 'rem_branch', 'rem_leaf' ],
                                  data: 'rem leaf data'});
                },
                function() {
                    rem.play_event({type: 'N', path: [ 'loc' ]});
                },
                function() {
                    var o = {
                        pass_on: function(e) {
                            console.log('Pass on: ' + e.type + " "
                                        + e.path.join('/')
                                        + (e.data ? e.data : ''));
                        },
                        conflicts: []
                    }
                    loc.sync(rem, o);
                    var conflicts = o.conflicts;
                    if (conflicts.length !== 1)
                        throw "Too many conflicts";
                    if (conflicts[0].message !== "Already exists")
                        throw "Not what was expected";
                    if (conflicts[0].event.path[0] !== 'loc')
                        throw "Not what was expected"
                    console.log("Hoard tests passed");
                }
            ];
            cascade(fns, 0);
        });
    $('body').append(b);
});

