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

    // We're storing base64, so we only need 7 bits per character
    this.steganographer = new Steganography(4, 7);

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

StegaStore.prototype.read = function(path, ok, fail, options) {
    "use strict";

    var self = this;

    this.engine.read(
        path,
        function(xdata) {
            var data;
            try {
                 // Make a data-URI from the base64 xdata
                var datauri = "data:image/png;base64," + xdata;
                data = self.steganographer.extract(datauri);
                $("#stegamage").attr("src", datauri);
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

StegaStore.prototype.write = function(path, data, ok, fail) {
    "use strict";

    var $image = $("#stegamage");

    var xdata;
    try {
        var capacity = this.steganographer.getCapacity($image[0]);
        if (capacity < data.length)
            throw "Insufficient hiding capacity in that image. Need "
            + data.length + " but the image will only accomodate " +
            capacity;
        var datauri = this.steganographer.inject(data, $image[0]);
        xdata = Utils.dataURItoBlob(datauri);
    } catch (e) {
        fail.call(this, e);
        return;
    }

    var self = this;
    this.engine.write(
        path,
        xdata,
        function() {
            ok.call(self);
        },
        fail);
};
