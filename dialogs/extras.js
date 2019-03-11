/*@preserve Copyright (C) 2019 Crawford Currie http://c-dot.co.uk license MIT*/
/**
 * Options:
 * app (required)
 */
define(["js/Dialog", "js/Translator", "js/Tree"], function(Dialog, Translator, Tree) {
    
    class ExtrasDialog extends Dialog {
        
        initialise() {
            let self = this;
            
            this.control("theme")
                .on("selectmenuchange", function () {
                    self.options.app.theme($(this).val());
                })
                .selectmenu();

            this.control("autosave")
                .on("change", function () {
                    self.options.app.autosave($(this).prop("checked"));
                });

            this.control("hidevalues")
                .on("change", function () {
                    Tree.hidingValues = $(this).prop("checked");
                });

            this.control("chpw")
                .on(this.tapEvent(), function () {
                    self.close();
                    Dialog.open("chpw", self.options);
                });

            this.control("chss")
                .on(this.tapEvent(), function () {
                    self.close();
                    Dialog.open("store_settings", self.options);
                });

            this.control("theme")
                .on(this.tapEvent(), function () {
                    self.close();
                    Dialog.open("theme", self.options);
                });

            this.control("json")
                .on(this.tapEvent(), function () {
                    self.close();
                    Dialog.open("json", self.options);
                });

            this.control("optimise")
                .on(this.tapEvent(), function () {
                    self.close();
                    Dialog.open("optimise", self.options);
                });

            this.control("bigger")
                .on(this.tapEvent(), function () {
                    self.options.app.zoom(1.25);
                });

            this.control("smaller")
                .on(this.tapEvent(), function () {
                    self.options.app.zoom(0.8);
                });

            this.control("about")
                .on(this.tapEvent(), function () {
                    self.close();
                    Dialog.open("about", self.options);
                });

            this.control("language")
                .on("change", function () {
                    let TX = Translator.instance();
                    let fresh = self.control("language").val();
                    TX.language(fresh);
                });
        }

        open() {
            let app = this.options.app;
            
            this.control("theme")
                .find("option:selected")
                .prop("selected", false);

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
                .prop("checked", Tree.hidingValues);
            
            Translator.instance().language().then((lingo) => {
                this.control("language").val(lingo);
            });
        }
    }
    return ExtrasDialog;
});
