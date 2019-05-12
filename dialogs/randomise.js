/*@preserve Copyright (C) 2015-2019 Crawford Currie http://c-dot.co.uk license MIT*/
/* eslint-env browser */

/**
 * Password generation for the given leaf node
 */
define("dialogs/randomise", ["js/Dialog", "js/Utils", "js/Action", "js/Hoard"], function(Dialog, Utils, Action, Hoard) {
    const DEFAULT_RANDOM_LEN = 30;
    const DEFAULT_RANDOM_CHS = "A-Za-z0-9!%^&*_$+-=;:@#~,./?";

    /**
     * Generate a new password subject to constraints:
     * length: length of password
     * charset: characters legal in the password. Ranges can be defined
     * using A-Z syntax. - must be the last or first character for it
     * to be included. Inverted ranges are supported e.g. Z-A
     */
    function generatePassword(constraints) {
        if (!constraints)
            constraints = {};

        if (typeof constraints.length === "undefined")
            constraints.length = 24;

        if (typeof constraints.charset === "undefined")
            constraints.charset = "A-Za-z0-9";

        let cs = constraints.charset;
        let legal = [];
        while (cs.length > 0) {
            let sor = cs.charAt(0);
            if (cs.length >= 3 && cs.charAt(1) === "-") {
                let eor = cs.charAt(2);
                let sorc = sor.charCodeAt(0);
                let eorc = eor.charCodeAt(0);
                cs = cs.substring(3);
                if (sorc > eorc) {
                    let t = eorc; eorc = sorc; sorc = t;
                }
                while (sorc <= eorc) {
                    legal.push(String.fromCharCode(sorc++));
                }
            } else {
                legal.push(sor);
                cs = cs.substring(1);
            }
        }
        let array = new Uint8Array(constraints.length);
        if (typeof window !== "undefined")
            window.crypto.getRandomValues(array);
        else {
            for (let i in array)
                array[i] = Math.floor(Math.random() * 256);
        }
        let s = "";
        for (let rand of array) {
            s += legal[rand % legal.length];
        }
        return s;
    }

    class RandomiseDialog extends Dialog {

        constraints_changed() {
            let dlg_l = parseInt(this.control("len").val());
            let dlg_c = this.control("chs").val();
            let memorable = (dlg_l !== this.init_size || dlg_c !== this.init_chars);
            this.control("remember-label").toggle(memorable);
            this.control("remember").toggle(memorable);

            this.control("reset").toggle(
                dlg_l !== DEFAULT_RANDOM_LEN || dlg_c !== DEFAULT_RANDOM_CHS);

            this.control("again").trigger(Dialog.tapEvent());
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
            this.control("reset")
                .on(Dialog.tapEvent(), function () {
                    self.reset_constraints();
                });
        }

        ok() {
            let res = { text: this.control("idea").text() };
            if (this.control("remember").prop("checked")) {
                res.constraints = {
                    size: this.control("len").val(),
                    chars: this.control("chs").val()
                }
            }
            return res;
        }
        
        open() {
            this.init_size = this.options.constraints.size;
            this.init_chars = this.options.constraints.chars;
            
            this.control("len").val(this.init_size);
            this.control("chs").val(this.init_chars);

            //this.control("path").text(path.join("↘"));
            this.control("key").text(this.options.key);
            this.control("again").trigger(Dialog.tapEvent());
            this.control("remember").hide();

            this.constraints_changed();
        }
    }
    return RandomiseDialog;
});
