/*@preserve Copyright (C) 2019-2023 Crawford Currie http://c-dot.co.uk license MIT*//*eslint-env node, mocha */

import { StoreTester } from "../StoreTester.js";
import tmp from "tmp-promise";

const suite = describe("FileStore", () => {
  before(
    () => tmp.dir()
    .then(d => new StoreTester([
      "../src/stores", "FileStore"
    ]).setup(suite, {
      path: d.path
    })));

  it("Placeholder", () => {});
});
