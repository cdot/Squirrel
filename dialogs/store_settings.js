define(["dialogs/Dialog", "js/Utils", "jsjq/template"], function(Dialog, Utils) {

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
                let steg = new Steganographer({image: img});
                steg.insert("tada");
                self.control("ok").icon_button("enable");
                let h = img.naturalHeight;
                let w = img.naturalWidth;
                img.height = 100;
                self.control("message")
                    .show()
                    .template("pick", "xbyy")
                    .template("expand", w, h);
                let squirrel = self.app();
                if (squirrel) {
                    if (squirrel.client.status === squirrel.IS_LOADED)
                        squirrel.client.status = squirrel.NEW_SETTINGS;
                    if (squirrel.cloud.status === squirrel.IS_LOADED)
                        squirrel.cloud
                        .status = squirrel.NEW_SETTINGS;
                    squirrel.trigger("update_save");
                }
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
                    let app = self.app();
                    if (app && app.client.hoard.options.store_path !==
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
                        // if (this.app().cloud.status === this.app().IS_LOADED)
                        //     this.app().cloud.status = this.app().NEW_SETTINGS;
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
        
        open(options) {
            if (options.get_image || this.debug)
                this.find(".using_steganography").show();
            else
                this.find(".using_steganography").hide();
            this.control("message").hide();
            if ((options.get_path || this.debug) && this.app())
                this.control("storepath")
                .focus()
                .val(
                    this.app().client
                        .hoard.options.store_path);
        }
    }
    return StoreSettingsDialog;
});
