define(function() {
    /* Helper */
    function changeImage($dlg) {
        let s = $dlg.squirrel_dialog("squirrel");
        let file = $dlg.squirrel_dialog("control", "image_file")[0].files[0];
        Utils.readFile(
            file, "arraybuffer")
            .then((data) => {
                data = "data:" + file.type + ";base64," +
                    Utils.Uint8ArrayToBase64(data);
                if (data !== $dlg.squirrel_dialog("control", "steg_image")
                    .attr("src", data)) {
                    $dlg.squirrel_dialog("control", "steg_image")
                        .attr("src", data)
                        .off("load")
                        .on("load", function () {
                            $(this)
                                .off("load");
                            // Check that we can use the image.
                            let steg = new Steganographer({image:this});
                            steg.inject("tada");
                            $dlg.squirrel_dialog("control", "ok")
                                .icon_button("enable");
                            let h = this.naturalHeight;
                            let w = this.naturalWidth;
                            this.height = 100;
                            $dlg.squirrel_dialog("control", "message")
                                .template("pick", "xbyy")
                                .template("expand", w, h);
                            if (s.client
                                .status === s.IS_LOADED)
                                s.client
                                .status = s.NEW_SETTINGS;
                            if (s.cloud
                                .status === s.IS_LOADED)
                                s.cloud
                                .status = s.NEW_SETTINGS;
                            s.trigger("update_save");
                        });
                }
            }).catch((e) => {
                $dlg.squirrel_dialog("control", "message")
                    .template("pick", "cui")
                    .template("expand", e);
            });
    }

    return function($dlg) {
        $dlg.on('dlg-initialise', function () {
            $dlg.squirrel_dialog("control", "image_file")
                .hide()
                .on($.getTapEvent(), function () {
                    changeImage($dlg);
                });

            $dlg.squirrel_dialog("control", "image")
                .hide()
                .on($.getTapEvent(), function (e) {
                    $dlg.squirrel_dialog("control", "image_file")
                        .trigger("change", e);
                });

            $dlg.squirrel_dialog("control", "storepath")
                .on("keyup", function () {
                    let app = $dlg.squirrel_dialog("squirrel");
                    if ($dlg.squirrel_dialog("control", "storepath")
                        .val() === "") {
                        $dlg.squirrel_dialog("control", "message")
                            .template("pick", "mnbe");
                        return false;
                    }
                    if (app.client
                        .hoard.options.store_path !==
                        $dlg.squirrel_dialog("control", "storepath")
                        .val()) {
                        app.client
                            .hoard.options.store_path =
                            $dlg.squirrel_dialog("control", "storepath")
                            .val();
                        if (app.client
                            .status === app.IS_LOADED)
                            app.client
                            .status = app.NEW_SETTINGS;
                        // No - the cloud isn't affected by the store path,
                        // so don't mark it as changed
                        // if ($dlg.squirrel_dialog("squirrel").cloud.status === $dlg.squirrel_dialog("squirrel").IS_LOADED)
                        //     $dlg.squirrel_dialog("squirrel").cloud.status = $dlg.squirrel_dialog("squirrel").NEW_SETTINGS;
                        app.trigger("update_save");
                    }
                    return true;
                })
                .on("change", function () {
                    $dlg.squirrel_dialog("control", "ok")
                        .trigger($.getTapEvent());
                });

            $dlg.squirrel_dialog("control", "ok")
                .on($.getTapEvent(), function () {
                    if ($dlg.squirrel_dialog("control", "storepath")
                        .val() === "") {
                        $dlg.squirrel_dialog("control", "message")
                            .template("pick", "mnbe");
                        return false;
                    }
                    $dlg.squirrel_dialog("close");
                });
        });

        $dlg.on('dlg-open', function (options) {
            if (options.get_image)
                $dlg.find(".using_steganography").show();
            else
                $dlg.find(".using_steganography").show();
            $dlg.squirrel_dialog("control", "message")
                .hide();
            if (options.get_path)
                $dlg.squirrel_dialog("control", "storepath")
                .focus()
                .val(
                    $dlg.squirrel_dialog("squirrel").client
                        .hoard.options.store_path);
        });
    }
});
