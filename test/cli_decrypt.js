// Decode a pre-existing encrypted file
// OPTIONS:
// path=<path to dir containing files>
// input=<file to decode>
// output=<file to write re-encrypted in latest format>
// pass=<decoding pass>
// debug=1 to enable debug
// format=N to enable version N encryption format
if (typeof requirejs === "undefined")
    requirejs = require('requirejs');

requirejs.config({
    baseUrl: ".."
});

requirejs(["js/FileStore", "js/EncryptedStore"], function(FileStore, EncryptedStore) {
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

