/* 
 * Copyright 2015 Crawford Currie http://c-dot.co.uk
 * Steganography using the alpha-channel in an image.
 * Using the alpha channel this way is OK but it's a bit of a giveaway.
 * It might be better to make use of the lower order bits of the
 * colour channels - though something seems to play silly buggers with
 * any values I store there :-(
 */

/**
 * Constructor.
 * @param image An Image, HTMLImageElement or String data-URL
 */
function Steganographer(image, maxChunk) {
    "use strict";

    this.maxChunk = maxChunk || 8;
    if (this.maxChunk > 8)
        this.maxChunk = 8;

    if (typeof image === "string") {
        var dataURL = image;
        this.image = new Image();
        this.image.src = image;
    } else
        this.image = image;
}

/**
 * @private
 * static
 */
Steganographer.isPrime = function(n) {
    "use strict";

    if (isNaN(n) || !isFinite(n) || n % 1 || n < 2)
        return false;
    if (n % 2 === 0)
        return n === 2;
    if (n % 3 === 0)
        return n === 3;
    var m = Math.sqrt(n);
    for (var i = 5; i <= m; i += 6) {
        if (n % i === 0)
            return false;
        if (n % (i + 2) === 0)
            return false;
    }
    return true;
};

/**
 * @private
 * static
 */
Steganographer.findNextPrime = function(n) {
    "use strict";

    if ((n & 1) === 0)
        n++;
    while (!Steganographer.isPrime(n))
        n += 2;
    return n;
};

/**
 * @private
 * Adjust parameterschunkSize until the data fits as well as
 * possible into the image (minimum number of bits-per-pixel used)
 * @param size size of data to fit, in 16-bit units
 * @param image image to fit it in
 * @return chunkSize if the image can be made to fit, -1 times
 * the number of bits that can't be stored otherwise
 */
Steganographer.prototype.adjustToFit = function(size) {
    var bits = size * 8;
    
    // 9 pixels needed for length and chunkSize
    var slots = this.image.width * this.image.height - 9;

    var chunkSize = (bits / slots + 1) >> 0;

    if (chunkSize > this.maxChunk) {
        return -(bits - this.maxChunk * slots);
    }

    console.debug("Steg: Computed chunk size " + chunkSize
                  + " (" + slots + " slots, capacity "
                  + chunkSize * slots + " bits, "
                  + chunkSize * slots / 8 + " bytes)");

    return chunkSize;
};

/**
 * Inject some content into the given image
 * @param data the content, in an ArrayBuffer.
 * @throws if the image doesn't have enough capacity given the
 * current parameters
 */
