/*@preserve Copyright (C) 2019 Crawford Currie http://c-dot.co.uk license MIT*/
/* eslint-env browser */

define("dialogs/extras", [
	"js/Dialog", "js/Translator", "js/Tree", "js-cookie", "js/jq/styling"
], (Dialog, Translator, Tree, Cookies) => {

	/**
	 * Settings dialog
	 */
    class ExtrasDialog extends Dialog {

        _autosave(on) {
            if (typeof on !== "undefined") {
                const ons = (on ? "on" : "off");
                if (Cookies.get("ui_autosave") !== ons) {
                    Cookies.set("ui_autosave", ons, {
                        expires: 365,
						samesite: "strict"
                    });
                    $(document).trigger("update_save");
                }
            }
            return Cookies.get("ui_autosave") === "on";
        }

        _checkSamePass() {
            const p = this.$control("pass").val(),
                c = this.$control("conf").val();
            const ok = (p !== "" && p === c);
            this.$control("nonull").toggle(p === "");
            this.$control("nomatch").toggle(p !== c);
            this.$control("ok").toggle(ok);
            return ok;
        }

        initialise() {
            const self = this;

            this.$control("theme")
            .on("selectmenuchange", function () {
                $.styling.theme($(this).val());
            })
            .selectmenu();

            this.$control("autosave")
            .on("change", function () {
                self._autosave($(this).prop("checked"));
            });

            this.$control("hidevalues")
            .on("change", function () {
                const checked = $(this).prop("checked");
                Tree.hideValues(checked);
            });

            this.$control("lastchange")
            .on("change", function () {
                const checked = $(this).prop("checked");
                Tree.showChanges(checked);
            });

            this.$control("chss")
            .on(Dialog.tapEvent(), function () {
                Dialog.confirm("store_settings", self.options)
                .then(paths => {
                    self.options.cloud_path(paths.cloud_path);
                    self.options.image_url(paths.image_url);
                     $(document).trigger("update_save");
               })
                .catch(f => {
                    if (self.debug) self.debug("Store settings aborted", f);
                });
            });

            this.$control("chpw")
            .on(Dialog.tapEvent(), function () {
                Dialog.confirm("change_password", self.options)
                .then(pass => self.options.encryption_pass(pass))
                .catch(f => {
                    if (self.debug) self.debug("Change password aborted", f);
                });
            });

            // TODO: add password constraints
            // Cookie ui_randomise contains a JSON { size:, chars: }

            this.$control("theme")
            .on(Dialog.tapEvent(), function () {
                Dialog.confirm("theme", self.options);
            });

            this.$control("optimise")
            .on(Dialog.tapEvent(), function () {
                Dialog.confirm("optimise", self.options)
                .catch(() => {});
            });

            this.$control("reset_local")
            .on(Dialog.tapEvent(), function () {
                Dialog.confirm("alert", {
                    title: self.tx("Reset Local Store"),
                    alert: {
                        severity: "warning",
                        message: self.tx("Please confirm you want to reset your local store. Changes not saved in the cloud will be lost!")
                    }
                })
                .then(() => {
                    if (self.debug) self.debug("Resetting....");
                    self.options.reset_local_store();
                })
                .catch(() => {});
            });

            this.$control("bigger")
            .on(Dialog.tapEvent(), function () {
                $.styling.scale(Math.round(1.25 * $.styling.scale()));
            });

            this.$control("smaller")
            .on(Dialog.tapEvent(), function () {
                $.styling.scale(Math.round(0.8 * $.styling.scale()));
            });

            this.$control("about")
            .on(Dialog.tapEvent(), function () {
                Dialog.confirm("about", self.options)
                .catch(() => {
                });
            });

            this.$control("language")
            .on("change", function () {
                const fresh = self.$control("language").val();
                self.options.set_language(fresh);
            });
        }

        open() {
            this.$control("theme")
            .val($.styling.theme())
            .selectmenu("refresh");

            this.$control("autosave").prop("checked", this._autosave());

            this.$control("hidevalues").prop("checked", Tree.hidingValues());

            this.$control("lastchange").prop("checked", Tree.showingChanges());

            Translator.instance().language().then(
				lingo => this.$control("language").val(lingo));
        }
    }
    return ExtrasDialog;
});
