/*@preserve Copyright (C) 2015 Crawford Currie http://c-dot.co.uk license MIT*/

/* global DEBUG */

/* 
 * Steganography using the least-significant bits of the
 * colour channels in an image.
 *
 * We use the colour channels because using the alpha channel is a dead
 * giveaway that stenography is being used. Using the colour channels
 * will give some chromatic perturbation than might act as a statistical
 * signature, as a normal image will have runs of equal, or close,
 * pixel values, and injecting random data will confuse that. We try to
 * make it hard to detect by only using a small number of bits from each
 * channel, such that the data just looks like stochastic noise.
 */

/**
 * Constructor.
 * @param image An Image, HTMLImageElement or String data-URL. The image
 * will be used as the source of hidden data, or the template for a new
 * embedded image, depending on what methods you call.
 * @param maxChunk override the default maximum number of bits per colour
 * channel to use. The default is 3, which is a reasonable compromise between
 * information capacity and image degradation.
 */
function Steganographer(image, maxChunk) {
    "use strict";

    // Messages are stored in chunks held in the least significant
    // bits of the three colour channels. The theoretical maximum
    // chunk size, using all the bits of the colour channels, would
    // be 8 bits, but that would replace the image.
    // The degradation becomes rapidly apparent beyond 3 bits, so that
    // is our default.
    this.maxChunk = maxChunk || 3;

    if (typeof image === "string") {
        this.image = new Image();
        this.image.src = image;
    } else
        this.image = image;
}

/**
 * @private
 * Adjust chunkSize until the data fits as well as
 * possible into the image (minimum number of bits-per-channel used)
 * @param size size of data to fit, in bytes
 * @param image image to fit it in
 * @return chunkSize if the image can be made to fit, -1 times
 * the number of bits that can't be stored otherwise
 */
Steganographer.prototype.adjustToFit = function(size) {
    "use strict";

    var bits = size * 8; // Number of bits to be stored
    
    // number of chunks (32 bits) and chunk size (4 bits) are stored
    // 2 bits per channel, so that means 18 channels, 3 channels
    // per pixel so need 6 pixels for this info.
    var slots = 3 * this.image.naturalWidth * this.image.naturalHeight - 6;

    var chunkSize = (bits / slots + 1) >> 0;
    if (DEBUG) console.debug(
        "Storage required " + bits + " bits, " + size + " bytes"
            + " Max image capacity "
            + this.maxChunk * slots + " bits, "
            + this.maxChunk * slots / 8 + " bytes");

    if (chunkSize > this.maxChunk) {
        if (DEBUG) console.debug(
            "Steg: Computed chunk size " + chunkSize
                + " is > " + this.maxChunk
                + ", oversized by " + (-slots * (this.maxChunk - chunkSize))
                + " bits");
        throw (slots * (chunkSize - this.maxChunk))
            + " bits too many to hide in this image";
    }

    if (DEBUG) console.debug(
        "Steg: Computed chunk size " + chunkSize
            + " (" + slots + " slots)");

    return chunkSize;
};

/**
 * Inject some content into the given image
 * @param data the content, in an ArrayBuffer. Size must be <= (2^32-1)
 * @return a canvas object containing the resulting image, not
 * attached to the document.
 * @throws if the image doesn't have enough capacity given the
 * current parameters. The exception is a structure containing a message
 * and the number of bits that could *not* be accomodated.
 */
