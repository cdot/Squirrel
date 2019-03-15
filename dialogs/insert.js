/*@preserve Copyright (C) 2019 Crawford Currie http://c-dot.co.uk license MIT*/
/**
 * Insert a copy of data
 * Options:
 * $node (required)
 * data: data value to insert
 */
define(["dialogs/add"], function(AddDialog) {
    class InsertDialog extends AddDialog {

        initialise() {
            let self = this;
            self.control("key")
                .on("input", function () {
                    self.validateUniqueKey();
                });
        }

        open() {
            let base = this.tx("A copy");
            let name = new RegExp("^" + base + " ?(\\d*)$");
            let i = -1;

            this.options.$node.find("ul")
                .first()
                .children(".tree-node")
                .each(function () {
                    let m = name.exec($(this).data("key"));
                    if (m)
                        i = Math.max(i, m[1] ? parseInt(m[1]) : 0);
                });
            this.control("key").val(base + (i >= 0 ? (" " + (i + 1)) : ""));
        }
    }
    return InsertDialog;
});
