/*@preserve Copyright (C) 2015-2019 Crawford Currie http://c-dot.co.uk license MIT*/

/**
 * Options:
 * $node (required)
 * app (required)
 * is_value (optional)
 */

define(["js/Dialog", "js/Translator"], function(Dialog, Translator) {
    
    class AddDialog extends Dialog {

        /**
         * @protected
         * Code shared between add and insert
         */
        validateUniqueKey() {
            // Disable OK if key value exists or is invalid
            let $input = this.control("key");
            let val = $input.val();
            let enabled = true;

            if (!/\S/.test(val)) // empty?
                enabled = false;
            else {
                let $ul = this.options.$node
                    .find("ul")
                    .first();
                $ul.children(".tree-node")
                    .each(function () {
                        if (this.app.compare(
                            $(this).data("key"), val) === 0) {
                            enabled = false;
                            return false;
                        }
                    });
            }

            if (enabled) {
                this.control("ok").icon_button("enable");
                $input
                    .removeClass("dlg-disabled")
                    .attr("title", this.tx("Enter new name"));
            } else {
                this.control("ok").icon_button("disable");
                $input
                    .addClass("dlg-disabled")
                    .attr("title", this.tx("Name is already in use"));
            }
        }

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

        open() {
            this.control("path")
                .text(this.options.$node.tree("getPath")
                      .join("↘") + "↘");
            if (this.options.is_value) {
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

        ok() {
            this.options.app.add_child_node(
                this.options.$node,
                this.control("key").val(),
                this.options.is_value ?
                    this.control("value").val() : this.options.data);
            return super.ok();
        }
        
    }
    return AddDialog;
});
