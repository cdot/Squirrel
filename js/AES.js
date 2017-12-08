/*@preserve Copyright (C) 2015 Crawford Currie http://c-dot.co.uk license MIT*/

/* eslint-env browser */

/* global Aes */
/* global Uint8Array */

/**
 * AES Counter-mode implementation in JavaScript
 * Based on Chris Veness' work (C) 2005-2014 Chris Veness / MIT Licence
 *
 * See http://csrc.nist.gov/publications/nistpubs/800-38a/sp800-38a.pdf
 *
 * @augments Aes
 */
var AES = {};

/**
 * Encrypt an ArrayBuffer using AES in Counter mode.
 *
 * @param   {ArrayBuffer} ab Source to be encrypted.
 * @param   {String} password The password to use to generate a key.
 * @param   {number} nBits Number of bits to be used in the key;
 * 128 / 192 / 256.
 * @returns {Uint8Array} Encrypted data
 */
AES.encrypt = function (ab, password, nBits) {
    "use strict";

    // block size fixed at 16 bytes / 128 bits (Nb=4) for AES
    var blockSize = 16;

    var plaintext = new Uint8Array(ab);

    // use AES itself to encrypt password to get cipher key (using
    // plain password as source for key expansion) - gives us well
    // encrypted key (though hashed key might be preferred for prod'n use)
    var nBytes = nBits / 8; // no bytes in key (16/24/32)
    var pwBytes = new Array(nBytes);

    // use 1st 16/24/32 chars of password for key, zero padded
    for (var i = 0; i < nBytes; i++) {
        if (i < password.length)
            pwBytes[i] = password.charCodeAt(i) & 255;
        else
            pwBytes[i] = 0;
    }

    // get 16-byte key
    var key = Aes.cipher(pwBytes, Aes.keyExpansion(pwBytes));

    // expand key to 16/24/32 bytes long
    key = key.concat(key.slice(0, nBytes - 16));

    // initialise 1st 8 bytes of counter block with nonce
    // (NIST SP800-38A §B.2): [0-1] = millisec,
    // [2-3] = random, [4-7] = seconds, together giving full sub-millisec
    // uniqueness up to Feb 2106
    var counterBlock = new Uint8Array(8);
    var size = 8;

    // timestamp: milliseconds since 1-Jan-1970
    var nonce = Date.now();
    var nonceMs = nonce % 1000;
    var nonceSec = (nonce / 1000) >> 0;
    var nonceRnd = (Math.random() * 0xffff) >> 0;
    // for debugging: nonce = nonceMs = nonceSec = nonceRnd = 0;

    for (i = 0; i < 2; i++)
        counterBlock[i] = (nonceMs >>> i * 8) & 0xff;
    for (i = 0; i < 2; i++)
        counterBlock[i + 2] = (nonceRnd >>> i * 8) & 0xff;
    for (i = 0; i < 4; i++)
        counterBlock[i + 4] = (nonceSec >>> i * 8) & 0xff;

    // generate key schedule - an expansion of the key into distinct
    // Key Rounds for each round
    var keySchedule = Aes.keyExpansion(key);

    var blockCount = Math.ceil(plaintext.length / blockSize);

    // Ciphertext as an array of Uint8Array
    var ciphertxt = new Array(blockCount);

    for (var b = 0; b < blockCount; b++) {
        // set counter (block #) in last 8 bytes of counter block
        // (leaving nonce in 1st 8 bytes). Done in two stages for
        // 32-bit ops: using two words allows us to go past 2^32 blocks (68GB)
        for (var c = 0; c < 4; c++)
            counterBlock[15 - c] = (b >>> c * 8) & 0xff;
        for (c = 0; c < 4; c++)
            counterBlock[15 - c - 4] = (b / 0x100000000 >>> c * 8);

        // encrypt counter block
        var cipherCntr = Aes.cipher(counterBlock, keySchedule);

        // block size is reduced on final block
        var blockLength = b < blockCount - 1 ?
            blockSize : (plaintext.length - 1) % blockSize + 1;
        var cipherChar = new Uint8Array(blockLength);
        size += blockLength;

        // xor plaintext with ciphered counter char-by-char
        for (i = 0; i < blockLength; i++) {
            if (cipherCntr[i] > 255) debugger;
            cipherChar[i] = cipherCntr[i] ^ plaintext[b * blockSize + i];
        }
        ciphertxt[b] = cipherChar;
    }

    var ct = new Uint8Array(size);
    ct.set(counterBlock);
    var offset = counterBlock.length;
    for (b = 0; b < blockCount; b++) {
        ct.set(ciphertxt[b], offset);
        offset += ciphertxt[b].length;
    }
    return ct;
};