Steganographer.prototype.inject = function(data) {
    // Can't "use strict"; because of the image manipultaion

    var a8 = new Uint8Array(data);

    console.debug("Steg: Embedding " + a8.length + " bytes ("
                  + (a8.length * 8) + " bits)");

    var shadowCanvas = document.createElement("canvas");
    shadowCanvas.style.display = "none";
    shadowCanvas.width = this.image.width;
    shadowCanvas.height = this.image.height;

    var shadowCtx = shadowCanvas.getContext("2d");
    shadowCtx.drawImage(this.image, 0, 0);

    var imageData = shadowCtx.getImageData(
        0, 0, shadowCanvas.width, shadowCanvas.height);
    var data = imageData.data;

    // Message broken down into chunks
    var chunks = [];

    var chunkSize = this.adjustToFit(a8.length);
    if (chunkSize <= 0)
        throw {
            message: "Insufficient capacity in the image to hide everything",
            p1: -chunkSize
        };

    // Number of whole chunks required to store a byte of data
    var cpc = (8 / chunkSize) >> 0;

    // Number of bits that have to overlap into the next pixel
    var overlap = 8 % chunkSize;

    // 1 - 2^-chunkSize
    var mcs2 = 1 - Math.pow(2, -chunkSize);

    var decM, oldDec, oldMask, left, right;

    // Break down the data into 'chunkSize' sized chunks
    var i;
    for (i = 0; i <= a8.length; i++) {
        // dec ... i-th byte of the data
        var dec = a8[i];

        // Count of the bits of the previous byte not yet handled
        var curOverlapping = overlap * i % chunkSize;

        var mask; // The raw initial bitmask, will be changed every
        // run and if bits are overlapping

        if (curOverlapping > 0 && oldDec) {
            mask = (1 << chunkSize - curOverlapping) - 1;
            oldMask = 256 * (1 - Math.pow(2, -curOverlapping));
            left = (dec & mask) << curOverlapping;
            right = (oldDec & oldMask) >> 8 - curOverlapping;
            chunks.push(left + right);
            if (i < a8.length) {
                mask = (1 << (2 * chunkSize - curOverlapping)) * mcs2;
                for (var j = 1; j < cpc; j++) {
                    decM = dec & mask;
                    chunks.push(
                        decM >> (j - 1) * chunkSize
                            + (chunkSize - curOverlapping));
                    mask <<= chunkSize;
                }
                if (overlap * (i + 1) % chunkSize === 0) {
                    mask = 256 * mcs2;
                    decM = dec & mask;
                    chunks.push(decM >> 8 - chunkSize);
                } else if (overlap * (i + 1) % chunkSize
                           + (chunkSize - curOverlapping) <= chunkSize) {
                    decM = dec & mask;
                    chunks.push(decM >> (cpc - 1)
                                * chunkSize + (chunkSize - curOverlapping));
                }
            }
        } else if (i < a8.length) {
            // No overlap bits to deal with, push the integral
            // number of chunks
            mask = (1 << chunkSize) - 1;
            for (j = 0; j < cpc; j++) {
                chunks.push((dec >> j * chunkSize) & mask);
            }
        }
        oldDec = dec;
    }

    // Embed data length and chunkSize, using a chunkSize of 4
    var numChunks = chunks.length;
    var offset = 3; // channel
    for (i = 28; i >= 0; i -= 4, offset += 4) {
        data[offset] = 255 - ((numChunks >> i) & 0xF);
    }
    data[offset] = 255 - chunkSize;
    offset += 4;

    // Embed the message using the calculated chunkSize
    var mask = (1 << chunkSize) - 1;
    for (i = 0; i < chunks.length; i++, offset += 4) {
        if (chunks[i] > mask)
            debugger;
        data[offset] = 255 - chunks[i];
    }
    console.debug(
        "Steg: Embedded " + chunks.length + " chunks of "
            + chunkSize + " bits, " + (chunks.length * chunkSize) + " bits / "
            + (chunks.length * chunkSize / 8) + " bytes of data");
    imageData.data = data;
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
    shadowCanvas.width = this.image.width;
    shadowCanvas.height = this.image.height;

    var shadowCtx = shadowCanvas.getContext("2d");
    shadowCtx.drawImage(this.image, 0, 0);

    var imageData = shadowCtx.getImageData(
        0, 0, shadowCanvas.width, shadowCanvas.height);
    var data = imageData.data;

    // Extract data length and chunkSize
    // chunkSize = 4, prime = 17
    var numChunks = 0;
    var offset = 3;
    for (var i = 0; i < 32; i += 4, offset += 4) {
        numChunks = (numChunks << 4) | (255 - data[offset]);
    }
    var chunkSize = 255 - data[offset];
    offset += 4;

    if (numChunks <= 0 || numChunks > data.length
        || chunkSize <= 0 || chunkSize > 8)
        throw "No message embedded";

    var message = new Uint8Array(numChunks * chunkSize >> 3);
    console.debug("Steg: Extracting " + numChunks + " chunks of "
                  + chunkSize + " bits, "
                  + (numChunks * chunkSize) + " bits / "
                  + (numChunks * chunkSize / 8) + " bytes of data");
    var charCode = 0;
    var bitCount = 0;
    var mi = 0;
    for (i = 0; i < numChunks; i++, offset += 4) {
        var mmi = 255 - data[offset];
        charCode += mmi << bitCount;
        bitCount += chunkSize;
        if (bitCount >= 8) {
            message[mi++] = charCode & 0xFFFF;
            bitCount %= 8;
            charCode = mmi >> chunkSize - bitCount;
        }
    }
    if (mi < (numChunks * chunkSize >> 3))
        message[mi++] = charCode & mask;
    console.debug("Steg: Extracted " + message.length + " bytes");
    return message.buffer;
};
