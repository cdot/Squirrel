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
    var bits = size * 16;
    
    // 9 pixels needed for length and chunkSize
    var slots = this.image.width * this.image.height - 9;

    var chunkSize = (bits / slots + 1) >> 0;

    if (chunkSize > this.maxChunk) {
        return -(bits - this.maxChunk * slots);
    }

    console.debug("Steg: chunk size " + chunkSize
                  + " (" + slots + " slots, "
                  + chunkSize * slots / 16 + " chars)");

    return chunkSize;
};

/**
 * Inject some content into the given image
 * @param data the content, as a String or ArrayBuffer. If
 * it's an ArrayBuffer, it's divided into 16-bit units.
 * @throws if the image doesn't have enough capacity given the
 * current parameters
 */
Steganographer.prototype.inject = function(data) {
    // Can't "use strict"; because of the image manipultaion

    var message, i;
    if (typeof data === "string") {
        message = new Uint16Array(data.length);
        for (i = 0; i < data.length; i++)
            message[i] = data.charCodeAt(i);
    }
    else
        message = new Uint16Array(data);

    var shadowCanvas = document.createElement("canvas");
    shadowCanvas.style.display = "none";
    shadowCanvas.width = this.image.width;
    shadowCanvas.height = this.image.height;

    var shadowCtx = shadowCanvas.getContext("2d");
    shadowCtx.drawImage(this.image, 0, 0);

    var imageData = shadowCtx.getImageData(
        0, 0, shadowCanvas.width, shadowCanvas.height);
    var data = imageData.data;

    // Message broken down into 't'-sized chunks
    var chunks = [];

    var chunkSize = this.adjustToFit(message.length);
    if (chunkSize <= 0)
        throw {
            message: "Insufficient capacity",
            p1: -chunkSize
        };

    // Number of whole chunks required to store the data
    // in a single 16-bit unit
    var cpc = (16 / chunkSize) >> 0;

    // Number of bits that have to overlap into the next pixel
    var overlap = 16 % chunkSize;

    // 1 - 2^-chunkSize
    var mcs2 = 1 - Math.pow(2, -chunkSize);

    var decM, oldDec, oldMask, left, right, i, curOverlapping;

    // Break down the message into 'chunkSize' sized chunks
    for (i = 0; i <= message.length; i++) {
        // dec ... UTF-16 Unicode of the i-th character of the message
        dec = message[i];

        // Count of the bits of the previous character not yet handled
        curOverlapping = overlap * i % chunkSize;

        // mask ... The raw initial bitmask, will be changed every
        // run and if bits are overlapping

        if (curOverlapping > 0 && oldDec) {
            mask = (1 << chunkSize - curOverlapping) - 1;
            oldMask = 65536 * (1 - Math.pow(2, -curOverlapping));
            left = (dec & mask) << curOverlapping;
            right = (oldDec & oldMask) >> 16 - curOverlapping;
            chunks.push(left + right);
            if (i < message.length) {
                mask = (1 << (2 * chunkSize - curOverlapping)) * mcs2;
                for (var j = 1; j < cpc; j++) {
                    decM = dec & mask;
                    chunks.push(
                        decM >> (j - 1) * chunkSize + (chunkSize - curOverlapping));
                    mask <<= chunkSize;
                }
                if (overlap * (i + 1) % chunkSize === 0) {
                    mask = 65536 * mcs2;
                    decM = dec & mask;
                    chunks.push(decM >> 16 - chunkSize);
                } else if (overlap * (i + 1) % chunkSize
                           + (chunkSize - curOverlapping) <= chunkSize) {
                    decM = dec & mask;
                    chunks.push(decM >> (cpc - 1)
                                    * chunkSize + (chunkSize - curOverlapping));
                }
            }
        } else if (i < message.length) {
            // No overlap bits to deal with, push the integral
            // number of chunks
            mask = (1 << chunkSize) - 1;
            for (j = 0; j < cpc; j++) {
                decM = dec & mask;
                chunks.push(decM >> j * chunkSize);
                mask <<= chunkSize;
            }
        }
        oldDec = dec;
    }

    // Embed data length and chunkSize, using a chunkSize of 4
    var len = chunks.length;
    var offset = 3; // channel
    for (i = 28; i >= 0; i -= 4, offset += 4) {
        data[offset] = 255 - ((len >> i) & 0xF);
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
    var len = 0;
    var offset = 3;
    for (var i = 0; i < 32; i += 4, offset += 4) {
        len = (len << 4) | (255 - data[offset]);
    }
    var chunkSize = 255 - data[offset];
    offset += 4;

    if (len === 0 || len > data.length || chunkSize === 0 || chunkSize > 8)
        throw "No message embedded";

    // SMELL: byte order?
    var message = new Uint16Array((len * chunkSize / 16) >> 0)
    var charCode = 0;
    var bitCount = 0;
    var mask = (1 << 16) - 1;
    var mi = 0;
    for (i = 0; i < len; i++, offset += 4) {
        var mmi = 255 - data[offset];
        charCode += mmi << bitCount;
        bitCount += chunkSize;
        if (bitCount >= 16) {
            message[mi++] = charCode & mask;
            bitCount %= 16;
            charCode = mmi >> chunkSize - bitCount;
        }
    }

    return message.buffer;
};
