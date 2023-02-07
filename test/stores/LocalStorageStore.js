/*@preserve Copyright (C) 2019-2023 Crawford Currie http://c-dot.co.uk license MIT*//*eslint-env node, mocha */

import { NodeLocalStorage } from "../NodeLocalStorage.js";
import { StoreTester } from "../StoreTester.js";

const suite = describe("LocalStorageStore", () => {
  before(() => NodeLocalStorage()
         .then(() => new StoreTester([
           "../src/stores", "LocalStorageStore"
         ]).setup(suite)));

  it("Placeholder", () => {});
});
