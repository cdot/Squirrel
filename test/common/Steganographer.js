/*@preserve Copyright (C) 2019 Crawford Currie http://c-dot.co.uk license MIT*//*eslint-env node, mocha */

import { assert } from "chai";
import { Steganographer } from "../../src/common/Steganographer.js";
import { Utils } from "../../src/common/Utils.js";
import { jsdom } from "../jsdom.js";
import Path from "path";
const __dirurl = Path.dirname(import.meta.url);
const test_image_url = `${__dirurl}/../fixtures/test_image.png`;

import { fileURLToPath } from "url";
const __dirname = Path.dirname(fileURLToPath(import.meta.url));

const TESTR = "1234567普通话/普通話العَرَبِيَّة";

describe("Steganographer", () => {

  let Canvas;

  before(
    () => jsdom()
    .then(() => {
      if (typeof global !== "undefined") {
        return import("canvas")
        .then(mod => Canvas = mod);
      } else
        return Promise.resolve();
    }));

  function UNit() {}

  it("insert.extract small", function() {
    return Utils.loadImageData(test_image_url)
	  .then(iData => {
		  const steg = new Steganographer();
		  let a = Utils.StringToUint8Array(TESTR);
		  steg.insert(a, iData.data);

			const gets = new Steganographer();
			assert.deepEqual(gets.extract(iData.data), a);
		});
  });

  it("insert.extract large", function() {
    return Utils.loadImageData(test_image_url)
	  .then(iData => {
		  const steg = new Steganographer();
	    const len = 287993; // bytes, capacity of a 640x400 image
		  const a = new Uint8Array(len);
		  for (let i = 0; i < len; i++)
			  a[i] = (i & 0xFF);
		  steg.insert(a, iData.data);

			const gets = new Steganographer();
			const b = gets.extract(iData.data);

      assert.equal(b.length, a.length);
      for (let i = 0; i < a.length; i++)
        assert.equal(b[i], a[i], `at ${i}`);
	  });
  });

  it("insert too big", function() {
    return Utils.loadImageData(test_image_url)
	  .then(iData => {
		  const steg = new Steganographer();
	    const len = 287994; // bytes, capacity of a 640x400 image
		  const a = new Uint8Array(len);

		  try {
        steg.insert(a, iData.data);
        assert.fail("Unexpected");
      } catch (e) {
      }
	  });
  });

  it("no message", function() {
    return Utils.loadImageData(test_image_url)
	  .then(iData => {
			const gets = new Steganographer();
			try {
        gets.extract(iData.data);
        assert.fail("Unexpected");
      } catch (e) {
      }
	  });
  });

  it("insert nothing", function() {
    return Utils.loadImageData(test_image_url)
	  .then(iData => {
		  const steg = new Steganographer();
		  const a = new Uint8Array();
		  steg.insert(a, iData.data);

			const gets = new Steganographer();
			const b = gets.extract(iData.data);

      assert.equal(b.length, 0);
    });
  });
});

