/*@preserve Copyright (C) 2019 Crawford Currie http://c-dot.co.uk license MIT*/
/* eslint-env browser */
/* global document */

/**
 * Options:
 * app (required)
 */
define("dialogs/extras", ["js/Dialog", "js/Translator", "js/Tree", "js-cookie", "js/jq/styling"], function(Dialog, Translator, Tree, Cookies) {

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

        _checkSamePass() {
            let p = this.control("pass").val(),
                c = this.control("conf").val();
            let ok = (p !== "" && p === c);
            this.control("nonull").toggle(p === "");
            this.control("nomatch").toggle(p !== c);
            this.control("ok").toggle(ok);
            return ok;
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
                Tree.showValues(checked);
            });

            this.control("lastchange")
            .on("change", function () {
                let checked = $(this).prop("checked");
                Tree.showChanges(checked);
            });

            this.control("chss")
            .on(Dialog.tapEvent(), function () {
                Dialog.confirm("store_settings", self.options)
                .then((path) => {
                    self.options.cloud_path(path);
                })
                .catch((f) => {
                    if (self.debug) self.debug("Store settings aborted");
                });
            });

            this.control("chpw")
            .on(Dialog.tapEvent(), function () {
                Dialog.confirm("change_password", self.options)
                .then((pass) => {
                    self.options.set_encryption_pass(pass);
                })
                .catch((f) => {
                    if (self.debug) self.debug("Store settings aborted");
                });
            });

            this.control("theme")
            .on(Dialog.tapEvent(), function () {
                Dialog.confirm("theme", self.options);
            });

            this.control("json")
            .on(Dialog.tapEvent(), function () {
                Dialog.confirm("json", self.options)
                .then((js) => {
                    if (typeof js !== "undefined")
                        self.options.new_json = js;
                });
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
            // needs_image and cloud_path options are passed straight on
            // to store_settings
            this.control("theme")
            .find("option:selected")
            .prop("selected", false);

            this.control("theme")
            .find("option[value='" + $.styling.theme() + "']")
            .prop("selected", true);

            this.control("autosave").prop("checked", this._autosave());

            this.control("hidevalues").prop("checked", Tree.hidingValues());

            this.control("lastchange").prop("checked", Tree.showingChanges());

            Translator.instance().language().then((lingo) => {
                this.control("language").val(lingo);
            });
        }

        ok() {
            return this.options;
        }
    }
    return ExtrasDialog;
});
