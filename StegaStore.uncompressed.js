/**
 * @class
 * Store engine for data embedded in the alpha channel of an image. Uses
 * an underlying engine to actually store the image data.
 *
 * Requires JQuery and a DOM IMG with id "stegamage"
 *
 * @param {object} params: Standard for AbstractStore, plus:
 *   * engine Class of storage engine to use under
 *     this layer
 */
function StegaStore(params) {
    "use strict";

    var self = this, pok = params.ok;

    // Push the password requirement down onto the embedded store
    params.pReq = true;
    // Override the OK function
    // SMELL: should really use extend
    params.ok = function() {
        // 'this' is the engine.
        // Don't call AbstractStore(), it doesn't do anything useful
        // for us. The identity prompt has already been issued by the
        // engine constructor.
        self.engine = this;
        pok.call(self);
    };

    new params.engine(params);
}

StegaStore.prototype = Object.create(AbstractStore.prototype);

StegaStore.prototype.identifier = function() {
    "use strict";

    return /* "encrypted " + */ this.engine.identifier();
};

StegaStore.prototype.user = function(u) {
    "use strict";

    return this.engine.user(u);
};

StegaStore.prototype.pass = function(pw) {
    "use strict";

    return this.engine.pass(pw);
};

StegaStore.prototype.read = function(path, ok, fail) {
    "use strict";

    var self = this;

    this.engine.read(
        path,
        function(ab) {
            // Make a data-URI
            var datauri = "data:image/png;base64,"
                + Utils.ArrayBufferTo64(ab);
            $("#stegamage")
                .attr("src", datauri)
                .on("load", function() {
                    var steg = new Steganographer(this);
                    var ab;
                    try {
                        ab = steg.extract();
                    } catch (e) {
                        fail.call(self, e);
                        return;
                    }
                    
                    ok.call(self, ab);
                });
        },
        fail);
};

StegaStore.prototype.write = function(path, data, ok, fail) {
    "use strict";

    var self = this;
    var image = document.getElementById("stegamage");
    var xdata;
    var steg = new Steganographer(image);

    try {
        var canvas = steg.inject(data);
        // Bit convoluted, but can't see another way to do it
        var datauri = canvas.toDataURL();
        // we need to get from the dataURI to an ArrayBuffer
        xdata = Utils.dataURIToArrayBuffer(datauri);
    } catch (e) {
        fail.call(this, e);
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
