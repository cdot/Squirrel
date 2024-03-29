/*@preserve Copyright (C) 2015-2023 Crawford Currie http://c-dot.co.uk license MIT*/
/* eslint-env browser */

import { Dialog } from "./Dialog.js";

import "../jq/template.js";

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
  .template("expand", { error: e });
  });
  }
  */
  
  _check_paths() {
    let ok = true;
    
    let $ctl = this.$control("cloud_path");
    if ($ctl.val() === "") {
      $ctl.prop(
        "title", $.i18n("cloud_path_empty"));
      ok = false;
    } else
      $ctl.prop("title", $.i18n("path_to_cloud"));

    if (this.options.needs_image) {
      $ctl = this.$control("image_url");
      if ($ctl.val() === "") {
        $ctl.prop(
          "title",
          $.i18n("empty_image"));
        ok = false;
      } else {
        $ctl.prop(
          "title", $.i18n("steg_url"));
        this.$control("steg_image").attr("src", $ctl.val());
      }
    }
    
    this.$control("ok").toggle(ok);
    
    return ok;
  }

  initialise() {
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

  onOpened() {
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

  onOK() {
    return {
      cloud_path: this.$control("cloud_path").val(),
      image_url: this.$control("image_url").val()
    };
  }
}

export { StoreSettingsDialog }
