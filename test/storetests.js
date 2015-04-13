function report(s) {
    console.debug(s);
    $('body').append("<p>" + s + "</p>");
}

const TESTR = "1234567";
var store;

var tests = [
    function(ready) {
        console.debug("Running writeString");
        var a = TESTR;
        store.writes(
            "test/test.dat",
            a,
            function() {
                if (this !== store)
                    throw "Not the same";
                report("writeString was OK");
                ready();
            },
            function(e) {
                throw this + " writeString failed " + e;
            });
    },

    function(ready) {
        console.debug("Running readString");
        store.reads(
            "test/test.dat",
            function(str) {
                if (this !== store)
                    throw "Not the same";
                if (str != TESTR)
                    throw str + " != " + TESTR;
                report("readString was OK");
                ready();
            },
            function(e) {
                throw this + " readString failed: " + e;
            });
        
    },

    function(ready) {
        console.debug("Running writeArrayBuffer");
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
                ready(this);
            },
            function(e) {
                throw this + " writeArrayBuffer failed " + e;
            });
    },

    function(ready) {
        console.debug("Running readArrayBuffer");
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
                ready();
            },
            function(e) {
                throw this + " readArrayBuffer failed " + e + " " + this;
            });
    },

    function(ready) {
        console.debug("Running write0");
        var a = [];
        store.write(
            "test/test.dat",
            a.buffer,
            function() {
                if (this !== store)
                    throw "Not the same";
                report("write0 was OK");
                ready();
            },
            function(e) {
                throw this + " write0 failed " + e;
            });
    },

    function(ready) {
        console.debug("Running read0");
        store.read(
            "test/test.dat",
            function(ab) {
                if (this !== store)
                    throw "Not the same";
                var a = new Uint8Array(ab);
                if (a.length !== 0)
                    throw this + " length " + a.length;
                report("read0 was OK");
                ready();
            },
            function(e) {
                throw this + " read0 failed " + e + " " + this;
            });
    }
];

var DEBUG = true;

function storetests(Class, Underclass, UnderUnderclass) {
    "use strict";

    $(document)
        .ready(function() {
            $("<img>")
                .attr("id", "stegamage")
                .attr("src", "../images/squirrel.png")
                .on("load", function() {
                    $(this).off("load");
                    var s = new Class({
                        ok: function() {
                            store = this;
                            report(Class.name + " created OK");
                            Utils.execute_queue(
                                tests
                            );
                        },
                        fail: function(e) {
                            throw "Failed " + e;
                        },
                        identify: function(ok) {
                            ok("TestUser", "123pass456");
                        },
                        understore: function(p) {
                            report("Create engine " + Underclass.name);
                            if (UnderUnderclass) {
                                p.understore = function(p) {
                                    report("Create engine " + UnderUnderclass.name);
                                    return new UnderUnderclass(p);
                                }
                            }
                            return new Underclass(p);
                        }
                    })
                })
                .appendTo($("body"));
        });
}
