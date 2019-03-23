/*@preserve Copyright (C) 2015-2019 Crawford Currie http://c-dot.co.uk license MIT*/
/**
 * Reminder setting dialog
 * Options:
 * $node (rquired)
 * app (required)
 */
define(["js/Dialog", "js/Hoard", "js/jq/template", "jquery-ui"], function(Dialog, Hoard) {

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
            let pat = this.options.$node.tree("getPath");
            let act;
            if (isEnabled)
                act = Hoard.new_action({
                    type: "A", path: pat,
                    data: {
                        time: this.control("date")
                        .datepicker("getDate").getTime()
                    }
                });
            else if (this.wasEnabled)
                act = Hoard.new_action({ type: "C", path: pat });
            
            return this.options.app.playAction(act);
        }

        // @Override
        open() {
            let $node = this.options.$node;
            let lastmod;

            this.control("path").text($node.tree("getPath").join("↘"));

            let enabled = (typeof $node.data("alarm") !== "undefined");
            this.wasEnabled = enabled;

            this.control("enabled").prop("checked", enabled);
            this.control("settings").find(":input").prop("disabled", !enabled);
            let now = new Date();

            if (enabled) {
                // Old format alarms had one number, number of days from
                // last node change.
                let alarm = $node.data("alarm");
                if (typeof alarm === "number") {
                    // Update format
                    alarm = {
                        time: $node.data("last-time-changed")
                        + alarm * MSPERDAY };
                    $node.data("alarm", alarm);
                }
                this.alarmTime = new Date(alarm.time);
            } else
                this.alarmTime = now;

            this.control("unit").val("d");
            this.control("number").val(Math.floor((this.alarmTime - now) / MSPERDAY));
            this.control("date").datepicker("setDate", this.alarmTime);
            this.control("ok").hide()
        }
    }
    return AlarmDialog;
});
