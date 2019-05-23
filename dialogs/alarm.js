/*@preserve Copyright (C) 2015-2019 Crawford Currie http://c-dot.co.uk license MIT*/
/* eslint-env browser */
/**
 * Reminder setting dialog
 * Options:
 */
define("dialogs/alarm", ["js/Dialog", "js/Action", "js/Hoard", "js/jq/template", "jquery-ui"], function(Dialog, Action, Hoard) {

    const MSPERDAY = 24 * 60 * 60 * 1000;

    class AlarmDialog extends Dialog {

        _getPickedDate() {
            return this.control("date").datepicker("getDate").getTime();
        }

        _updateSave() {
            let isEnabled = this.control("enabled").prop("checked");
            let curd = this._getPickedDate() / MSPERDAY;
            let oldd = this.alarmTime / MSPERDAY;
            //console.log(curd, oldd);
            this.control("ok").toggle(
                isEnabled !== this.wasEnabled || Math.abs(curd - oldd) > 1);
        }

        _updateFromDelta() {
            let numb = this.control("number").val();
            let unit = this.control("unit").val();
            this.control("date")
            .datepicker("setDate", "+" + numb + unit);
            this._updateSave();
        }

        // @Override
        initialise() {
            let self = this;

            this.control("enabled")
            .on("change", function() {
                let checked = $(this).prop("checked");
                self.control("settings")
                .find(":input").prop("disabled", !checked);
                self._updateSave();
            });

            this.control("date")
            .datepicker({ dateFormat: "yy-mm-dd" })
            .change(() => {
                let delta = Math.floor(
                    (this._getPickedDate() - Date.now()) / MSPERDAY);
                this.control("number").val(delta);
                this.control("unit").val("d");
                self._updateSave();
            });

            this.control("unit")
                .on("change", function () {
                    self._updateFromDelta();
                });

            this.control("number")
                .on("change", function () {
                    self._updateFromDelta();
                });
        }

        ok() {
            let isEnabled = this.control("enabled").prop("checked");
            let act;
            if (isEnabled)
                act = new Action({
                    type: "A",
                    path: this.options.path,
                    data: {
                        due: this.control("date")
                        .datepicker("getDate").getTime(),
                        repeat: 0 // TODO: grab this
                    }
                });
            else if (this.wasEnabled)
                act = new Action({
                    type: "C",
                    path: this.options.path
                });
            
            return act;
        }

        // @Override
        open() {
            this.control("path").text(Action.pathS(this.options.path));
            this.wasEnabled = (typeof this.options.alarm !== "undefined");

            this.control("enabled").prop("checked", this.wasEnabled);
            this.control("settings").find(":input").prop("disabled", !this.wasEnabled);
            let now = new Date().getTime();

            if (this.wasEnabled) {
                // Old format alarms had one number, number of days from
                // last node change.
                if (typeof this.options.alarm === "number") {
                    alarm = {
                        time: this.options.last_change
                        + this.options.alarm * MSPERDAY
                    };
                }
                this.alarmTime = new Date(this.options.alarm.time);
            } else
                this.alarmTime = now;

            if (this.alarmTime < now) {
                if (this.options.alarm.repeat > 0)
                    this.alarmTime = now + this.options.alarm.repeat;
                else
                    this.alarmTime = now + 180 * MSPERDAY;
            }
            this.control("unit").val("d");
            this.control("number").val(Math.floor((this.alarmTime - now) / MSPERDAY));
            this.control("date").datepicker("setDate", new Date(this.alarmTime));
            this.control("ok").hide()
        }
    }
    return AlarmDialog;
});
