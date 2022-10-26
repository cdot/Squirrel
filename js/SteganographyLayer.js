/*@preserve Copyright (C) 2015-2022 Crawford Currie http://c-dot.co.uk license MIT*/
/* eslint-env node, browser */

define("js/SteganographyLayer", [
	"js/LayeredStore", "js/Serror", "js/Steganographer"
], (LayeredStore, Serror, Steganographer) => {

	function _createCanvas(w, h) {
		const canvas = document.createElement('canvas');
		canvas.width = w;
		canvas.height = h;
		return canvas;
	}

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
			.then(png => {
				// Decode PNG data by converting to base 64 and then
				// creating an image with the resulting data URL
				let b64 = 'data:image/png;base64,';
				for (let i = 0; i < png.length; i++) {
					b64 += String.fromCharCode(png[i]);
				}
				return new Promise(resolve => {
					const img = document.createElement("img");
					img.src = b64;
					$(img).on("load", () => resolve(img));
				});
			})
			.then(img => {
				const canvas = _createCanvas(img.width, img.height);
				const cxt = canvas.getContext('2d');
				cxt.drawImage(img, 0, 0);
				return cxt.getImageData(0, 0, img.width, img.height);
			})
			.then(id => this.steg.extract(id));
    }

		/**
		 * @override
		 */
    write(path, data) {
      if (this.debug) this.debug("write", path);
			const url = this.option("image");
			if (!url)
				return Promise.reject(new Serror(500, "No image"));

			const img = document.createElement('img');
			img.src = url;
			return new Promise(resolve => $(img).on('load', () => {
				// Need to recreate the canvas each time, because
				// Steganographer is destructive; it overwrites the
				// ImageData it is given.
				const canvas = _createCanvas(img.width, img.height);
				const cxt = canvas.getContext('2d');
				cxt.drawImage(img, 0, 0 );
				resolve(cxt.getImageData(0, 0, img.width, img.height));
			}))
			.then(imageData => this.steg.insert(data, imageData))
			.then(id => {
				// Encode as a PNG (lossless)
				const canvas = _createCanvas(id.width, id.height);
				const cxt = canvas.getContext('2d');
				cxt.putImageData(id, 0, 0 );
				const dataURL = canvas.toDataURL('image/png', 1);
				// Convert the base64 part of the data URL back to binary
				const data = dataURL.substr(dataURL.indexOf(",") + 1);
				const array = new Uint8Array(data.length);
				for (let i = 0; i < data.length; i++)
					array[i] = data.charCodeAt(i);
				return array;
			})
			.then(png => super.write(path, png));
    }
  }

  return SteganographyLayer;
});
