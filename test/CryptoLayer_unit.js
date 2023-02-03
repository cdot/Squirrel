/*@preserve Copyright (C) 2019 Crawford Currie http://c-dot.co.uk license MIT*//*eslint-env node, mocha */

import { StoreTester } from "./StoreTester.js";

const suite = describe("CryptoLayer", () => {
 before(
    () => import("tmp-promise")
    .then(mod => {
      const tmp = mod.default;
      return tmp.dir()
      .then(d => new StoreTester(["CryptoLayer", "LocalStorageStore"]).setup(suite, { user: "test", pass: "pass" }));
    }));
  it("Placeholder", () => {});
});

