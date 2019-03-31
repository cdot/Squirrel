/*@preserve Copyright (C) 2015-2019 Crawford Currie http://c-dot.co.uk license MIT*/
/* eslint-env browser */

/**
 * Password generation for the given leaf node
 * Options:
 * $node (required)
 * app (required)
 */
define("dialogs/randomise", ["js/Dialog", "js/Utils", "js/Hoard"], function(Dialog, Utils, Hoard) {
    const DEFAULT_RANDOM_LEN = 30;
    const DEFAULT_RANDOM_CHS = "A-Za-z0-9!%^&*_$+-=;:@#~,./?";

    /**
     * Generate a new password subject to constraints:
     * length: length of password
     * charset: characters legal in the password. Ranges can be defined
     * using A-Z syntax.
     */
    function generatePassword(constraints) {
        let sor, eor;
        if (!constraints)
            constraints = {};

        if (typeof constraints.length === "undefined")
            constraints.length = 24;

        if (typeof constraints.charset === "undefined")
            constraints.charset = "A-Za-z0-9";

        let cs = constraints.charset;
        let legal = [];
        while (cs.length > 0) {
            if (cs.length >= 3 && cs.charAt(1) === "-") {
                sor = cs.charCodeAt(0);
                eor = cs.charCodeAt(2);
                cs = cs.substring(3);
                if (sor > eor)
                    throw new Error("Inverted constraint range "
                                    + cs.substr(0, 3));
                while (sor <= eor) {
                    legal.push(String.fromCharCode(sor++));
                }
            } else {
                legal.push(cs.charAt(0));
                cs = cs.substring(1);
            }
        }
        let array = new Uint8Array(constraints.length);
        if (typeof window !== "undefined")
            window.crypto.getRandomValues(array);
        else {
            for (let i = 0; i < constraints.length; i++)
                array[i] = Math.floor(Math.random() * 256);
        }
        let s = "";
        for (let i = 0; i < constraints.length; i++) {
            s += legal[array[i] % legal.length];
        }
        return s;
    }

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

            this.control("remember").toggle(dlg_l !== nc[0] || dlg_c !== nc[1]);

            this.control("reset").toggle(dlg_l !== DEFAULT_RANDOM_LEN || dlg_c !== DEFAULT_RANDOM_CHS);

            this.control("again")
                .trigger(Dialog.tapEvent());
        }

        reset_constraints() {
            this.control("len").val(DEFAULT_RANDOM_LEN);
            this.control("chs").val(DEFAULT_RANDOM_CHS);
            this.constraints_changed();
        }

        initialise() {
            let self = this;

            this.control("again")
                .on(Dialog.tapEvent(), function () {
                    self.control("idea")
                        .text(generatePassword({
                            length: self.control("len").val(),
                            charset: self.control("chs").val()
                        }));
                    return false;
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
                .on(Dialog.tapEvent(), function () {
                    let c = self.control("len").val() + ";" +
                        self.control("chs").val();
                    self.options.app.playAction(Hoard.new_action({
                        type: "X",
                        path: self.options.$node.tree("getPath"),
                        data: c
                    }));
                    self.constraints_changed();
                });
            this.control("reset")
                .on(Dialog.tapEvent(), function () {
                    self.reset_constraints();
                });
        }

        ok() {
            return this.options.app.playAction(Hoard.new_action({
                type: "E",
                path: this.options.$node.tree("getPath"),
                data: this.control("idea").text()
            }));
        }

        open() {
            let $node = this.options.$node;
            let my_key = $node.data("key");
            let c = $node.data("constraints");

            if (c) {
                c = c.split(";", 2);
                this.control("len").val(c[0]);
                this.control("chs").val(c[1]);
            }

            //this.control("path").text(path.join("↘"));
            this.control("key").text(my_key);
            this.control("again").trigger(Dialog.tapEvent());
            this.control("remember").hide();

            this.constraints_changed();
        }
    }
    return RandomiseDialog;
});
