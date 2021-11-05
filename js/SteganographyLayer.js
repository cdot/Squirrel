/*@preserve Copyright (C) 2015 Crawford Currie http://c-dot.co.uk license MIT*/
/* eslint-env browser */

define("js/SteganographyLayer", ["js/LayeredStore", "js/Serror", "js/Steganographer"], function(LayeredStore, Serror, Steganographer) {

    /**
     * Store engine for data embedded in the alpha channel of an image. Uses
     * an underlying engine to actually store the image data.
     *
     * Requires a DOM <image> (not <img>!) with id "stegamage"
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
        }

		/**
		 * @override
		 */
        read(path) {
            if (this.debug) this.debug("read", path);
            return super.read(path)
            .then((a) => {
                return this.steg.extract(a);
            });
        }

		/**
		 * @override
		 */
        write(path, data) {
            if (this.debug) this.debug("write", path);

            // Get the source image
            let image = document.getElementById("stegamage");
            Serror.assert(image, "no #stegamage");

            let imageData = this.steg.insert(data, image);
            return super.write(path, imageData);
        }
    }

    return SteganographyLayer;
});
