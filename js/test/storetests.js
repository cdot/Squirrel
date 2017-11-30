function report(s) {
    console.debug(s);
    $('body').append("<p>" + s + "</p>");
}

const TESTR = "1234567";
const DATASIZE = 89344;

var store;

var tests = [
/*
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
                report("writeString FAILED " + e);
                ready();
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
                report("readString FAILED: " + e);
                ready();
            });
        
    },
*/
    function(ready) {
        console.debug("Running writeArrayBuffer");
        // Deliberately make it an odd length to throw off 16-bit-assuming
        // conversions
        var a = new Uint8Array(DATASIZE);
        for (var i = 0; i < DATASIZE; i++)
            a[i] = (i+1) & 255;
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
                report("writeArrayBuffer FAILED " + e);
                ready();
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
                if (a.length !== DATASIZE) {
                    report("FAILED length " + a.length + " != " + DATASIZE);
                    ready();
                    return;
                }
                for (var i = 0; i < DATASIZE; i++)
                    if (a[i] !== ((i + 1) & 255)) {
                        report("FAILED " + (i & 255) + "=" + a[i]);
                        ready();
                        return;
                    }
                    + " != " + ((i << 8) | i);
                report("readArrayBuffer was OK");
                ready();
            },
            function(e) {
                report("readArrayBuffer FAILED " + e + " " + this);
                ready();
            });
    },
/*
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
                report("write0 FAILED " + e);
                ready();
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
                if (a.length !== 0) {
                    report("length " + a.length);
                    ready();
                    return;
                }
                report("read0 was OK");
                ready();
            },
            function(e) {
                report("read0 FAILED " + e + " " + this);
                ready();
            });
    },
*/
    function(ready) {
        report("Tests complete");
    }
];

var DEBUG = true;

function storetests(Class, Underclass, UnderUnderclass) {
    "use strict";

    $(document)
        .ready(function() {
            $("<img>")
                .attr("id", "stegamage")
                .attr("src", "../images/GCHQ.png")
//                .attr("src", "../images/squirrel.png")
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
