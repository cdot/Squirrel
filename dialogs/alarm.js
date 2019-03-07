/**
 * Reminder setting dialog
 */
define(function() {
    /* Helper */
    function _updateNext($dlg) {
        let numb = $dlg.squirrel_dialog("control", "number")
            .val();
        // Convert to days
        numb = numb * Utils.TIMEUNITS[$dlg.squirrel_dialog("control", "units")
                                      .val()].days;
        let alarmd = new Date(Date.now() + numb * Utils.MSPERDAY);
        $dlg.squirrel_dialog("control", "nextmod")
            .template(
                "expand",
                Utils.deltaTimeString(alarmd),
                alarmd.toLocaleDateString());
    }

    return function($dlg) {
        $dlg.on('dlg-initialise', function () {
            $dlg.squirrel_dialog("control", "units")
                .on("change", function () {
                    _updateNext($dlg);
                });

            $dlg.squirrel_dialog("control", "number")
                .on("change", function () {
                    _updateNext($dlg);
                });

            $dlg.squirrel_dialog("control", "remind")
                .on($.getTapEvent(), function () {
                    $dlg.squirrel_dialog("close");
                    let numb = $dlg.squirrel_dialog("control", "number")
                        .val() *
                        Utils.TIMEUNITS[$dlg.squirrel_dialog("control", "units")
                                        .val()].days;
                    $dlg.squirrel_dialog("squirrel").playAction(Hoard.new_action(
                        "A", $dlg.data("node").tree("getPath"), Date.now(),
                        numb));
                    return false;
                });

            $dlg.squirrel_dialog("control", "clear")
                .on($.getTapEvent(), function () {
                    $dlg.squirrel_dialog("close");
                    $dlg.squirrel_dialog("squirrel").playAction(Hoard.new_action(
                        "C", $dlg.data("node").tree("getPath"), Date.now()));
                    return false;
                });
        });

        $dlg.on('dlg-open', function () {
            let $node = $dlg.data("node");

            $dlg.squirrel_dialog("control", "path")
                .text($node.tree("getPath")
                      .join("↘"));

            $dlg.data("node", $node);
            let lastmod = $node.data("last-time-changed");
            $dlg.squirrel_dialog("control", "lastmod")
                .template(
                    "expand",
                    new Date(lastmod)
                        .toLocaleString());

            if (typeof $node.data("alarm") !== "undefined") {
                let alarm = new Date(
                    lastmod + $node.data("alarm") * Utils.MSPERDAY);
                $dlg.squirrel_dialog("control", "current")
                    .template(
                        "expand",
                        Utils.deltaTimeString(alarm),
                        alarm.toLocaleDateString())
                    .show();
                $dlg.squirrel_dialog("control", "clear")
                    .show();
            } else {
                $dlg.squirrel_dialog("control", "current")
                    .hide();
                $dlg.squirrel_dialog("control", "clear")
                    .hide();
            }

            _updateNext(this);
        });
    }
});
