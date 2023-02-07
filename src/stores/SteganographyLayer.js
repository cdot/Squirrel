/*@preserve Copyright (C) 2015-2022 Crawford Currie http://c-dot.co.uk license MIT*/
/* eslint-env node, browser */

import { PNG } from "pngjs/browser.js";

import { Serror } from "../common/Serror.js";
import { Utils } from "../common/Utils.js";
import { Steganographer } from "../common/Steganographer.js";
import { LayeredStore } from "./LayeredStore.js";

/**
 * Store engine for data embedded in the alpha channel of an image. Uses
 * an underlying engine to actually store the image data.
 *
 * Requires the option "image" to be set to the id
 * DOM 'img' object.
 *
 * @extends LayeredStore
 */
class SteganographyLayer extends LayeredStore {

	/**
	 * See {@link LayeredStore} for other constructor options.
	 * Sets `options.needs_image`.
	 */
  constructor(p) {
    super(p);
    this.steg = new Steganographer({ debug: this.debug });
    this.type = `SteganographyLayer/${this.type}`;
    this.option("needs_image", true);
		this.image_id = undefined;
  }

	/**
	 * @override
	 */
  read(path) {
    if (this.debug) this.debug("read", path);
    return super.read(path)
		.then(buff => PNG.sync.read(buff))
		.then(png => this.steg.extract(png.data));
  }

	/**
	 * @override
	 */
  write(path, data) {
    if (this.debug) this.debug("write", path);
		const url = this.option("image");
		if (!url)
			return Promise.reject(new Serror(500, "No image"));

    // The source image may not be PNG...
		return Utils.loadImageData(url)
		.then(imageData => {
      this.steg.insert(data, imageData.data);
      const png = new PNG({
        width: imageData.width,
        height: imageData.height
      });
      png.data = imageData.data;
      return PNG.sync.write(png);
		})
		.then(png => super.write(path, png));
  }
}

export { SteganographyLayer }
