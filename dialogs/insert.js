define(["dialogs/Dialog"], function(Dialog) {
    class InsertDialog extends Dialog {
        
        initialise() {
            let self = this;
            self.control("key")
                .on("input", function () {
                    self.validateUniqueKey();
                });
        }

        ok() {
            if (self.$parent)
                this.app().add_child_node(
                    self.$parent,
                    this.control("key").val(),
                    self.data);
        }

        open(e, options) {
            let $parent = options.$node;
            this.data = options.data;
            this.$parent = $parent;
            if ($parent) {
                let base = this.tx("A copy");
                let name = new RegExp("^" + base + " ?(\\d*)$");
                let i = -1;
                $parent.find("ul")
                    .first()
                    .children(".tree-node")
                    .each(function () {
                        let m = name.exec($(this).data("key"));
                        if (m)
                            i = Math.max(i, m[1] ? parseInt(m[1]) : 0);
                    });
                this.control("key")
                    .val(base + (i >= 0 ? (" " + (i + 1)) : ""));
            }
            
        }
    }
    return InsertDialog;
});
