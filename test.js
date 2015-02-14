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
            engine.save(
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
            engine.data["HoardOfNuts"] =
                { entry: "some data", date: test_date.valueOf() };
	    engine.save(
                function() {
		    engine.log_out();
                },
                unexpected);
        },

        function(engine, ok) {
	    engine.log_in(
		"test user", "test password",
		function() {
		    var d = engine.data["HoardOfNuts"];
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

// Sequence events over 5ms intervals interspersed with function calls
function play_events(es, i) {
    if (typeof(i) === 'undefined')
        i = 0;
    if (i == es.length)
        return;
    var e = es[i];
    window.setTimeout(function() {
        if (typeof(e) === 'function') {
            console.log("call " + i);
            e.call();
        } else {
            console.log("play " + i);
            e.hoard.play_event(e.event);
        }
        play_events(es, i + 1);
    }, 5);
}

// test GoogleDriveStore
function gapi_loaded() {
    drive = new GoogleDriveStore(
        '985219699584-mt1do7j28ifm2vt821d498emarmdukbt.apps.googleusercontent.com');
    $('#gd_button').show();
};

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
            play_events([
                {hoard: rem, event:{
                    type: 'N', path: ['rem' ]}},
                {hoard: rem, event:{
                    type: 'N',
                    path: ['rem', 'rem_branch' ]}},
                {hoard: loc, event:{type: 'N', path: ['loc' ]}},
                {hoard: rem, event:{
                    type: 'N',
                    path: [ 'rem', 'rem_branch2' ]}},
                {hoard: loc, event:{
                    type: 'N', path: ['loc', 'loc_branch' ]}},
                {hoard: loc, event:{
                    type: 'N',
                    path: ['loc', 'loc_branch', 'loc_leaf' ],
                    data: 'local leaf data'}},
                {hoard: rem, event:{
                    type: 'N',
                    path: ['rem', 'rem_branch', 'rem_leaf' ],
                    data: 'rem leaf data'}},
                {hoard: rem, event:{
                    type: 'N', path: [ 'loc' ]}},

                function() {
                    var passon = [];
                    var listener = function(e) {
                        passon.push(e.type + " "
                                    + e.path.join('/')
                                    + (e.data ? (' = ' + e.data) : ''));
                    }
                    var conflicts = loc.sync(rem, listener);
                    assert(conflicts.length == 1, conflicts.length);
                    assert(conflicts[0].message === "Already exists",
                           "Not what was expected");
                    assert(conflicts[0].event.path[0] === 'loc',
                           "Not what was expected");
                    assert("N rem;N rem/rem_branch;N rem/rem_branch2;N rem/rem_branch/rem_leaf = rem leaf data" == passon.join(';'));
                },

                {hoard:rem, event:{
                    type: 'R',
                    path: ['rem', 'rem_branch' ],
                    data: 'remainder' }},
                {hoard: rem, event: {
                    type: 'E', path: ['rem', 'remainder', 'rem_leaf' ],
                    data: 'rest'}},
                {hoard: rem, event: {
                    type: 'D', path: ['rem', 'rem_branch2' ]}},

                function() {
                    var conflicts = loc.sync(rem);
                    assert(conflicts.length == 0);
                    console.log("Hoard tests passed");
                },
            ]);
        });
    $('body').append(b);
    $('body').append('<br />');
});

