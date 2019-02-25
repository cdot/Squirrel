/*@preserve Copyright (C) 2015 Crawford Currie http://c-dot.co.uk license MIT*/
/* eslint-env browser */

/* global Utils:true */
/* global LayeredStore:true */
/* global Steganographer:true */
if (typeof module !== "undefined") {
    Utils = require("../src/Utils");
    LayeredStore = require('../src/LayeredStore');
    Steganographer = require("../src/Steganographer");
}

/**
 * @class
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
        this.option("needs_image", true);
    }

    read(path) {
        if (this.debug) this.debug("StegaStore: reading " + path);

        return super.read(path)
            .then((ab) => {
                // Make a data-URI
                let datauri = "data:image/png;base64," +
                    Utils.ArrayBufferToBase64(ab);
                let el = document.getElementById("stegamage");
                let steg = new Steganographer(el);
                if (datauri !== el.src) {
                    // if the image has changed, wait for it to reload
                    return new Promise((resolve, reject) => {
                        el.onload = function () {
                            el.onload = undefined;
                            resolve(steg.extract());
                        };
                        el.src = datauri;
                    });
                }
                return steg.extract();
            });
    }

    write(path, data) {
        if (this.debug) this.debug("StegaStore: writing " + path);

        let image = document.getElementById("stegamage");
        if (!image)
            throw new Error("no #stegamage");

        let steg = new Steganographer({ image: image, debug: this.debug });
        let canvas = steg.insert(data);
        // Get the bit data as an ArrayBuffer
        // Bit convoluted, but can't see another way to do it
        let datauri = canvas.toDataURL();
        let b64 = datauri.split(",", 2)[1];
        let xdata = Utils.Base64ToArrayBuffer(b64);

        return super.write(path, xdata);
    }
}

if (typeof module !== "undefined")
    module.exports = StegaStore;
