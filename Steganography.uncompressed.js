/* 
 * Copyright 2015 Crawford Currie http://c-dot.co.uk
 */

const channel = 3;

/**
 * @param chunkSize Number of LS bits used in each pixel
 * @param bitsPerChar Number of significant bits per data character
 */
function Steganography(chunkSize, bitsPerChar) {
    "use strict";

    this.cs = chunkSize || 3;
    this.bpc = bitsPerChar || 16;
    // Number of 't' blocks required to store the data in a single
    // input data character
    this.cpc = this.bpc / this.cs >> 0;
    // Number of bits that have to overlap into the next pixel
    this.overlap = this.bpc % this.cs;

    // 2^bpc
    this.bpc2 = 1 << this.bpc;
    // 2^cs
    this.cs2 = 1 << this.cs;
    // 2^-cs
    this.mcs2 = Math.pow(2, -this.cs);
    // Find next prime > 2^t
    this.prime = Steganography.findNextPrime(this.cs2);
    this.xp = (255 - this.prime + 1);
}

Steganography.isPrime = function(n) {
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

Steganography.findNextPrime = function(n) {
    "use strict";

    if ((n & 1) === 0)
        n++;
    while (!Steganography.isPrime(n))
        n += 2;
    return n;
};

Steganography.prototype.inject = function(message, image) {
    // Can't "use strict";

    if (image.length) {
        var dataURL = image;
        image = new Image();
        image.src = dataURL;
    }
    var shadowCanvas = document.createElement("canvas");
    shadowCanvas.style.display = "none";
    shadowCanvas.width = image.width;
    shadowCanvas.height = image.height;

    var shadowCtx = shadowCanvas.getContext("2d");
    shadowCtx.drawImage(image, 0, 0);

    var imageData = shadowCtx.getImageData(0, 0, image.width, image.height);
    var data = imageData.data;

    // Message broken down into 't'-sized chunks
    var modMessage = [];

    var dec, decM, oldDec, oldMask, left, right, i, curOverlapping;

    // Break down the message into 't' sized chunks
    for (i = 0; i <= message.length; i++) {
        // dec ... UTF-16 Unicode of the i-th character of the message
        dec = message.charCodeAt(i) || 0;

        // Count of the bits of the previous character not yet handled
        curOverlapping = this.overlap * i % this.cs;

        // mask ... The raw initial bitmask, will be changed every
        // run and if bits are overlapping

        if (curOverlapping > 0 && oldDec) {
            mask = (1 << this.cs - curOverlapping) - 1;
            oldMask = this.bpc2 * (1 - Math.pow(2, -curOverlapping));
            left = (dec & mask) << curOverlapping;
            right = (oldDec & oldMask) >> this.bpc - curOverlapping;
            modMessage.push(left + right);
            if (i < message.length) {
                mask = (1 << (2 * this.cs - curOverlapping))
                    * (1 - this.mcs2);
                for (var j = 1; j < this.cpc; j++) {
                    decM = dec & mask;
                    modMessage.push(
                        decM >> (j - 1) * this.cs + (this.cs - curOverlapping));
                    mask <<= this.cs;
                }
                if (this.overlap * (i + 1) % this.cs === 0) {
                    mask = this.bpc2 * (1 - this.mcs2);
                    decM = dec & mask;
                    modMessage.push(decM >> this.bpc - this.cs);
                } else if (this.overlap * (i + 1) % this.cs
                           + (this.cs - curOverlapping) <= this.cs) {
                    decM = dec & mask;
                    modMessage.push(decM >> (this.cpc - 1)
                                    * this.cs + (this.cs - curOverlapping));
                }
            }
        } else if (i < message.length) {
            // No overlap bits to deal with, push the integral
            // number of chunks
            mask = this.cs2 - 1;
            for (j = 0; j < this.cpc; j++) {
                decM = dec & mask;
                modMessage.push(decM >> j * this.cs);
                mask <<= this.cs;
            }
        }
        oldDec = dec;
    }

    // Encode data length
    //console.debug("Data message length " + modMessage.length);
    var len = modMessage.length;
    var mask = this.cs2 - 1;
    var chunks = (32 / this.cs + 0.5) >> 0;
    //console.debug("Packing " + len + " into " + chunks + " chunks");
    for (i = 0; i < chunks; i++) {
        var pixel = (len >> i * this.cs) & mask;
        modMessage.unshift(pixel);
    }
    //console.debug("Final message length " + modMessage.length
    //              + " in " + (data.length / 4) + " pixels");

    // Bung the chunks in successive pixels
    var offset;
    for (offset = 0; offset < modMessage.length; offset++) {
        // This is the clever bit, that I don't understand.
        data[offset * 4 + channel] = 255 - this.prime + 1
            + modMessage[offset] % this.prime;
    }

    imageData.data = data;
    shadowCtx.putImageData(imageData, 0, 0);

    return shadowCanvas.toDataURL();
};

Steganography.prototype.extract = function(image) {
    "use strict";

    if (image.length) {
        var dataURL = image;
        image = new Image();
        image.src = dataURL;
    }

    var shadowCanvas = document.createElement("canvas");
    shadowCanvas.style.display = "none";
    shadowCanvas.width = image.width;
    shadowCanvas.height = image.height;

    var shadowCtx = shadowCanvas.getContext("2d");
    shadowCtx.drawImage(image, 0, 0);

    var imageData = shadowCtx.getImageData(0, 0, image.width, image.height);
    var data = imageData.data;

    var chunks = (32 / this.cs + 0.5) >> 0;
    var len = 0;
    var i = 0;
    for (i = 0; i < chunks; i++) {
        var pixel = data[i * 4 + channel] - this.xp;
        len = (len << this.cs) + pixel;
    }
    //console.debug("Unpacked " + len);

    var modMessage = [];
    while (i < chunks + len) {
        modMessage.push(data[i * 4 + channel] - this.xp);
        i++;
    }

    var message = "", charCode = 0, bitCount = 0;
    var mask = (1 << this.bpc) - 1;
    for (i = 0; i < modMessage.length; i++) {
        charCode += modMessage[i] << bitCount;
        bitCount += this.cs;
        if (bitCount >= this.bpc) {
            message += String.fromCharCode(charCode & mask);
            bitCount %= this.bpc;
            charCode = modMessage[i] >> this.cs - bitCount;
        }
    }
    if (charCode !== 0) {
        debugger;
        message += String.fromCharCode(charCode & mask);
    }

    return message;
};

Steganography.prototype.getCapacity = function(image) {
    "use strict";
    var pixels = image.width * image.height;
    return (this.cs * pixels / this.bpc - (32 / this.cs + 0.5)) >> 0;
};
