(function ($) {
    "use strict";

    var plain = "This is test string";

    var ab = Utils.StringToArrayBuffer(plain);
    var s = '';
    var bs = new Uint8Array(ab);
    for (var i = 0; i < ab.byteLength; i++)
        s += " " + bs[i];
    console.debug("Input is " + s);
    console.debug("Encrypting " + bs.length + " bytes");
    var cipher = AES.encrypt(ab, "Secret", 256);
    s = "";
    for (var i = 0; i < cipher.length; i++)
        s += " " + cipher[i];
    console.debug("Cipher is " + s);

    console.debug("Decrypting");
    var decipher = AES.decrypt(cipher.buffer, "Secret", 256);
    s = "";
    for (var i = 0; i < decipher.length; i++)
        s += " " + decipher[i];
    console.debug("Decrypt is " + s);

    console.debug(
        "AES tests " + (decipher === plain) ? "passed" : "failed");
})(jQuery);
