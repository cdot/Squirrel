/*@preserve Copyright (C) 2015 Crawford Currie http://c-dot.co.uk license MIT*/

if (typeof LayeredStore === "undefined")
    LayeredStore = require('./LayeredStore');
if (typeof Steganographer === "undefined")
    Steganographer = require("./Steganographer");
if (typeof Utils === "undefined")
    Utils = require("./Utils");

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
    }

    options(k, v) {
        if (k == "needs_image")
            return Promise.resolve(true);
        return super.options(k, v);
    }

    read(path) {
        if (this.debug) this.debug("StegaStore: reading " + path);

        return super.read(path)
            .then((ab) => {
                // Make a data-URI
                var datauri = "data:image/png;base64," +
                    Utils.ArrayBufferToBase64(ab);
                var el = document.getElementById("stegamage");
                var steg = new Steganographer(el);
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

        var image = document.getElementById("stegamage");
        if (!image)
            throw new Error("no #stegamage");

        var steg = new Steganographer({ image: image, debug: this.debug });
        var canvas = steg.insert(data);
        // Get the bit data as an ArrayBuffer
        // Bit convoluted, but can't see another way to do it
        var datauri = canvas.toDataURL();
        var b64 = datauri.split(",", 2)[1];
        var xdata = Utils.Base64ToArrayBuffer(b64);

        return super.write(path, xdata);
    }
}

if (typeof module !== "undefined")
    module.exports = StegaStore;
