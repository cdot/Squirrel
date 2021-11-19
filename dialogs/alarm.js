/*@preserve Copyright (C) 2015-2019 Crawford Currie http://c-dot.co.uk license MIT*/
/* eslint-env browser */
/**
 * Reminder setting dialog
 * Options:
 */
define("dialogs/alarm", [
	"js/Dialog", "js/Action", "js/jq/template", "jquery-ui"
], (Dialog, Action) => {

    const MSPERDAY = 24 * 60 * 60 * 1000;

    class AlarmDialog extends Dialog {

        _getPickedDate() {
            return this.$control("date").datepicker("getDate").getTime();
        }

        _updateSave() {
            const isEnabled = this.$control("enabled").prop("checked");
            const curd = this._getPickedDate() / MSPERDAY;
            const oldd = this.alarmTime / MSPERDAY;
            //console.log(curd, oldd);
            this.$control("ok").toggle(
                isEnabled !== this.wasEnabled || Math.abs(curd - oldd) >= 1);
        }

        _updateFromDelta() {
            const numb = this.$control("number").val();
            const unit = this.$control("unit").val();
            this.$control("date")
            .datepicker("setDate", `+${numb}${unit}`);
            this._updateSave();
        }

        /**
		 * @Override
		 */
        initialise() {
            this.$control("enabled")
            .on("change", () => {
                const checked = $(this).prop("checked");
                this.$control("settings")
                .find(":input").prop("disabled", !checked);
                this._updateSave();
            });

            this.$control("date")
            .datepicker({ dateFormat: "yy-mm-dd" })
            .change(() => {
                const delta = Math.floor(
                    (this._getPickedDate() - Date.now()) / MSPERDAY);
                this.$control("number").val(delta);
                this.$control("unit").val("d");
                this._updateSave();
            });

            this.$control("unit")
                .on("change", () => this._updateFromDelta());

            this.$control("number")
                .on("change", () => {
                    this._updateFromDelta();
                });
        }

        ok() {
            const isEnabled = this.$control("enabled").prop("checked");
			if (isEnabled || this.wasEnabled) {
				const act = new Action({
                    type: 'A',
					path: this.options.path
				});
				if (isEnabled) {
					act.data = {
						due: this.$control("date")
						.datepicker("getDate").getTime(),
						repeat: 0 // TODO: grab this
					};
				}
				return act;
			}            
            return undefined;
        }

        /**
		 * @Override
		 */
        open() {
            this.$control("path").text(Action.pathS(this.options.path));
            this.wasEnabled = (typeof this.options.alarm !== 'undefined');

            this.$control("enabled").prop("checked", this.wasEnabled);
            this.$control("settings").find(":input").prop("disabled", !this.wasEnabled);
            const now = new Date().getTime();

            if (this.wasEnabled)
                this.alarmTime = new Date(this.options.alarm.due);
			else
                this.alarmTime = now;

            if (this.alarmTime < now) {
                if (this.options.alarm.repeat > 0)
                    this.alarmTime = now + this.options.alarm.repeat;
                else
                    this.alarmTime = now + 180 * MSPERDAY;
            }
            this.$control("unit").val("d");
            this.$control("number").val(Math.floor((this.alarmTime - now) / MSPERDAY));
            this.$control("date").datepicker("setDate", new Date(this.alarmTime));
            this.$control("ok").hide();
        }
    }
    return AlarmDialog;
});
