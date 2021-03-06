/*@preserve Copyright (C) 2015-2019 Crawford Currie http://c-dot.co.uk license MIT*/

if (typeof module !== "undefined") {
    requirejs = require('requirejs');
}

requirejs.config({
    baseUrl: ".."
});

requirejs(["js/Pseudoword", "test/TestRunner"], function(Pseudoword, TestRunner) {
    let tr = new TestRunner("Pseudoword");
    let assert = tr.assert;

    tr.addTest("Generates", function() {
        let p = new Pseudoword();

        let word = p.getWord(12);
        console.log(word);

        assert.equal(word.length, 12);
    });

    tr.run();
});
