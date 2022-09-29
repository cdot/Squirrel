/*@preserve Copyright (C) 2019-2022 Crawford Currie http://c-dot.co.uk license MIT*/
/* eslint-env browser */

define([
	"js/Dialog", "js/Tree",
  "cookie", "js/jq/styling", "i18n"
], (Dialog, Tree) => {

	/**
	 * Settings dialog.
	 * See {@link Dialog} for constructor parameters
	 * @extends Dialog
	 */
  class ExtrasDialog extends Dialog {

    _autosave(on) {
      if (typeof on !== 'undefined') {
        const ons = (on ? "on" : "off");
        if ($.cookie("ui_autosave") !== ons) {
          $.cookie("ui_autosave", ons, {
            expires: 365,
						sameSite: "strict"
          });
          $(document).trigger("update_save");
        }
      }
      return $.cookie("ui_autosave") === "on";
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

		/**
		 * @override
		 */
    initialise() {
      const self = this;

      this.$control("theme")
			.selectmenu()
      .on("selectmenuchange", function () {
				if (self.debug) self.debug(`theme changed to ${$(this).val()}`);
				$(this).selectmenu("disable");
				$.styling.theme($(this).val());
				$(this).selectmenu("enable");
			});

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
          title: $.i18n("reset_local"),
          alert: {
            severity: "warning",
            message: $.i18n("conf-reset-loc")
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
        self.options.set_language(fresh)
				.catch(e => {
					Dialog.confirm("alert", {
            title: $.i18n("i18n-fail"),
            alert: $.i18n("no_translations", fresh)
          });
				});
      });
    }

		/**
		 * @override
		 */
    open() {
      this.$control("theme")
      .val($.styling.theme())
      .selectmenu("refresh");

      this.$control("autosave").prop("checked", this._autosave());
      this.$control("hidevalues").prop("checked", Tree.hidingValues());
      this.$control("lastchange").prop("checked", Tree.showingChanges());
			this.$control("language").val($.i18n().locale);
    }

		/**
		 * @override
		 */
		closed() {
      if (this.debug) this.debug("extras closed");
		}
  }
  return ExtrasDialog;
});
