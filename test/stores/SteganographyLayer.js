/*@preserve Copyright (C) 2019-2023 Crawford Currie http://c-dot.co.uk license MIT*//*eslint-env node, mocha */

import { StoreTester } from "../StoreTester.js";
import {jsdom} from "../jsdom.js";
import Path from "path";
import { fileURLToPath } from "url";
const __dirname = Path.dirname(fileURLToPath(import.meta.url));

const suite = describe("SteganographyLayer", () => {
  before(
    () => jsdom()
    .then(() => new StoreTester([
      "../src/stores", "SteganographyLayer",
      "../src/stores", "FileStore"
    ])
          .setup(suite, {
            //debug: console.debug,
            path: "/tmp",
            image: "file://" +
            Path.normalize(`${__dirname}/../fixtures/test_image.png`)
          })));

  it("Placeholder", () => {});
});
