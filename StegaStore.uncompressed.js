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

StegaStore.prototype.read = function(path, ok, fail, options) {
    "use strict";

    var self = this;

    this.engine.read(
        path,
        function(xdata) {
            var data;
            try {
                // steganography.decode takes an image as Image,
                // HTMLImageElement, or String representing the
                // data-URI of the image, and returns the message
                // which was found in the image.
                // We don't have a data-url so we have to compile one.
                var datauri = "data:image/png;base64," + xdata;
                data = steganography.decode(datauri);
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

    var self = this;

    var embed = function($image) {
        var xdata;
        try {
            // stegnography.encode takes a message as String, and an
            // Image, HTMLImageElement, or String representing the
            // data-URL of the image. Returns a data-URI containing
            // the image with the encoded message inside.
            var datauri = steganography.encode(data, $image[0]);
            xdata = Utils.dataURItoBlob(datauri);
        } catch (e) {
            fail.call(self, e);
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

    var $img = $("#stegamage");
    // Don't do this; the .complete flag isn't set for data:image urls
    //if (!$img.attr("complete")) {
    //    $img.on("load", function() {
    //        $img.off("load");
    //        embed($img);
    //    });
    //} else
        embed($img);
};

