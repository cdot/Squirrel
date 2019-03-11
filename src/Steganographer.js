/*@preserve Copyright (C) 2015-2019 Crawford Currie http://c-dot.co.uk license MIT*/

define(function() {
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
     * channel, such that the data just looks like noise.
     */

    class Steganographer {
        /**
         * Constructor
         * @param params may contain the following fields
         * maxChunk: override the default maximum number of bits per
         * colour channel to use. The default is 3, which is a reasonable
         * compromise between information capacity and image degradation.
         * The theoretical maximum chunk size, using all the bits of the
         * colour channels, would be 8 bits, but that would replace the
         * image.
         * debug: function, same signature as console.debug
         */    
        constructor(params) {
            // Messages are stored in chunks held in the least significant
            // bits of the three colour channels.
            this.maxChunk = params.maxChunk || 3;
            this.debug = params.debug;
        }

        /**
         * @private
         * Get raw image data from an image.
         * @param image An Image, HTMLImageElement, Uint8*Array or String
         * data-uri, or any of the types accepted by Context.drawImage.
         * @return a Uint8Array containing the image data
         */
        getImageData(image) {
            if (image instanceof Uint8Array ||
                image instanceof Uint8ClampedArray)
                return image;
            
            if (image instanceof Int8Array ||
                image instanceof Int16Array ||
                image instanceof Uint16Array ||
                image instanceof Int32Array ||
                image instanceof Uint32Array ||
                image instanceof Float32Array ||
                image instanceof Float64Array ||
                image instanceof BigInt64Array ||
                image instanceof BigUint64Array)
                return new Uint8Array(image.buffer);
 
            if (image instanceof ImageData)
                return image.data;

            if (typeof image === "string") {
                let im = new Image();
                im.src = image;
                image = im;
            }

            // Really want to use an OffscreenCanvas, but it's still
            // experimental
            let shadowCanvas = document.createElement("canvas");
            shadowCanvas.style.display = "none";
            shadowCanvas.width = image.naturalWidth;
            shadowCanvas.height = image.naturalHeight;

            let shadowCtx = shadowCanvas.getContext("2d");
            shadowCtx.drawImage(image, 0, 0);

            let id = shadowCtx.getImageData(
                0, 0, shadowCanvas.width, shadowCanvas.height);

            return id.data;
        }

        /**
         * Convert an image represented by an array of bytes into
         * an array of bytes encoded in a given image format.
         * @param bytes the raw image data
         * @param width
         * @param height
         * @param type the default format type is image/png.
         * @return a Uint8Array of encoded image data
         */
        bytesToImageFormat(bytes, width, height, type) {
            let canvas = document.createElement("canvas");
            canvas.style.display = "none";
            canvas.width = width;
            canvas.height = height;
            let cxt = canvas.getContext("2d");
            let id = cxt.getImageData(0, 0, width, height).data;
            for (let i = 0; i < bytes.length; i++)
                id[i] = bytes[i];
            let b64 = canvas.toDataURL(type, 1).split(",", 2)[1];
            return Utils.Base64ToUint8Array(b64);
        }
        
        /**
         * @private
         * Adjust chunkSize until the data fits as well as
         * possible into the image (minimum number of bits-per-channel used)
         * @param size size of data to fit, in bytes
         * @param available number of bytes available for storage
         */
        _adjustToFit(size, available) {
            let bits = size * 8; // Number of bits to be stored
            
            // number of chunks (32 bits) and chunk size (4 bits) are stored
            // 2 bits per channel, so that means 18 channels, 3 channels
            // per pixel so need 6 pixels for this info.
            let slots = 3 * available - 6;

            let chunkSize = (bits / slots + 1) >> 0;
            if (this.debug) this.debug(
                "Storage required " + bits + " bits, " + size + " bytes"
                    + " Max image capacity "
                    + this.maxChunk * slots + " bits, "
                    + this.maxChunk * slots / 8 + " bytes");

            if (chunkSize > this.maxChunk) {
                if (this.debug) this.debug(
                    "Computed chunk size " + chunkSize
                        + " is > " + this.maxChunk
                        + ", oversized by " + (-slots * (this.maxChunk - chunkSize))
                        + " bits");
                throw new Error((slots * (chunkSize - this.maxChunk))
                                + " bits too many to hide in this image");
            }

            if (this.debug) this.debug(
                "Computed chunk size " + chunkSize
                    + " (" + slots + " slots)");

            return chunkSize;
        }

        /**
         * Insert some content into the given image
         * @param a8 the content, in a Uint8Array. Size must be <= (2^32-1)
         * @param image An Image. Uses getImageData to get the image data
         * from a range of different types.
         * @return {ImageData} an ImageData object containing the resulting
         * image
         * @throws Error if the image doesn't have enough capacity for
         * all the data given the current parameters.
         */
        insert(a8, image) {
          
            if (this.debug) this.debug(
                "Embedding " + a8.length + " bytes ("
                    + (a8.length * 8) + " bits)");

            let iData = this.getImageData(image);

            // Irrespective of the source of the image, by the time we
            // get here the imageData.data consists of width*height
            // pixels, where each pixel is 4 bytes (RGBA)

            // We have to init the alpha channel of the image to fully
            // opaque, otherwise color values can't be manipulated. If
            // we manipulate colour, we can't modify transparency, and
            // if we manipulate transparency, we lose control over
            // colour. Better on balance to use the colour channels to
            // store our secrets.

            // Set alpha channel to opaque
            for (let i = 3; i < iData.length; i += 4)
                iData[i] = 0xFF;

            // We reserve the first 24 bytes (6 pixels) for the data
            // length (32 bits) and chunk size (4 bits) packed 2 bits per
            // colour channel.
            let byte_i = 24;

            let a8_len = a8.length;
            let chunkSize = this._adjustToFit(a8_len, iData.length);
            let chunkMask = (1 << chunkSize) - 1;
            let iChunkMask = ~chunkMask;
            let numChunks = 0;

            // Function to add a chunk into the image. c <= chunkMask
            function addChunk(c) {
                iData[byte_i] = (iData[byte_i] & iChunkMask) | c;
                byte_i++;
                if (byte_i % 4 === 3)
                    byte_i++; // skip alpha channel
                numChunks++;
            };
            
            // 00000001 00000010 00000011 00000100 00000101
            // 001 000 000 001 000 110 000 000 100 000 100
            //   1   0   0   1   0   6   0   0   4   0   4
            let a8_i;   // the i'th byte, shifted as we remove chunks
            let a8_iM1; // what remains of the i-1'th byte
            let bits;   // Number of bits remaining to process in the i'th byte
            let pending = 0; // number of bits still pending from the i-1'th byte
            for (let i = 0; i < a8_len; i++) {
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
            // colour channel (6 bits per pixel, 32 bit length + 4 bit
            // chunksize = 36bits, so 6 pixels at 4 bytes per pixel
            // (24 bytes) is just perfect.
            byte_i = 0;
            let shift = 30;
            while (shift >= 0) {
                for (let channel = 0; channel < 3 && shift >= 0; channel++) {
                    let was = iData[byte_i];
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

            if (this.debug) this.debug(
                "Embedded " + numChunks + " chunks of "
                    + chunkSize + " bits, " + (numChunks * chunkSize) + " bits / "
                    + (numChunks * chunkSize / 8) + " bytes of data");

            return iData;
        }

        /**
         * Extract the content hidden in the given image
         * @param image An Image. Uses getImageData to get the image data
         * from a range of different types.
         * @return a Uint8Array containing the content
         * @throws Error if the image doesn't seem to have anything embedded
         */
        extract(image) {
            let iData = this.getImageData(image);

            // Extract data length and chunkSize
            // chunkSize = 4, prime = 17
            let numChunks = 0;
            let byte_i = 0;
            for (let i = 0; i < 32; i += 2) {
                numChunks = (numChunks << 2) | (iData[byte_i] & 0x3);
                byte_i++;
                if (byte_i % 4 === 3)
                    byte_i++; // skip alpha channel
            }

            let chunkSize = (iData[byte_i++] & 0x3) << 2;
            chunkSize |= iData[byte_i] & 0x3;
            byte_i += 2; // blue and alpha

            if (numChunks < 0 || numChunks > iData.length
                || chunkSize <= 0 || chunkSize > 8)
                throw new Error("No message embedded");

            let message = new Uint8Array((numChunks * chunkSize) >> 3);
            if (this.debug) this.debug(
                "Extracting " + numChunks + " chunks of "
                    + chunkSize + " bits, "
                    + (numChunks * chunkSize) + " bits / "
                    + (numChunks * chunkSize / 8) + " bytes of data");

            let charCode = 0;
            let bitCount = 0;
            let mi = 0;
            let chunkMask = (1 << chunkSize) - 1;

            for (let i = 0; i < numChunks; i++) {
                let mmi = iData[byte_i++] & chunkMask;
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
                message[mi++] = charCode & 0xFF;
            }
            if (this.debug) this.debug(
                "Extracted " + message.length + " bytes");

            return message;
        }
    }

    return Steganographer;
});
