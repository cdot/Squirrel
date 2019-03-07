define(["dialogs/Validator", function(validateUniqueKey) {
    return function($dlg) {
        $dlg.on('dlg-initialise', function () {
            let $dlg = $(this);

            $dlg.squirrel_dialog("control", "key")
                .on("input", function () {
                    validateUniqueKey($dlg);
                });
            $dlg.squirrel_dialog("control", "ok")
                .on($.getTapEvent(), function () {
                    $dlg.squirrel_dialog("close");
                    $dlg.squirrel_dialog("squirrel").add_child_node($dlg.data("parent"),
                                                                    $dlg.squirrel_dialog("control", "key")
                                                                    .val(),
                                                                    $dlg.data("data"));
                });
        });

        $dlg.on('dlg-open', function (e, options) {
            let $dlg = $(this);
            if (global.DEBUG) console.debug("Pasting");
            let $parent = options.$node;
            $dlg.data("parent", $parent);
            $dlg.data("data", options.data);
            let base = TX.tx("A copy");
            let name = new RegExp("^" + base + " ?(\\d*)$");
            let i = -1;
            $parent.find("ul")
                .first()
                .children(".tree-node")
                .each(function () {
                    let m = name.exec($(this)
                                      .data("key"));
                    if (m)
                        i = Math.max(i, m[1] ? parseInt(m[1]) : 0);
                });
            $dlg.squirrel_dialog("control", "key")
                .val(base + (i >= 0 ? (" " + (i + 1)) : ""));
        });
    }
});
