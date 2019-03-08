/**
 * Confirm deletion of a node
 */
define(["dialogs/Dialog"], function(Dialog) {
    class DeleteDialog extends Dialog {
        ok() {
            if (this.app())
                this.app().playAction(Hoard.new_action(
                    "D", this.$node().tree("getPath"), Date.now()));
            return true;
        }
        
        open() {
            if (this.$node()) {
                this.control("path")
                    .text(
                        !this.$node().tree("getPath")
                            .join("↘"));
                this.control("coll")
                    .toggle(!this.$node().hasClass("tree-leaf"));
            }
        }
    }
    return DeleteDialog;
});