Steganographer.prototype.inject = function(message) {
    // Can't "use strict"; because of the image manipultaion

    var a8 = new Uint8Array(message);

    if (DEBUG) console.debug(
        "Steg: Embedding " + a8.length + " bytes ("
            + (a8.length * 8) + " bits)");

    var shadowCanvas = document.createElement("canvas");
    shadowCanvas.style.display = "none";
    shadowCanvas.width = this.image.naturalWidth;
    shadowCanvas.height = this.image.naturalHeight;

    var shadowCtx = shadowCanvas.getContext("2d");
    shadowCtx.drawImage(this.image, 0, 0);

    var imageData = shadowCtx.getImageData(
        0, 0, shadowCanvas.width, shadowCanvas.height);
    var iData = imageData.data;

    // The image data consists of width*height pixels, where each pixel
    // is 4 bytes (RGBA)

    // We have to init the alpha channel of the image to fully opaque,
    // otherwise color values can't be manipulated. If we manipulate
    // colour, we can't modify transparency, and if we manipulate
    // transparency, we lose control over colour. Better on balance to
    // use the colour channels to store our secrets.
    for (var i = 3; i < iData.length; i += 4)
        iData[i] = 0xFF;

    var a8_len = a8.length;
    var chunkSize = this.adjustToFit(a8_len);

    // We reserve the first 24 bytes (6 pixels) for the data length (32 bits)
    // and chunk size (4 bits) packed 2 bits per colour channel.
    var byte_i = 24;

    var chunkMask = (1 << chunkSize) - 1;
    var iChunkMask = ~chunkMask;

    // Function to add a chunk into the image. c <= chunkMask
    var numChunks = 0;
    var addChunk = function(c) {
        iData[byte_i] = (iData[byte_i] & iChunkMask) | c;
        byte_i++;
        if (byte_i % 4 === 3)
            byte_i++; // skip alpha channel
        numChunks++;
    };
    
    // 00000001 00000010 00000011 00000100 00000101
    // 001 000 000 001 000 110 000 000 100 000 100
    //   1   0   0   1   0   6   0   0   4   0   4
    var a8_i;        // the i'th byte, shifted as we remove chunks
    var a8_iM1;      // what remains of the i-1'th byte
    var bits;        // Number of bits remaining to process in the i'th byte
    var pending = 0; // number of bits still pending from the i-1'th byte
    for (i = 0; i < a8_len; i++) {
        a8_i = a8[i];
        bits = 8;
        if (pending > 0) {
            // Remaining (high) bits of previous byte combined with
            // low order bits of current byte
            addChunk((a8_iM1 & (chunkMask >> (chunkSize - pending)))
                     | ((a8_i & (chunkMask >> pending)) << pending));
            a8_i >>= (chunkSize - pending);
            bits -= (chunkSize - pending);
        }
        // Get as many whole chunks from the byte as we can
        while (bits >= chunkSize) {
            addChunk(a8_i & chunkMask);
            a8_i >>= chunkSize;
            bits -= chunkSize;
        }
        pending = bits;
        a8_iM1 = a8_i;
    }
    if (pending > 0) {
        // Push the final partial chunk
        addChunk(a8_iM1);
    }

    // Embed data length and chunkSize using 2 bits from each
    // colour channel (6 bits per pixel, 32 bit length + 4 bit chunksize
    // = 36bits, so 6 pixels (24 bytes) is just perfect.
    byte_i = 0;
    var shift = 30;
    while (shift >= 0) {
        for (var channel = 0; channel < 3 && shift >= 0; channel++) {
            iData[byte_i] = (iData[byte_i] & 0xFC)
                | ((numChunks >> shift) & 0x3);
            shift -= 2;
            byte_i++;
            if (byte_i % 4 === 3)
                byte_i++; // skip alpha channel
        }
    }

    // That leaves just two channels for 2 bits of the chunkSize each
    iData[byte_i] = (iData[byte_i] & 0xFC) | ((chunkSize >> 2) & 0x3);
    byte_i++;
    iData[byte_i] = (iData[byte_i] & 0xFC) | (chunkSize & 0x3);
    byte_i += 2; // blue + alpha

    if (DEBUG) console.debug(
        "Steg: Embedded " + numChunks + " chunks of "
            + chunkSize + " bits, " + (numChunks * chunkSize) + " bits / "
            + (numChunks * chunkSize / 8) + " bytes of data");

    imageData.data = iData;
    shadowCtx.putImageData(imageData, 0, 0);

    return shadowCanvas;
};

/**
 * Extract the content hidden in the given image
 * @param image An Image, HTMLImageElement or data-URL to embed the message in
 * @return an ArrayBuffer containing the content
 * @throws if the image doesn't seem to have anything embedded
 */
Steganographer.prototype.extract = function() {
    "use strict";

    var shadowCanvas = document.createElement("canvas");
    shadowCanvas.style.display = "none";
    shadowCanvas.width = this.image.naturalWidth;
    shadowCanvas.height = this.image.naturalHeight;

    var shadowCtx = shadowCanvas.getContext("2d");
    shadowCtx.drawImage(this.image, 0, 0);

    var imageData = shadowCtx.getImageData(
        0, 0, shadowCanvas.width, shadowCanvas.height);
    var iData = imageData.data;

    // Extract data length and chunkSize
    // chunkSize = 4, prime = 17
    var numChunks = 0;
    var byte_i = 0;
    for (var i = 0; i < 32; i += 2) {
        numChunks = (numChunks << 2) | (iData[byte_i] & 0x3);
        byte_i++;
        if (byte_i % 4 === 3)
            byte_i++; // skip alpha channel
    }

    var chunkSize = (iData[byte_i++] & 0x3) << 2;
    chunkSize |= iData[byte_i] & 0x3;
    byte_i += 2; // blue and alpha

    if (numChunks < 0 || numChunks > iData.length
        || chunkSize <= 0 || chunkSize > 8)
        throw "No message embedded";

    var message = new Uint8Array((numChunks * chunkSize) >> 3);
    if (DEBUG) console.debug(
        "Steg: Extracting " + numChunks + " chunks of "
            + chunkSize + " bits, "
            + (numChunks * chunkSize) + " bits / "
            + (numChunks * chunkSize / 8) + " bytes of data");

    var charCode = 0;
    var bitCount = 0;
    var mi = 0;
    var chunkMask = (1 << chunkSize) - 1;

    for (i = 0; i < numChunks; i++) {
        var mmi = iData[byte_i++] & chunkMask;
        if (byte_i % 4 === 3)
            byte_i++; // skip alpha channel
        charCode |= mmi << bitCount;
        bitCount += chunkSize;
        if (bitCount >= 8) {
            message[mi++] = charCode & 0xFF;
            bitCount %= 8;
            charCode = mmi >> (chunkSize - bitCount);
        }
    }
    if (mi < ((numChunks * chunkSize) >> 3)) {
        //console.debug("unwhak " + charCode);
        message[mi++] = charCode & 0xFF;
    }
    if (DEBUG) console.debug(
        "Steg: Extracted " + message.length + " bytes");
    return message.buffer;
};
