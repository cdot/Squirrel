/*@preserve Copyright (C) 2015 Crawford Currie http://c-dot.co.uk license MIT*/
/* eslint-env browser */

/* global Utils:true */
/* global LayeredStore:true */
/* global Steganographer:true */
define(["js/Utils", "js/LayeredStore", "js/Steganographer"], function(Utils, LayeredStore, Steganographer) {

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
            p = p || {};
            p.type = "StegaStore";
            p.needs_image = true;
            super(p);
            this.steg = new Steganographer({ debug: this.debug });
        }

        read(path) {
            if (this.debug) this.debug("reading " + path);

            return super.read(path)
                .then((a) => {
                    return this.steg.extract(a);
                });
        }

        write(path, data) {
            if (this.debug) this.debug("StegaStore: writing " + path);

            // Get the source image
            let image = document.getElementById("stegamage");
            if (!image)
                throw new Error("no #stegamage");

            let imageData = this.steg.insert(data, image);
            return super.write(path, imageData);
        }
    }

    return StegaStore;
});