/**
 * Decrypt an ArrayBuffer using AES in counter mode
 *
 * @param   {ArrayBuffer} ab Source to be dencrypted.
 * @param   {String} password The password to use to generate a key.
 * @param   {number} nBits Number of bits to be used in the key;
 * 128 / 192 / 256.
 * @returns {ArrayBuffer} Encrypted data
 * @returns {ArrayBuffer} Decrypted data
 */
AES.decrypt = function (ab, password, nBits) {
    "use strict";

    var blockSize = 16;

    var ciphertext = new Uint8Array(ab);

    // use AES to encrypt password (mirroring encrypt routine)
    var nBytes = nBits / 8; // no bytes in key
    var pwBytes = new Uint8Array(nBytes);
    for (var i = 0; i < nBytes; i++) {
        if (i < password.length)
            pwBytes[i] = password.charCodeAt(i) & 255;
        else
            pwBytes[i] = 0;
    }

    var key = Aes.cipher(pwBytes, Aes.keyExpansion(pwBytes));
    key = key.concat(key.slice(0, nBytes - 16));

    // recover nonce from 1st 8 bytes of ciphertext
    var counterBlock = new Uint8Array(8);
    for (i = 0; i < 8; i++)
        counterBlock[i] = ciphertext[i];

    // generate key schedule
    var keySchedule = Aes.keyExpansion(key);

    // separate ciphertext into blocks (skipping past initial 8 bytes)
    var nBlocks = Math.ceil((ciphertext.length - 8) / blockSize);
    var ct = new Array(nBlocks);
    var offset = 8;
    for (var b = 0; b < nBlocks; b++) {
        ct[b] = ciphertext.subarray(offset, offset + blockSize);
        offset += blockSize;
    }
    // ct is now array of block-length Uint8Array

    // plaintext will get generated block-by-block into array of
    // block-length Uint8Arrays
    var plaintxt = new Array(nBlocks);
    var size = 0;

    for (b = 0; b < nBlocks; b++) {
        // set counter (block #) in last 8 bytes of counter block
        // (leaving nonce in 1st 8 bytes)
        for (var c = 0; c < 4; c++)
            counterBlock[15 - c] = ((b) >>> c * 8) & 0xff;
        for (c = 0; c < 4; c++) {
            counterBlock[15 - c - 4] =
                (((b + 1) / 0x100000000 - 1) >>> c * 8) & 0xff;
        }

        // encrypt counter block
        var cipherCntr = Aes.cipher(counterBlock, keySchedule);

        var blen = ct[b].length;
        var plaintxtByte = new Uint8Array(blen);
        for (i = 0; i < blen; i++) {
            // xor plaintxt with ciphered counter byte-by-byte
            plaintxtByte[i] = cipherCntr[i] ^ ct[b][i];
        }
        plaintxt[b] = plaintxtByte;
        size += blen;
    }

    var pt = new Uint8Array(size);
    offset = 0;
    for (b = 0; b < nBlocks; b++) {
        pt.set(plaintxt[b], offset);
        offset += plaintxt[b].length;
    }

    return pt;
};