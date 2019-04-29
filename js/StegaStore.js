/*@preserve Copyright (C) 2015 Crawford Currie http://c-dot.co.uk license MIT*/
/* eslint-env browser */

define("js/StegaStore", ["js/LayeredStore", "js/Steganographer"], function(LayeredStore, Steganographer) {

    /**
     * Store engine for data embedded in the alpha channel of an image. Uses
     * an underlying engine to actually store the image data.
     *
     * Requires a DOM <image> (not <img>!) with id "stegamage"
     *
     * @param params: Standard for LayeredStore
     * @implements LayeredStore
     */
    class StegaStore extends LayeredStore {

        constructor(p) {
            super(p);
            this.steg = new Steganographer({ debug: this.debug });
            this.type = "StegaStore/" + this.type;
            this.option("needs_image", true);
        }

        read(path) {
            if (this.debug) this.debug("read", path);
            return super.read(path)
            .then((a) => {
                return this.steg.extract(a);
            });
        }

        write(path, data) {
            if (this.debug) this.debug("write", path);

            // Get the source image
            let image = document.getElementById("stegamage");
            Serror.assert(image, "no #stegamage");

            let imageData = this.steg.insert(data, image);
            return super.write(path, imageData);
        }
    }

    return StegaStore;
});
