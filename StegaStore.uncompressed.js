/**
 * @class
 * Store engine for data embedded in the alpha channel of an image. Uses
 * an underlying engine to actually store the image data.
 *
 * Requires JQuery and a DOM IMG with id "stegamage"
 *
 * @param params: Standard for LayeredStore
 */
function StegaStore(params) {
    "use strict";

    LayeredStore.call(this, params);
}

StegaStore.prototype = Object.create(LayeredStore.prototype);

StegaStore.prototype.read = function(path, ok, fail) {
    "use strict";

    var self = this;
    
    this.engine.read(
        path,
        function(ab) {
            // Make a data-URI
            var datauri = "data:image/png;base64,"
                + Utils.ArrayBufferToBase64(ab);
            $("#stegamage")
                .attr("src", datauri)
                .on("load", function() {
                    $(this).off("load");
                    var steg = new Steganographer(this);
                    var ab2;
                    try {
                        ab2 = steg.extract();
                    } catch (e) {
                        fail.call(self, e);
                        return;
                    }
                    
                    ok.call(self, ab2);
                });
        },
        fail);
};

StegaStore.prototype.write = function(path, data, ok, fail) {
    "use strict";

    var self = this;
    var image = document.getElementById("stegamage");
    if (!image)
        throw "no #stegamage";
    var xdata;
    var steg = new Steganographer(image);

    try {
        var canvas = steg.inject(data, true);
        // Get the bit data as an ArrayBuffer
        // Bit convoluted, but can't see another way to do it
        var datauri = canvas.toDataURL();
        var b64 = datauri.split(",", 2)[1];
        xdata = Utils.Base64ToArrayBuffer(b64);
    } catch (e) {
        fail.call(this, e.message);
        return;
    }

    self.engine.write(
        path,
        xdata,
        function() {
            ok.call(self);
        },
        fail);
};
