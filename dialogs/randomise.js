/**
 * Password generation for the given leaf node
 */
 define(function() {
     const DEFAULT_RANDOM_LEN = 30;
     const DEFAULT_RANDOM_CHS = "A-Za-z0-9!%^&*_$+-=;:@#~,./?";

     function constraints_changed($dlg) {
         let $node = $dlg.data("node");
         let nc = $node.data("constraints");
         if (typeof nc !== "undefined")
             nc = nc.split(/;/, 2);
         else
             nc = [DEFAULT_RANDOM_LEN, DEFAULT_RANDOM_CHS];
         let dlg_l = $dlg.squirrel_dialog("control", "len").val();
         let dlg_c = $dlg.squirrel_dialog("control", "chs").val();

         if (dlg_l !== nc[0] || dlg_c !== nc[1])
             $dlg.squirrel_dialog("control", "remember").show();
         else
             $dlg.squirrel_dialog("control", "remember").hide();

         if (dlg_l !== DEFAULT_RANDOM_LEN || dlg_c !== DEFAULT_RANDOM_CHS)
             $dlg.squirrel_dialog("control", "reset").show();
         else
             $dlg.squirrel_dialog("control", "reset").hide();

         $dlg.squirrel_dialog("control", "again")
             .trigger($.getTapEvent());
     }

     function reset_constraints($dlg) {
         $dlg.squirrel_dialog("control", "len").val(DEFAULT_RANDOM_LEN);
         $dlg.squirrel_dialog("control", "chs").val(DEFAULT_RANDOM_CHS);
         constraints_changed($dlg);
     }

     return function($dlg) {
         $dlg.on('dlg-initialise', function () {
             $dlg.squirrel_dialog("control", "again")
                 .on($.getTapEvent(), function () {
                    $dlg.squirrel_dialog("control", "idea")
                        .text(Utils.generatePassword({
                            length: $dlg.squirrel_dialog("control", "len")
                                .val(),
                            charset: $dlg.squirrel_dialog("control", "chs")
                                .val()
                        }));
                    return false;
                });
            $dlg.squirrel_dialog("control", "use")
                .on($.getTapEvent(), function () {
                    $dlg.squirrel_dialog("close");
                    $dlg.squirrel_dialog("squirrel").playAction(Hoard.new_action(
                        "E", $dlg.data("node").tree("getPath"), Date.now(),
                        $dlg.squirrel_dialog("control", "idea").text()));
                    return true;
                });
            $dlg.squirrel_dialog("control", "len")
                .on("change", function () {
                    constraints_changed($dlg);
                });
            $dlg.squirrel_dialog("control", "chs")
                .on("change", function () {
                    constraints_changed($dlg);
                });
            $dlg.squirrel_dialog("control", "remember")
                .on($.getTapEvent(), function () {
                    $dlg.squirrel_dialog("squirrel").playAction(Hoard.new_action(
                        "X", $dlg.data("node").tree("getPath"), Date.now(),
                        $dlg.squirrel_dialog("control", "len").val() + ";" +
                            $dlg.squirrel_dialog("control", "chs").val()));
                    constraints_changed($dlg);
                });
            $dlg.squirrel_dialog("control", "reset")
                .on($.getTapEvent(), function () {
                    reset_constraints($dlg);
                });
        });

        $dlg.on('dlg-open', function () {
            let $node = $dlg.data("node");
            let my_key = $node.data("key");
            let c = $node.data("constraints");

            if (c) {
                c = c.split(";", 2);
                $dlg.squirrel_dialog("control", "len").val(c[0]);
                $dlg.squirrel_dialog("control", "chs").val(c[1]);
            }

            let path = $node.tree("getPath");
            $dlg.squirrel_dialog("control", "path")
                .text(path.join("↘"));
            $dlg.squirrel_dialog("control", "key")
                .text(my_key);
            $dlg.squirrel_dialog("control", "again")
                .trigger($.getTapEvent());

            $dlg.squirrel_dialog("control", "remember")
                .hide();

            constraints_changed($dlg);
        });
    }
});
