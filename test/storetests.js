function readString(store) {
    store.reads(
        "test/test.dat",
        function(str) {
            if (this !== store)
                throw "Not the same";
            if (str != "Three blind mice")
                throw str + " != Three blind mice";
            console.debug("readString was OK");
            storetestchain(this);
        },
        function(e) {
            throw this + " readString failed " + e + " " + this;
        });
 
}

function writeString(store) {
    var a = "Three blind mice";
    store.writes(
        "test/test.dat",
        a,
        function() {
            if (this !== store)
                throw "Not the same";
            console.debug("writeString was OK");
            storetestchain(this);
        },
        function(e) {
            throw this + " writeString failed " + e;
        });
}

function readArrayBuffer(store) {
    store.read(
        "test/test.dat",
        function(ab) {
            if (this !== store)
                throw "Not the same";
            var a = new Uint16Array(ab);
            if (a.length !== 256)
                throw this + " length " + a.length;
            for (var i = 0; i < 256; i++)
                if (a[i] !== ((i << 8) | i))
                    throw this + " failed " + i + "=" + a[i]
                + " != " + ((i << 8) | i);
            console.debug("readArrayBuffer was OK");
            storetestchain(this);
        },
        function(e) {
            throw this + " readArrayBuffer failed " + e + " " + this;
        });
 
}

function writeArrayBuffer(store) {
    var a = new Uint16Array(256);
    for (var i = 0; i < 256; i++)
        a[i] = ((i << 8) | i);
    store.write(
        "test/test.dat",
        a.buffer,
        function() {
            if (this !== store)
                throw "Not the same";
            console.debug("writeArrayBuffer was OK");
            storetestchain(this);
        },
        function(e) {
            throw this + " writeArrayBuffer failed " + e;
        });
}

var chain;

function storetestchain(store) {
    if (chain.length > 0) {
        var fn = chain.shift();
        fn(store);
    } else {
        console.debug("All tests complete");
    }
}

var DEBUG = true;

function storetests(Class) {
    "use strict";

    $(document)
        .ready(function() {
            var store = new Class({
                ok: function() {
                    console.debug("Store created OK");
                    chain = [ writeArrayBuffer, readArrayBuffer,
                              writeString, readString ];
                    storetestchain(this);
                },
                fail: function(e) {
                    throw "Failed " + e;
                },
                identify: function(ok) {
                    ok("TestUser", "123pass456");
                }
            })
        });
}
