var drive;
var test_date = new Date();

function assert(t, e) {
    if (!t) {
        if (!e)
            e = "Assert failed";
        debugger;
        throw e;
    }
}

function unexpected(e) {
    assert(false, "Unexpected callback: " + e);
}

function run_tests(engine, tests) {
    if (tests.length == 0)
        return;
    var test = tests.shift();
    test.call(
        this,
        engine,
        function() {
            run_tests(engine, tests);
        });
}

// Make sure of behaviour when login fails
function no_login_tests(engine) {
    run_tests(engine, [
        
        function(engine, ok) {
            engine.log_in(
                "not a user", "not a password",
                unexpected,
                ok);
        },
        
        function(engine, ok) {
            engine.exists(
                "HoardOfNuts",
                unexpected,
                function(e) {
                    ok.call();
                });
        },
        
        function(engine, ok) {
            engine.getData(
                "HoardOfNuts",
                unexpected,
                function(e) {
                    // OK, not logged in
                    ok.call();
                });
        },
        
        function(engine, ok) {
            engine.setData(
                "HoardOfNuts", "some data " + test_date,
                unexpected,
                function(e) {
                    // OK, not logged in
                    ok.call();
                });
        },

        function() {
            console.log("no_login_tests passed");
        }
    ]);
};

function registration_tests(engine) {
    run_tests(engine, [
        function(engine, ok) {
            engine.check_user(
                "test user", "test password",
                function() {
                    // Already registered
                    console.log("registration_tests skipped - already registered");
                },
                ok);
        },

        function(engine, ok) {
            // try registering
            if (!engine.isReadOnly) {
                engine.register(
                    "test user", "test password",
                    ok,
                    unexpected);
            }
        },

        function(engine, ok) {
            // Make sure we are logged in
            assert(engine.user === "test user");
            engine.log_out();
            ok.call();
        },

        function() {
            console.log("registration_tests passed");
        }]);
}

function login_tests(engine) {
    run_tests(engine, [
        function(engine, ok) {
            engine.log_in(
                "test user", "test password",
                ok,
                unexpected);
        },

        function(engine, ok) {
            engine.log_out();
            ok.call();
        },

        function() {
            console.log("login_tests passed");
        }
    ]);
}

// Assumes logged in
function set_get_tests(engine) {
    run_tests(engine, [
        function(engine, ok) {
            engine.log_in(
                "test user", "test password",
                ok,
                unexpected);
        },

        function(engine, ok) {
            engine.setData(
                "HoardOfNuts", "some data " + test_date,
                function() {
                    ok.call();
                },
                unexpected);
        },

        function(engine, ok) {
            engine.getData("HoardOfNuts", function(d) {
                //console.log("Received back " + d);
                assert(d === "some data " + test_date,
                       name + ' tests failed d !=== "some data " + test_date');
                ok.call();
            }, unexpected);
        },

        function(engine, ok) {
            engine.log_out();
            ok.call();
        },

        function() {
            console.log("get_set_tests passed");
        }
    ]);
}

// test GoogleDriveStore
function gapi_loaded() {
    drive = new GoogleDriveStore(
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

    var b = $('<button id="gd_button">Test GoogleDriveStore</button>');
    b.hide().click(
        function() {
        });
    $('body').append(b);
    $('body').append('<br />');

    b = $('<button>Test LocalStorageStore</button>');
    b.click(
        function() {
            console.log("test LocalStorageStore");
            var local = new LocalStorageStore();
            no_login_tests(local);
            registration_tests(local);
            login_tests(local);
            set_get_tests(local);
            console.log("LocalStorageStore tests complete");
        });
    $('body').append(b);
    $('body').append('<br />');

    b = $('<button>Test EncryptedStore</button>');
    b.click(
        function() {
            // test EncryptedStore (with LocalStorageStore)
            var local = new EncryptedStore(new LocalStorageStore());

            console.log("test EncryptedStore");
            no_login_tests(local);
            registration_tests(local);
            login_tests(local);
            set_get_tests(local);
            console.log("EncryptedStore tests complete");
        });
    $('body').append(b);
    $('body').append('<br />');

    b = $('<button>Test Hoard</button>');
    b.click(
        function() {
            var locs = new LocalStorageStore('hoard_test_1');
            var loc = new Hoard(locs);
            var rems = new LocalStorageStore('hoard_test_2');
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
    $('body').append('<br />');
});

