define(["dialogs/Validator", function(validateUniqueKey) {
    return function($dlg) {
        $dlg.on('dlg-initialise', function () {
            let $dlg = $(this);

            function ok_dialog() {
                $dlg.squirrel_dialog("close");
                let $parent = $dlg.data("parent");
                $dlg.squirrel_dialog("squirrel").add_child_node(
                    $parent, $dlg.squirrel_dialog("control", "key")
                        .val(),
                    $dlg.data("adding_value") ?
                        $dlg.squirrel_dialog("control", "value")
                        .val() : undefined);
                return false;
            }

            $dlg.squirrel_dialog("control", "key")
                .on("input", function () {
                    _validateUniqueKey($dlg);
                })
                .on("change", ok_dialog)
                .autocomplete({
                    source: [
                        TX.tx("User"), TX.tx("Pass")]
                });

            $dlg.squirrel_dialog("control", "ok")
                .on($.getTapEvent(), ok_dialog);
        });

        $dlg.on('dlg-open', function (e, options) {
            let $dlg = $(this);
            let $parent = options.$node;
            let is_value = options.is_value;
            $dlg.data("parent", $parent);
            $dlg.data("adding_value", is_value);

            $dlg.squirrel_dialog("control", "path")
                .text($parent.tree("getPath")
                      .join("↘") + "↘");
            if (is_value) {
                $dlg.squirrel_dialog("control", "value_help")
                    .show();
                $dlg.squirrel_dialog("control", "folder_help")
                    .hide();
                $dlg.squirrel_dialog("control", "value_parts")
                    .show();
                $dlg.squirrel_dialog("control", "key")
                    .autocomplete("enable")
                    .select();
                $dlg.squirrel_dialog("control", "value")
                    .val("");
            } else {
                $dlg.squirrel_dialog("control", "value_help")
                    .hide();
                $dlg.squirrel_dialog("control", "folder_help")
                    .show();
                $dlg.squirrel_dialog("control", "value_parts")
                    .hide();
                $dlg.squirrel_dialog("control", "key")
                    .autocomplete("disable")
                    .select();
            }

            validateUniqueKey($dlg);
        });
    }
});
