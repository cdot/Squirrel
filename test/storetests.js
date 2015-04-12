function report(s) {
    console.debug(s);
    $('body').append("<p>" + s + "</p>");
}

const TESTR = "1234567";

function readString(store) {
    store.reads(
        "test/test.dat",
        function(str) {
            if (this !== store)
                throw "Not the same";
            if (str != TESTR)
                throw str + " != " + TESTR;
            report("readString was OK");
            storetestchain(this);
        },
        function(e) {
            throw this + " readString failed " + e + " " + this;
        });
 
}

function writeString(store) {
    var a = TESTR;
    store.writes(
        "test/test.dat",
        a,
        function() {
            if (this !== store)
                throw "Not the same";
            report("writeString was OK");
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
            var a = new Uint8Array(ab);
            if (a.length !== 255)
                throw this + " length " + a.length;
            for (var i = 0; i < 255; i++)
                if (a[i] !== i)
                    throw this + " failed " + i + "=" + a[i]
                + " != " + ((i << 8) | i);
            report("readArrayBuffer was OK");
            storetestchain(this);
        },
        function(e) {
            throw this + " readArrayBuffer failed " + e + " " + this;
        });
 
}

function writeArrayBuffer(store) {
    // Deliberately make it an odd length to throw off 16-bit-assuming
    // conversions
    var a = new Uint8Array(255);
    for (var i = 0; i < 255; i++)
        a[i] = i;
    store.write(
        "test/test.dat",
        a.buffer,
        function() {
            if (this !== store)
                throw "Not the same";
            report("writeArrayBuffer was OK");
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
        console.debug("Running " + fn.name);
        fn(store);
        console.debug("Ran " + fn.name);
    } else {
        report("All tests complete");
    }
}

var DEBUG = true;

function storetests(Class, Underclass) {
    "use strict";

    $(document)
        .ready(function() {
            $("<img>")
                .attr("id", "stegamage")
                .attr("src", "../images/squirrel.png")
                .on("load", function() {
                    $(this).off("load");
                    var store = new Class({
                        ok: function() {
                            report(Class.name + " created OK");
                            chain = [ writeArrayBuffer, readArrayBuffer,
                                      writeString, readString ];
                            storetestchain(this);
                        },
                        fail: function(e) {
                            throw "Failed " + e;
                        },
                        identify: function(ok) {
                            ok("TestUser", "123pass456");
                        },
                        understore: function(p) {
                            report("Create engine " + Underclass.name);
                            return new Underclass(p);
                        }
                    })
                })
                .appendTo($("body"));
        });
}
