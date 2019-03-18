if (typeof requirejs === "undefined")
    requirejs = require('requirejs');

requirejs.config({
    baseUrl: ".."
});

requirejs(["js/FileStore", "js/EncryptedStore"], function(FileStore, EncryptedStore) {
    if (process.argv.length < 3) {
        console.log("Decode a pre-existing encrypted file");
        console.log("OPTIONS:");
        console.log("path=<path to dir containing files>");
        console.log("input=<file to decode>");
        console.log("output=<file to write re-encrypted in latest format>");
        console.log("pass=<decoding pass>");
        console.log("debug=1 to enable debug");
        console.log("v1=1 to decrypt old-format");
        console.log("format=N to enable version N encryption format");
        return;
    }
    console.log(process.argv);
    let opt = {};
    for (let i in process.argv) {
        let set = process.argv[i].split("=", 2);
        opt[set[0]] = set[1];
    }
    let debug = typeof opt.debug === "undefined" ? undefined : console.debug;
    let store = new EncryptedStore({
        debug: debug,
        understore: new FileStore({
            role: "static",
            debug: debug
        })
    });
    store.option("pass", opt.pass);
    store.option("path", opt.path);
    store.option("v1", (typeof opt.v1 !== "undefined"));
    if (typeof opt.format !== "undefined") {
        store.option("format", opt.format);
    }
    store.reads(opt.input).then((data) => {
        console.log(data);
        if (opt.output) {
            store.option("format", null);
            store.writes(opt.output, data);
        }
    })
    .catch((e) => {
        console.log("Failed", e);
    });
});

