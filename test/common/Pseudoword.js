/*@preserve Copyright (C) 2015-2019 Crawford Currie http://c-dot.co.uk license MIT*/

import { assert } from "chai";
import { Pseudoword } from "../../src/common/Pseudoword.js";

describe("Pseudoword", () => {
  it("Generates", function() {
    let p = new Pseudoword();

    let word = p.getWord(12);
    console.log(word);

    assert.equal(word.length, 12);
  });
});
