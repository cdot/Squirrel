/*@preserve Copyright (C) 2015-2019 Crawford Currie http://c-dot.co.uk license MIT*/
/* global FileReader */

define(["js/Dialog", "js/Utils", "js/jq/template"], function(Dialog, Utils) {

    /**
     * Promise to read a file object. The promise is resolved with
     * the file contents.
     * @param file File object to read
     * @param mode optional read mode, one of "arraybuffer", "binarystring",
     * "datauri" or "text". The default is "text".
     */
    function readFile(file) {
        return new Promise((resolve, reject) => {
            let reader = new FileReader();
            reader.onload = function ( /*evt*/ ) {
                // SMELL: use readAsDataURL?
                let data = new Uint8Array(reader.result);
                resolve("data:" + file.type + ";base64," +
                        Utils.Uint8ArrayToBase64(data));
            };
            reader.onerror = function () {
                reject(file.name + " read failed");
            };
            reader.onabort = reader.onerror;
            reader.readAsArrayBuffer(file);
        });
    }

    class StoreSettingsDialog extends Dialog {

        newImage(img) {
            let self = this;

            // Check that we can use the image.
            requirejs(["js/Steganographer"], function(Steganographer) {
                let steg = new Steganographer({debug: self.debug});
                steg.insert("tada", img);
                self.control("ok").icon_button("enable");
                let h = img.naturalHeight;
                let w = img.naturalWidth;
                img.height = 100;
                self.control("image_message")
                .show()
                .template("pick", "xbyy")
                .template("expand", w, h);
            });
        }

        changeImage() {
            let self = this;

            let file = this.control("image_file")[0].files[0];
            readFile(file)
            .then((data) => {
                if (data === this.control("steg_image").attr("src", data))
                    return;
                let $img = this.control("steg_image");
                $img.attr("src", data)
                .off("load")
                .on("load", () => {
                    self.newImage($img[0]);
                });
            })
            .catch((e) => {
                this.control("image_message")
                .show()
                .template("pick", "cui")
                .template("expand", e);
            });
        }

        initialise() {
            let self = this;

            this.find(".template").template();

            this.control("image_file").on("change", function () {
                self.changeImage();
            });

            this.control("steg_image").attr(
                "src", requirejs.toUrl("images/GCHQ.png"));

            this.control("path")
            .on("keyup", function () {
                if (self.control("path").val() === "") {
                    self.control("mnbe").show();
                    return false;
                }
                return true;
            })
            .on("change", function () {
                self.control("ok").trigger(Dialog.tapEvent());
            });
        }

        ok() {
            if (this.control("path").val() === "") {
                this.control("mnbe").show();
                return Promise.resolve(false);
            }
            return Promise.resolve(true);
        }

        open() {
            this.control("image_message").hide();
            this.control("get_image").toggle(this.options.needs_image);
            this.control("path").focus().val(this.options.path);
            this.control("mnbe").toggle(!this.options.path || this.options.path === "");
        }
    }
    return StoreSettingsDialog;
});
