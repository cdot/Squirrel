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
function store_tests(engine, ok) {
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
                "HoardOfNuts",
                "some data " + test_date,
                unexpected,
                function(e) {
                    // OK, not logged in
                    ok.call();
                });
        },

        function(engine, ok) {
            console.log("no_login_tests passed");
            ok.call();
        },

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
            engine.register(
                "test user", "test password",
                ok,
                unexpected);
        },

        function(engine, ok) {
            // Make sure we are logged in
            assert(engine.user === "test user");
            engine.log_out();
            ok.call();
        },

        function(engine, ok) {
            console.log("registration_tests passed");
            ok.call();
        },

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

        function(engine, ok) {
            console.log("login_tests passed");
            ok.call();
        },

        function(engine, ok) {
            engine.log_in(
                "test user", "test password",
                ok,
                unexpected);
        },

        function(engine, ok) {
            engine.setData(
                "HoardOfNuts",
                { entry: "some data", date: test_date.valueOf() },
                function() {
                    ok.call();
                },
                unexpected);
        },

        function(engine, ok) {
            engine.getData("HoardOfNuts", function(d) {
                //console.log("Received back " + d);
                assert(d.entry === "some data" && d.date === test_date.valueOf(),
                       name + ' tests failed d !=== "some data" + test_date');
                ok.call();
            }, unexpected);
        },

        function(engine, ok) {
            engine.log_out();
            ok.call();
        },

        function() {
            console.log("set_get_tests passed");
            ok.call();
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
            localStorage.removeItem('test/::passwords::');
            localStorage.removeItem('test/test user:HoardOfNuts');
            var local = new LocalStorageStore('test');
            store_tests(local, function() {
                console.log("LocalStorageStore tests complete");
            });
        });
    $('body').append(b);
    $('body').append('<br />');

    b = $('<button>Test FileStore</button>');
    b.click(
        function() {
            console.log("test FileStore");
            var aFileParts = ['{}'];
            var file = new Blob(aFileParts, {type : 'application/json'});
            var local = new FileStore(file);
            store_tests(local, function() {
                console.log("FileStore tests complete");
            });
        });
    $('body').append(b);
    $('body').append('<br />');

    b = $('<button>Test EncryptedStore</button>');
    b.click(
        function() {
            // test EncryptedStore (with LocalStorageStore)
            localStorage.removeItem('test/::passwords::');
            localStorage.removeItem('test/test user:HoardOfNuts');
            var local = new EncryptedStore(new LocalStorageStore('test'));

            console.log("test EncryptedStore");
            store_tests(local, function() {
                console.log("EncryptedStore tests complete");
            });
        });
    $('body').append(b);
    $('body').append('<br />');

    b = $('<button>Test Hoard</button>');
    b.click(
        function() {
            var loc = new Hoard();
            var rem = new Hoard();
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
                    var listener = function(e) {
                        console.log('Pass on: ' + e.type + " "
                                    + e.path.join('/')
                                    + (e.data ? (' = ' + e.data) : ''));
                    }
                    var conflicts = loc.sync(rem, listener);
                    assert(conflicts.length == 1, conflicts.length);
                    assert(conflicts[0].message === "Already exists",
                           "Not what was expected");
                    assert(conflicts[0].event.path[0] === 'loc',
                           "Not what was expected");
                    console.log("Hoard tests passed");
                }
            ];
            cascade(fns, 0);
        });
    $('body').append(b);
    $('body').append('<br />');
});

