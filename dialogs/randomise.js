/*@preserve Copyright (C) 2015-2019 Crawford Currie http://c-dot.co.uk license MIT*/
/**
 * Password generation for the given leaf node
 * Options:
 * $node (required)
 * app (required)
 */
define(["js/Dialog", "js/Utils", "js/Hoard"], function(Dialog, Utils, Hoard) {
    const DEFAULT_RANDOM_LEN = 30;
    const DEFAULT_RANDOM_CHS = "A-Za-z0-9!%^&*_$+-=;:@#~,./?";

    let test_constraints = DEFAULT_RANDOM_LEN + ";" + DEFAULT_RANDOM_CHS;
    
    class RandomiseDialog extends Dialog {

        constraints_changed() {
            let $node = this.options.$node;
            let nc = $node.data("constraints");
            if (typeof nc !== "undefined")
                nc = nc.split(/;/, 2);
            else
                nc = [DEFAULT_RANDOM_LEN, DEFAULT_RANDOM_CHS];
            let dlg_l = this.control("len").val();
            let dlg_c = this.control("chs").val();

            if (dlg_l !== nc[0] || dlg_c !== nc[1])
                this.control("remember").show();
            else
                this.control("remember").hide();

            if (dlg_l !== DEFAULT_RANDOM_LEN || dlg_c !== DEFAULT_RANDOM_CHS)
                this.control("reset").show();
            else
                this.control("reset").hide();

            this.control("again")
                .trigger(this.tapEvent());
        }

        reset_constraints() {
            this.control("len").val(DEFAULT_RANDOM_LEN);
            this.control("chs").val(DEFAULT_RANDOM_CHS);
            this.constraints_changed();
        }

        initialise() {
            let self = this;
            
            this.control("again")
                .on(this.tapEvent(), function () {
                    self.control("idea")
                        .text(Utils.generatePassword({
                            length: self.control("len").val(),
                            charset: self.control("chs").val()
                        }));
                    return false;
                });
            this.control("use")
                .on(this.tapEvent(), function () {
                    self.close();
                    self.options.app.playAction(Hoard.new_action(
                        "E", self.options.$node.tree("getPath"), Date.now(),
                        self.control("idea").text()));
                    return true;
                });
            this.control("len")
                .on("change", function () {
                    self.constraints_changed();
                });
            this.control("chs")
                .on("change", function () {
                    self.constraints_changed();
                });
            this.control("remember")
                .on(this.tapEvent(), function () {
                    let c = self.control("len").val() + ";" +
                        self.control("chs").val();
                    self.options.app.playAction(Hoard.new_action(
                        "X", self.options.$node.tree("getPath"), Date.now(),
                        c));
                    self.constraints_changed();
                });
            this.control("reset")
                .on(this.tapEvent(), function () {
                    self.reset_constraints();
                });
        }

        open() {
            let $node = this.options.$node;
            let my_key = $node.data("key");
            let c = $node.data("constraints");
            let path = $node.tree("getPath");
            if (c) {
                c = c.split(";", 2);
                this.control("len").val(c[0]);
                this.control("chs").val(c[1]);
            }

            //this.control("path").text(path.join("↘"));
            this.control("key").text(my_key);
            this.control("again").trigger(this.tapEvent());
            this.control("remember").hide();

            this.constraints_changed();
        }
    }
    return RandomiseDialog;
});
