/*@preserve Copyright (C) 2019-2023 Crawford Currie http://c-dot.co.uk license MIT*//*eslint-env node, mocha */

import { StoreTester } from "./StoreTester.js";

const suite = describe("LocalStorageStore", () => {
  before(() => {
    let prom;
    if (typeof localStorage === 'undefined') {
      prom = Promise.all([
        import("node-localstorage"),
        import("tmp-promise"),
      ])
      .then(mods => {
             // Use dom-storage to simulate localStorage with node.js
             // This is not countd as a browser dyamic-dependency because
             // it's for node.js only
             const LocalStorage = mods[0].LocalStorage;
        const tmp = mods[1].default;
        // Use dom-storage to simulate localStorage with node.js
        return tmp.dir()
        .then(d => {
          const ls = new LocalStorage(d.path);
          global.localStorage = ls;
        });
      });
    } else
      prom = Promise.resolve();
    return prom.then(() => new StoreTester(["LocalStorageStore"]).setup(suite));
  });

  it("Placeholder", () => {});
});
