/*@preserve Copyright (C) 2015-2019 Crawford Currie http://c-dot.co.uk license MIT*/

if (typeof module !== "undefined") {
    requirejs = require('requirejs');
}

requirejs.config({
    baseUrl: "..",
    paths: {
        js: "src",
        jsjq: "src/jquery",
        test: "test"
    }
});

describe("Tests", function() {
    before(function(done) {
        return requirejs(["js/Pseudoword", "chai"], function(h, chai) {
            Pseudoword = h;
            assert = chai.assert;
            done();
        });
    });

    it("Generates", function() {
        let p = new Pseudoword();

        let word = p.getWord(12);
        console.log(word);

        assert.equal(word.length, 12);
    });
});
