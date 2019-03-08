define(["dialogs/Dialog", "js/Translator"], function(Dialog, Translator) {
    class ExtrasDialog extends Dialog {
        initialise() {
            let self = this;
            
            this.control("theme")
                .on("selectmenuchange", function () {
                    $(document).trigger("set_theme", $(this).val());
                })
                .selectmenu();

            this.control("autosave")
                .on("change", function () {
                    $(document).trigger("set_autosave", $(this).prop("checked"));
                });

            this.control("hidevalues")
                .on("change", function () {
                    $(document).trigger("set_hiding", $(this).prop("checked"));
                });

            this.control("chpw")
                .on(this.tapEvent(), function () {
                    self.close();
                    $.load_dialog("chpw").then(($dlg) => {
                        $dlg.squirrel_dialog("open");
                    });
                });

            this.control("chss")
                .on(this.tapEvent(), function () {
                    self.close();
                    $.load_dialog("store_settings").then(($dlg) => {
                        $dlg.squirrel_dialog("open");
                    });
                });

            this.control("theme")
                .on(this.tapEvent(), function () {
                    self.close();
                    $.load_dialog("theme").then(($dlg) => {
                        $dlg.squirrel_dialog("open");
                    });
                });

            this.control("json")
                .on(this.tapEvent(), function () {
                    self.close();
                    $.load_dialog("json").then(($dlg) => {
                        $dlg.squirrel_dialog("open");
                    });
                });

            this.control("optimise")
                .on(this.tapEvent(), function () {
                    self.close();
                    $.load_dialog("optimise").then(($dlg) => {
                        $dlg.squirrel_dialog("open");
                    });
                });

            this.control("bigger")
                .on(this.tapEvent(), function () {
                    $(document).trigger("set_zoom", 1.25);
                });

            this.control("smaller")
                .on(this.tapEvent(), function () {
                    $(document).trigger("set_zoom", 0.8);
                });

            this.control("about")
                .on(this.tapEvent(), function () {
                    self.close();
                    $.load_dialog("about").then(($dlg) => {
                        $dlg.squirrel_dialog("open");
                    });
                });

            this.control("language")
                .on("change", function () {
                    let TX = Translator.instance();
                    let fresh = self.control("language").val();
                    TX.language(fresh);
                });
        }

        open() {
            this.control("theme")
                .find("option:selected")
                .prop("selected", false);

            let app = this.app();
            if (app) {
                if (!(app.USE_STEGANOGRAPHY ||
                      app.cloud.store &&
                      app.cloud.store.option("needs_path"))) {
                    this.control("chss").hide();
                }
                this.control("theme")
                    .find("option[value='" + app.theme() + "']")
                    .prop("selected", true);

                this.control("autosave")
                    .prop("checked", app.autosave());

                this.control("hidevalues")
                    .prop("checked", app.hidingValues);
            }
            
            Translator.instance().language().then((lingo) => {
                this.control("language").val(lingo);
            });
        }
    }
    return ExtrasDialog;
});
