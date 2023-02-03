/*@preserve Copyright (C) 2015-2019 Crawford Currie http://c-dot.co.uk license MIT*/
/* eslint-env browser */

import { Utils } from "./Utils.js";

/**
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
   * @param {object} params parameters
   * @param {number} params.max_bits override the default maximum
   * number of bits per colour channel to use. The default is 3, which
   * is a reasonable compromise between information capacity and image
   * degradation. The theoretical maximum chunk size, using all the
   * bits of the colour channels, would be 8 bits, but that would
   * destroy the image.
   * @param {function} params.debug debug function, same
   * signature as console.debug
   */
  constructor(params) {
		if (!params) params = {};
    this.maxChunk = params.max_bits || 3;
    this.debug = params.debug;
  }

  /**
   * Compute the number of bits per colour channel so the data fits as
   * well as possible into the image (minimum number of bits per
   * channel used)
   * @param size size of data to fit, in bytes
   * @param available number of bytes available for storage
   * @private
   */
  _computeChunkSize(size, available) {
    const bits = size * 8; // Number of bits to be stored
    const pixels = available / 4;

    // number of chunks (32 bits) and chunk size (4 bits) are stored
    // 2 bits per channel, so that means 18 channels are needed. There
    // are 3 channels per pixel so need 6 pixels for this info. That
    // leaves this many possible chunk slots:
    const slots = (pixels - 6) * 3;

    const chunkSize = (bits / slots + 1) >> 0;
    if (this.debug) this.debug(
      `Storage required ${bits} bits (${size} bytes)\n`
      + `\tImage size ${available} bytes\n`
      + `\tMax image capacity ${this.maxChunk * slots} bits`
      + ` (${(this.maxChunk * slots / 8) >> 0} bytes) `
      + `in ${slots} X ${chunkSize} bit slots`);

    if (chunkSize > this.maxChunk) {
      if (this.debug) this.debug(
        `Computed chunk size ${chunkSize} is > ${this.maxChunk}`
        + `, oversized by ${-slots * (this.maxChunk - chunkSize)} bits`);
      throw new Error(`${slots * (chunkSize - this.maxChunk)} bits is too much data to embed in this image`);
    }

    if (this.debug) this.debug(
      `Computed chunk size ${chunkSize}`);

    return chunkSize;
  }

  /**
   * Promise to insert a message into the given image, in place.
   * @param message the message, in a Uint8Array. Size must be <= (2^32-1)
   * @param {Uint8Array} data the image data, 4 bytes per pixel, one byte
   * per colour channel plus one for the alpha (RGBA)
   * @throws Error if the image doesn't have enough capacity for
   * all the data given the current parameters.
   */
  insert(message, bytes) {

    const mess_len = message.length;

    if (this.debug) this.debug(
      `Embedding ${mess_len} bytes (${mess_len * 8} bits)`);

    // Index of the byte currently being written to.
    // We reserve the first 24 bytes (6 pixels) for the data
    // length (32 bits) and chunk size (4 bits) packed 2 bits per
    // colour channel.
    let byte_i = 24;

    // Number of bits in each channel being used for embedded data
    const chunkSize = this._computeChunkSize(mess_len, bytes.length);
    // Mask for the chunk bits
    const chunkMask = (1 << chunkSize) - 1;
    // Inverse of chunk mask
    const iChunkMask = ~chunkMask;
    // Total number of chunks used so far
    let chunkCount = 0;

    // We have to init the alpha channel of the image to fully
    // opaque, otherwise color values can't be manipulated. If
    // we manipulate colour, we can't modify transparency, and
    // if we manipulate transparency, we lose control over
    // colour.
    for (let i = 3; i < bytes.length; i += 4)
      bytes[i] = 0xFF;

    // Function to add a chunk into the image. c <= chunkMask
    function addChunk(c) {
      bytes[byte_i] = (bytes[byte_i] & iChunkMask) | c;
      byte_i++;
      if (byte_i % 4 === 3)
        byte_i++; // skip alpha channel
      chunkCount++;
    }

    // What remains of the i-1'th byte after pulling as many whole
    // chunks out of it as we can. For example if the chunk size if 3,
    // we can pull 2 chunks from a bytes and then be left with 2
    // bits. These then form the first 2 bits of the next chunk.
    let pendBits = 0;
    let pendData;

    for (let i = 0; i < mess_len; i++) {
      // What remains of the i'th message byte
      let messData = message[i];
      let messBits = 8;

      if (pendBits > 0) {
        // Remaining (high) bits of previous byte combined with
        // low order bits of current byte
        addChunk((pendData & (chunkMask >> (chunkSize - pendBits)))
                 | ((messData & (chunkMask >> pendBits)) << pendBits));
        messData >>= (chunkSize - pendBits);
        messBits -= (chunkSize - pendBits);
      }

      // Get as many whole chunks from the message byte as we can
      while (messBits >= chunkSize) {
        addChunk(messData & chunkMask);
        messData >>= chunkSize;
        messBits -= chunkSize;
      }

      // Remember what's left so we can pack it into the next
      // chunk.
      pendBits = messBits;
      pendData = messData;
    }

    if (pendBits > 0) {
      // Push the final partial chunk
      addChunk(pendData);
    }

    // Embed chunk count and chunk size using 2 bits from each colour
    // channel (6 bits per pixel, 32 bit chunk count + 4 bit chunk
    // size = 36bits, so 6 pixels at 4 bytes per pixel (24 bytes).
    byte_i = 0;
    let shift = 30;
    while (shift >= 0) {
      for (let channel = 0; channel < 3 && shift >= 0; channel++) {
        bytes[byte_i] = (bytes[byte_i] & 0xFC)
        | ((chunkCount >> shift) & 0x3);
        shift -= 2;
        byte_i++;
        if (byte_i % 4 === 3)
          byte_i++; // skip alpha channel
      }
    }
    // That leaves just two channels for 2 bits of the chunkSize each
    bytes[byte_i] = (bytes[byte_i] & 0xFC) | ((chunkSize >> 2) & 0x3);
    byte_i++;
    bytes[byte_i] = (bytes[byte_i] & 0xFC) | (chunkSize & 0x3);
    byte_i += 2; // blue + alpha

    if (this.debug) this.debug(
      `Embedded ${chunkCount} chunks of `
      + `${chunkSize} bits, ${chunkCount * chunkSize} bits / `
      + `${chunkCount * chunkSize / 8} bytes of data`);
  }

  /**
   * Extract the content hidden in the given image.
   * @param {Uint8Array} data the image data containing the secret, 4
   * bytes per pixel, one byte per colour channel plus one for the
   *  alpha (RGBA)
   * @return {Uint8Array} the extracted content
   * @throws Error if the image doesn't seem to have anything embedded
   */
  extract(bytes) {
    // Extract chunk count and chunk size from the first 24 bytes
    let chunkCount = 0;
    let byte_i = 0;
    for (let i = 0; i < 32; i += 2) {
      chunkCount = (chunkCount << 2) | (bytes[byte_i] & 0x3);
      byte_i++;
      if (byte_i % 4 === 3)
        byte_i++; // skip alpha channel
    }

    let chunkSize = (bytes[byte_i++] & 0x3) << 2;
    chunkSize |= bytes[byte_i] & 0x3;
    byte_i += 2; // blue and alpha

    if (chunkCount < 0 || chunkCount > bytes.length
        || chunkSize <= 0 || chunkSize > 8)
      throw new Error(
        `No message embedded ${chunkCount} (${bytes.length}) ${chunkSize}`);

    const message = new Uint8Array((chunkCount * chunkSize) >> 3);
    if (this.debug) this.debug(
      `Extracting ${chunkCount} chunks of `
      + `${chunkSize} bits, ${chunkCount * chunkSize} bits / `
      + `${chunkCount * chunkSize / 8} bytes of data`);

    let charCode = 0;
    let bitCount = 0;
    let mi = 0;
    const chunkMask = (1 << chunkSize) - 1;
    for (let i = 0; i < chunkCount; i++) {
      const mmi = bytes[byte_i++] & chunkMask;
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
    if (mi < ((chunkCount * chunkSize) >> 3)) {
      message[mi++] = charCode & 0xFF;
    }
    if (this.debug) this.debug(
      `Extracted ${message.length} bytes`);

    return message;
  }
}

export { Steganographer }
