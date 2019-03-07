/* Helper for add, check wrapping node for same key value  */
define(function() {
    return function($dlg) {
        // Disable OK if key value exists or is invalid
        let $input = $dlg.squirrel_dialog("control", "key");
        let val = $input.val();
        let enabled = true;

        if (!/\S/.test(val)) // empty?
            enabled = false;
        else {
            let $ul = $dlg.data("parent")
                .find("ul")
                .first();
            $ul.children(".tree-node")
                .each(function () {
                    if ($dlg.squirrel_dialog("squirrel").compare(
                        $(this).data("key"), val) === 0) {
                        enabled = false;
                        return false;
                    }
                });
        }

        if (enabled) {
            $dlg.squirrel_dialog("control", "ok")
                .icon_button("enable");
            $input
                .removeClass("dlg-disabled")
                .attr("title", TX.tx("Enter new name"));
        } else {
            $dlg.squirrel_dialog("control", "ok")
                .icon_button("disable");
            $input
                .addClass("dlg-disabled")
                .attr("title", TX.tx("Name is already in use"));
        }
    };
});
