/*@preserve Copyright (C) 2019 Crawford Currie http://c-dot.co.uk license MIT*//*eslint-env node, mocha */

import { NodeLocalStorage } from "../NodeLocalStorage.js";
import { StoreTester } from "../StoreTester.js";

const suite = describe("CryptoLayer", () => {
 before(
   () => NodeLocalStorage()
   .then(() => new StoreTester([
     "../src/stores", "CryptoLayer",
     "../src/stores", "LocalStorageStore"
   ]).setup(suite, {
     user: "test", pass: "pass"
   })));

  it("Placeholder", () => {});
});
