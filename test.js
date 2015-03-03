var drive;
var test_date = new Date();

function unexpected(e) {
    assert(false, "Unexpected callback: " + e);
}

function exercise_store_read(store, chain) {
    store.read(
        function(data) {
            assert(data === "Oochy coochy coo", data);
            assert(this === store);
            console.debug("exercise_store_read OK");
            if (chain)
                chain.call(this, store);
        },
        function(e) {
            assert(false, e);
        });
}

function exercise_store_write(store, chain) {
    store.write(
        "Oochy coochy coo",
        function() {
            assert(this === store);
            console.debug("exercise_store_write OK");
            if (chain)
                chain.call(this, store)
        },
        function(e) {
            assert(false, e);
        });
}

function exercise_store(store) {
    store.read(
        function() {
            assert(this === store);
            assert(this.user);
            exercise_store_read(
                store,
                function(store) {
                    exercise_store_write(store, exercise_store_read);
                })
        },
        function(e) {
            console.debug("Not there: " + e);
            exercise_store_write(store, exercise_store_read);
        });
}

new LocalStorageStore({
    dataset: "Plain Local Store",
    ok: function() {
        console.debug("Plain LocalStorage store is ready");
        exercise_store(this);
    },
    fail: unexpected,
    identify: function (ok, fail) {
        ok.call(this, "Test User");
    }
});


new EncryptedStore({
    engine: LocalStorageStore,
    dataset: "Encrypted Local Store",
    ok: function() {
        console.debug("Encrypted LocalStorage store is ready");
        exercise_store(this);
    },
    fail: unexpected,
    identify: function (ok, fail) {
        ok.call(this, "Test User", "Test pass");
    }
});

if (typeof DropboxStore !== "undefined") {
    new DropboxStore({
        dataset: "Plain Dropbox Store",
        ok: function() {
            console.debug("Plain dropbox store is ready");
            exercise_store(this);
        },
        fail: unexpected,
        identify: unexpected
    });

    new EncryptedStore({
        engine: DropboxStore,
        dataset: "Encrypted Dropbox Store",
        ok: function() {
            console.debug("Encrypted dropbox store is ready");
            exercise_store(this);
        },
        fail: unexpected,
        identify: function (ok, fail) {
            ok.call(this, "Test User", "Test pass");
        }
    });
}

if (typeof GoogleDriveStore !== "undefined") {
    console.debug("Testing " +
                  "Google Drive");
    new GoogleDriveStore({
        dataset: "Plain Google Drive Store",
        ok: function() {
            console.debug("Plain gapi store is ready");
            exercise_store(this);
        },
        fail: unexpected,
        identify: unexpected
    });
}
