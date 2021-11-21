/*@preserve Copyright (C) 2015-2019 Crawford Currie http://c-dot.co.uk license MIT*/
/* eslint-env browser */

define("dialogs/store_settings", ["js/Dialog", "js/jq/template"], Dialog => {

	/**
	 * Store settings dialog.
	 * See {@link Dialog} for constructor parameters.
	 * @extends Dialog
	 */
    class StoreSettingsDialog extends Dialog {

        /*
        // Local file support
        newImage(img) {
            const self = this;

            // Check that we can use the image.
            requirejs(["js/Steganographer"], function(Steganographer) {
                const steg = new Steganographer({debug: self.debug});
                steg.insert("tada", img);
                self.$control("ok").icon_button("enable");
                const h = img.naturalHeight;
                const w = img.naturalWidth;
                img.height = 100;
                self.$control("image_message")
                .show()
                .template("pick", "xbyy")
                .template("expand", w, h);
            });
        }

        changeImage() {
            const self = this;

            const file = this.$control("image_file")[0].files[0];
            new Promise((resolve, reject) => {
                const reader = new FileReader();
                reader.onload = function (e) {
                    // SMELL: use readAsDataURL?
                    const data = new Uint8Array(reader.result);
                    resolve("data:" + file.type + ";base64," +
                            Utils.Uint8ArrayToBase64(data));
                };
                reader.onerror = function () {
                    reject(file.name + " read failed");
                };
                reader.onabort = reader.onerror;
                reader.readAsArrayBuffer(file);
            })
            .then(data => {
                if (data === this.$control("steg_image").attr("src", data))
                    return;
                const $img = this.$control("steg_image");
                $img.attr("src", data)
                .off("load")
                .on("load", () => self.newImage($img[0]));
            })
            .catch(e => {
                this.$control("image_message")
                .show()
                .template("pick", "cui")
                .template("expand", e);
            });
        }
        */
        
        _check_paths() {
            let ok = true;
            
            let $ctl = this.$control("cloud_path");
            if ($ctl.val() === "") {
                $ctl.prop(
                    "title", this.tx("Cloud store path may not be empty"));
                ok = false;
            } else
                $ctl.prop("title", this.tx("Path to your cloud store"));

            if (this.options.needs_image) {
                $ctl = this.$control("image_url");
                if ($ctl.val() === "") {
                    $ctl.prop(
                        "title",
                        this.tx("Steganography image URL may not be empty"));
                    ok = false;
                } else {
                    $ctl.prop(
                        "title", this.tx("URL of your steganography image"));
                    this.$control("steg_image").attr("src", $ctl.val());
                }
            }
                
            this.$control("ok").toggle(ok);
            
            return ok;
        }

        initialise() {

            this.$dlg.find(".template").template();

            this.$control("image_url")
            //Local file
            //.on("change", function () {
            //    self.changeImage();
            //})
            .on("input", () => this._check_paths());

            this.$control("cloud_path")
            .on("input", () => this._check_paths())
            .on("change", () => this.$control("ok").focus());
        }

        open() {
            this.$control("image_message").hide();
            if (this.options.needs_image) {
                this.$control("get_image").show();
                this.$control("image_url").val(this.options.image_url());
                this.$control("steg_image").attr(
                    "src", this.options.image_url());
            } else
                this.$control("get_image").hide();

            this.$control("cloud_path").val(this.options.cloud_path()).focus();
            this._check_paths();
        }

        ok() {
            return {
                cloud_path: this.$control("cloud_path").val(),
                image_url: this.$control("image_url").val()
            }
        }
    }
    return StoreSettingsDialog;
});
