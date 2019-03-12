/*@preserve Copyright (C) 2015-2019 Crawford Currie http://c-dot.co.uk license MIT*/
/**
 * Options:
 * app (required)
 */

define(["js/Dialog", "js/Utils", "jsjq/template"], function(Dialog, Utils) {

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
            let app = self.options.app;
 
            // Check that we can use the image.
            requirejs(["js/Steganographer"], function(Steganographer) {
                let steg = new Steganographer({debug: self.debug});
                steg.insert("tada", img);
                self.control("ok").icon_button("enable");
                let h = img.naturalHeight;
                let w = img.naturalWidth;
                img.height = 100;
                self.control("message")
                    .show()
                    .template("pick", "xbyy")
                    .template("expand", w, h);
                if (app.client.status === app.IS_LOADED)
                    app.client.status = app.NEW_SETTINGS;
                if (app.cloud.status === app.IS_LOADED)
                    app.cloud
                    .status = app.NEW_SETTINGS;
                app.trigger("update_save");
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
                this.control("message")
                    .show()
                    .template("pick", "cui")
                    .template("expand", e);
            });
        }

        initialise() {
            let self = this;
            let app = this.options.app;

            this.find(".template").template();
            
            this.control("image_file").on("change", function () {
                    self.changeImage();
                });

            this.control("steg_image").attr(
                "src", requirejs.toUrl("images/GCHQ.png"));

            this.control("storepath")
                .on("keyup", function () {
                    if (self.control("storepath").val() === "") {
                        this.control("message")
                            .show()
                            .template("pick", "mnbe");
                        return false;
                    }
                    if (app.client.hoard.options.store_path !==
                        self.control("storepath").val()) {
                        app.client
                            .hoard.options.store_path =
                            self.control("storepath")
                            .val();
                        if (app.client
                            .status === app.IS_LOADED)
                            app.client
                            .status = app.NEW_SETTINGS;
                        // No - the cloud isn't affected by the store path,
                        // so don't mark it as changed
                        app.trigger("update_save");
                    }
                    return true;
                })
                .on("change", function () {
                    self.control("ok")
                        .trigger(self.tapEvent());
                });
        }

        ok() {
            if (this.control("storepath").val() === "") {
                this.control("message").show().template("pick", "mnbe");;
                return false;
            }
            return true;
        }
        
        open() {
            let app = this.options.app;
            if (app.cloud.store.option("needs_image"))
                this.find(".using_steganography").show();
            else
                this.find(".using_steganography").hide();
            this.control("message").hide();
            if (app.cloud.store.option("needs_path"))
                this.control("storepath")
                .focus()
                .val(app.client.hoard.options.store_path);
        }
    }
    return StoreSettingsDialog;
});
