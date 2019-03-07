define(function() {
    return function($dlg) {
        /**
         * Confirm deletion of a node
         */
        $dlg.on('dlg-initialise', function () {
            $dlg.squirrel_dialog("control", "ok")
                .on($.getTapEvent(), function () {
                    $dlg.squirrel_dialog("close");
                    $dlg.squirrel_dialog("squirrel").playAction(Hoard.new_action(
                        "D", $dlg.data("node").tree("getPath"), Date.now()));
                    return true;
                });
            $dlg.squirrel_dialog("control", "cancel")
                .on($.getTapEvent(), function () {
                    $dlg.squirrel_dialog("close");
                    return false;
                });
        });

        $dlg.on('dlg-open', function () {
            let $dlg = $(this);
            $dlg.squirrel_dialog("control", "path")
                .text(
                    $dlg.data("node").tree("getPath")
                        .join("↘"));
            $dlg.squirrel_dialog("control", "coll")
                .toggle(!$dlg.data("node").hasClass("tree-leaf"));
        });
    }
});
