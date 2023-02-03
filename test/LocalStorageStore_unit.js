/*@preserve Copyright (C) 2019-2023 Crawford Currie http://c-dot.co.uk license MIT*//*eslint-env node, mocha */

import { StoreTester } from "./StoreTester.js";

const suite = describe("LocalStorageStore", () => {
  before(() => new StoreTester(["LocalStorageStore"]).setup(suite));
  it("Placeholder", () => {});
});
