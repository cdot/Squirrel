/*@preserve Copyright (C) 2015-2019 Crawford Currie http://c-dot.co.uk license MIT*/
/* eslint-env browser */

/**
 * Password generation for the given leaf node
 */
define("dialogs/randomise", ["js/Dialog", "js-cookie"], (Dialog, Cookies) => {
    const DEFAULT_CONSTRAINTS = {
        size: 30,
        chars: "A-Za-z0-9!%^&*_$+-=;:@#~,./?"
    };

    /**
     * Generate a new password subject to constraints:
     * size: length of password
     * chars: characters legal in the password. Ranges can be defined
     * using A-Z syntax. - must be the last or first character for it
     * to be included. Inverted ranges are supported e.g. Z-A
     */
    function generatePassword(constraints) {
        if (!constraints)
            constraints = {};

        if (typeof constraints.length === 'undefined')
            constraints.length = 24;

        if (typeof constraints.charset === 'undefined')
            constraints.charset = "A-Za-z0-9";

        let cs = constraints.charset;
        const legal = [];
        while (cs.length > 0) {
            const sor = cs.charAt(0);
            if (cs.length >= 3 && cs.charAt(1) === '-') {
                const eor = cs.charAt(2);
                let sorc = sor.charCodeAt(0);
                let eorc = eor.charCodeAt(0);
                cs = cs.substring(3);
                if (sorc > eorc) {
                    const t = eorc; eorc = sorc; sorc = t;
                }
                while (sorc <= eorc) {
                    legal.push(String.fromCharCode(sorc++));
                }
            } else {
                legal.push(sor);
                cs = cs.substring(1);
            }
        }
        const array = new Uint8Array(constraints.length);
        if (typeof window !== 'undefined')
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

    function sameCons(a, b) {
        return a.size === b.size && a.chars === b.chars;
    }
    
    class RandomiseDialog extends Dialog {

        constraints_changed() {
            const cons = {
                size: parseInt(this.$control("len").val()),
                chars: this.$control("chs").val()
            };
            const memorable = !sameCons(cons, this.revert);
            this.$control("remember-label").toggle(memorable);
            this.$control("remember").toggle(memorable);

            // Revert to default
            this.$control("reset").toggle(
                !sameCons(cons, this.defaults));

            // Revert to starting condition, only if starting condition
            // if not default
            this.$control("revert").toggle(
                !sameCons(this.revert, this.defaults)
                && !sameCons(cons, this.revert));

            this.$control("again").trigger(Dialog.tapEvent());
        }

        initialise() {
            const self = this;
            
            this.defaults = DEFAULT_CONSTRAINTS;

            this.$control("again")
            .on(Dialog.tapEvent(), function () {
                self.$control("idea")
                .text(generatePassword({
                    length: self.$control("len").val(),
                    charset: self.$control("chs").val()
                }));
                return false;
            });
            
            this.$control("len")
            .on("change", function () {
                self.constraints_changed();
            });
            
            this.$control("chs")
            .on("change", function () {
                self.constraints_changed();
            });
            
            this.$control("reset")
            .on(Dialog.tapEvent(), function () {
                self.$control("len").val(this.defaults.size);
                self.$control("chs").val(this.defaults.chars);
                self.constraints_changed();
            });
            
            this.$control("revert")
            .on(Dialog.tapEvent(), function () {
                self.$control("len").val(self.revert.size);
                self.$control("chs").val(self.revert.chars);
                self.constraints_changed();
            });
        }

        ok() {
            const res = { text: this.$control("idea").text() };
            if (this.$control("remember").prop("checked")) {
                res.constraints = {
                    size: parseInt(this.$control("len").val()),
                    chars: this.$control("chs").val()
                };
            }
            return res;
        }
        
        open() {
            this.defaults = DEFAULT_CONSTRAINTS;
            const glob_cons = Cookies.get("ui_randomise");
            if (typeof glob_cons !== 'undefined') {
                try {
                    this.defaults = JSON.parse(glob_cons);
                } catch (e) {
                    if (this.debug) this.debug(e);
                }
            }
            this.revert = $.extend(
                {}, this.defaults, this.options.constraints);
                
            this.$control("len").val(this.revert.size);
            this.$control("chs").val(this.revert.chars);

            this.$control("key").text(this.options.key);
            this.$control("again").trigger(Dialog.tapEvent());
            this.$control("remember").hide();

            this.constraints_changed();
        }
    }
    return RandomiseDialog;
});
