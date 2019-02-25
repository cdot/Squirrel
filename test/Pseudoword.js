/*@preserve Copyright (C) 2015-2019 Crawford Currie http://c-dot.co.uk license MIT*/

if (typeof assert === "undefined")
    assert = require('chai').assert;
if (typeof Pseudoword === "undefined")
    Pseudoword = require("../src/Pseudoword");

describe("Tests", function() {
    it("Generates", function() {
        let p = new Pseudoword();

        let word = p.getWord(12);
        console.log(word);

        assert.equal(word.length, 12);
    });
});
