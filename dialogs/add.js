define(["dialogs/Dialog", "js/Translator"], function(Dialog, Translator) {
    
    class AddDialog extends Dialog {
        initialise() {
            let self = this;

            this.control("key")
                .on("input", function () {
                    self.validateUniqueKey();
                })
                .on("change", () => {
                    self.control("ok").trigger(self.tapEvent());
                })
                .autocomplete({
                    source: [
                        self.tx("User"), self.tx("Pass")]
                });
        }

        ok() {
            if (this.$parent && this.app()) {
                this.app().add_child_node(
                    this.$parent, this.control("key").val(),
                    this.adding_value ?
                        this.control("value").val() : undefined);
            }
            return true;
        }
        
        open(e, options) {
            this.$parent = options.$node;
            let is_value = options.is_value;
            this.adding_value = is_value;

            if (this.$parent)
                this.control("path")
                .text(this.$parent.tree("getPath")
                      .join("↘") + "↘");
            if (is_value) {
                this.control("value_help")
                    .show();
                this.control("folder_help")
                    .hide();
                this.control("value_parts")
                    .show();
                this.control("key")
                    .autocomplete("enable")
                    .select();
                this.control("value")
                    .val("");
            } else {
                this.control("value_help")
                    .hide();
                this.control("folder_help")
                    .show();
                this.control("value_parts")
                    .hide();
                this.control("key")
                    .autocomplete("disable")
                    .select();
            }

            this.validateUniqueKey();
        }
    }
    return AddDialog;
});
