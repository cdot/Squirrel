/**
 * @class
 * Store engine for data embedded in the alpha channel of an image. Uses
 * an underlying engine to actually store the image data.
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

    // TODO: get the image from somewhere
    params.dataset = "GCHQ.png";
    $("<img src='images/GCHQ.png' />")
        .hide()
        .appendTo($("body"))
        .on("load", function() {
            self.image = this;
        });
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

StegaStore.prototype.read = function(ok, fail, options) {
    "use strict";

    var self = this;

    this.engine.read(
        function(xdata) {
            var data;
            try {
                // decode takes an image as Image, HTMLImageElement, or
                // String representing the data-URI of the image, and
                // returns the message which was found in the image.
                // We don't have a data-url so we have to compile one.
                var datauri = "data:image/png;base64," + xdata;
                data = steganography.decode(datauri);
            } catch (e) {
                fail.call(self, e);
                return;
            }
            // Do this outside the try..catch to avoid masking
            // exceptions in deeper code.
            if (options && options.base64)
                data = Utils.StringTo64(data);
            ok.call(self, data);
        },
        fail,
        { 
            base64: true
        });
};

StegaStore.prototype.write = function(data, ok, fail) {
    "use strict";

    var self = this;
    var xdata;

    try {
        // encode takes a message as String, and an
        // Image, HTMLImageElement, or String representing the
        // data-URL of the image. Returns a data-URI containing
        // the image with the encoded message inside.
        var datauri = steganography.encode(data, this.image);
        xdata = Utils.dataURItoBlob(datauri);
    } catch (e) {
        fail.call(this, e);
        return;
    }

    this.engine.write(
        xdata,
        function() {
            ok.call(self);
        },
        fail);
};
