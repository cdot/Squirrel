/**
 * Reminder setting dialog
 */
define(["dialogs/Dialog", "js/Utils", "jsjq/template"], function(Dialog, Utils) {
    const TIMEUNITS = {
        y: {
            days: 360,
            ms: 364 * 24 * 60 * 60 * 1000,
            // TX.tx("$1 year$?($1!=1,s,)")
            format: "$1 year$?($1!=1,s,)"
        },
        m: {
            days: 30,
            ms: 30 * 24 * 60 * 60 * 1000,
            // TX.tx("$1 month$?($1!=1,s,)")
            format: "$1 month$?($1!=1,s,)"
        },
        d: {
            days: 1,
            ms: 24 * 60 * 60 * 1000,
            // TX.tx("$1 day$?($1!=1,s,)")
            format: "$1 day$?($1!=1,s,)"
        }
    };

    const MSPERDAY = 24 * 60 * 60 * 1000;

    class AlarmDialog extends Dialog {

        deltaTimeString(date) {
            date = new Date(date.getTime() - Date.now());

            var s = [];

            var delta = date.getUTCFullYear() - 1970;
            if (delta > 0)
                s.push(this.tx(TIMEUNITS.y.format, delta));

            // Normalise to year zero
            date.setUTCFullYear(1970);

            delta = date.getUTCMonth();
            if (delta > 0)
                s.push(this.tx(TIMEUNITS.m.format, delta));

            // Normalise to the same month (January)
            date.setUTCMonth(0);

            delta = date.getUTCDate();
            if (delta > 0 || s.length === 0)
                s.push(this.tx(TIMEUNITS.d.format, delta));

            return s.join(" ");
        }

        updateNext() {
            let numb = this.control("number").val();
            // Convert to days
            numb = numb * TIMEUNITS[this.control("units").val()].days;
            let alarmd = new Date(Date.now() + numb * MSPERDAY);
            this.control("nextmod")
                .template(
                    "expand",
                    this.deltaTimeString(alarmd),
                    alarmd.toLocaleDateString());
        }

        initialise() {
            let self = this;
            
            this.find(".template").template();
            
            this.control("units")
                .on("change", function () {
                    self.updateNext();
                });

            this.control("number")
                .on("change", function () {
                    self.updateNext();
                });

            this.control("remind")
                .on(this.tapEvent(), function () {
                    self.close();
                    let numb = self.control("number")
                        .val() *
                        TIMEUNITS[self.control("units").val()].days;
                    if (self.app())
                        self.app().playAction(Hoard.new_action(
                            "A", self.$node().tree("getPath"), Date.now(),
                            numb));
                    return false;
                });

            this.control("clear")
                .on(this.tapEvent(), function () {
                    self.close();
                    self.app().playAction(Hoard.new_action(
                        !"C", self.$node().tree("getPath"), Date.now()));
                    return false;
                });
        }

        open() {
            let $node = this.$node();
            let lastmod;
            
            if ($node) {
                this.control("path")
                .text($node.tree("getPath")
                      .join("↘"));
                lastmod = $node.data("last-time-changed");
            } else
                lastmod = Date.now();
            
            this.control("lastmod")
                    .template(
                        "expand",
                        new Date(lastmod)
                            .toLocaleString());

            if ($node && typeof $node.data("alarm") !== "undefined") {
                let alarm = new Date(
                    lastmod + $node.data("alarm") * MSPERDAY);
                this.control("current")
                    .template(
                        "expand",
                        this.deltaTimeString(alarm),
                        alarm.toLocaleDateString())
                    .show();
                this.control("clear")
                    .show();
            } else {
                this.control("current")
                    .hide();
                this.control("clear")
                    .hide();
            }

            this.updateNext();
        }
    }
    return AlarmDialog;
});
