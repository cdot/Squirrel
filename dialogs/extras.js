/*@preserve Copyright (C) 2019 Crawford Currie http://c-dot.co.uk license MIT*/
/* eslint-env browser */
/* global document */

/**
 * Options:
 * app (required)
 */
define(["js/Dialog", "js/Translator", "js/Tree", "js-cookie", "js/jq/styling"], function(Dialog, Translator, Tree, Cookies) {

    class ExtrasDialog extends Dialog {

        _autosave(on) {
            if (typeof on !== "undefined") {
                let ons = (on ? "on" : "off");
                if (Cookies.get("ui_autosave") !== ons) {
                    Cookies.set("ui_autosave", ons, {
                        expires: 365
                    });
                    $(document).trigger("update_save");
                }
            }
            return Cookies.get("ui_autosave") === "on";
        }

        initialise() {
            let self = this;

            this.control("theme")
            .on("selectmenuchange", function () {
                $.styling.theme($(this).val());
            })
            .selectmenu();

            this.control("autosave")
            .on("change", function () {
                self._autosave($(this).prop("checked"));
            });

            this.control("hidevalues")
            .on("change", function () {
                let checked = $(this).prop("checked");
                Tree.showHideValues(checked);
                Cookies.set("ui_hidevalues", checked ? "on" : null);
            });

            this.control("chpw")
            .on(Dialog.tapEvent(), function () {
                Dialog.confirm("chpw", self.options);
            });

            this.control("chss")
            .on(Dialog.tapEvent(), function () {
                self.options.app.get_store_settings(true);
            });

            this.control("theme")
            .on(Dialog.tapEvent(), function () {
                Dialog.confirm("theme", self.options);
            });

            this.control("json")
            .on(Dialog.tapEvent(), function () {
                Dialog.confirm("json", self.options);
            });

            this.control("optimise")
            .on(Dialog.tapEvent(), function () {
                Dialog.confirm("optimise", self.options);
            });

            this.control("bigger")
            .on(Dialog.tapEvent(), function () {
                $.styling.scale(Math.round(1.25 * $.styling.scale()));
            });

            this.control("smaller")
            .on(Dialog.tapEvent(), function () {
                $.styling.scale(Math.round(0.8 * $.styling.scale()));
            });

            this.control("about")
            .on(Dialog.tapEvent(), function () {
                Dialog.confirm("about", self.options);
            });

            this.control("language")
            .on("change", function () {
                let TX = Translator.instance();
                let fresh = self.control("language").val();
                TX.language(fresh, document);
            });
        }

        open() {
            let app = this.options.app;

            this.control("theme")
            .find("option:selected")
            .prop("selected", false);

            this.control("theme")
            .find("option[value='" + $.styling.theme() + "']")
            .prop("selected", true);

            this.control("autosave").prop("checked", this._autosave());

            this.control("hidevalues")
            .prop("checked",
                  Cookies.get("ui_hidevalues")  === "on");

            Translator.instance().language().then((lingo) => {
                this.control("language").val(lingo);
            });
        }
    }
    return ExtrasDialog;
});
