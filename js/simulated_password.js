/*@preserve Copyright (C) 2018 Crawford Currie http://c-dot.co.uk license MIT*/

/**
 * Simulated password widget, to overcome Firefox failures and add
 * a "show pass" checkbox
 */
(function ($) {
    "use strict";

    $.fn.simulated_password = function ( /*options*/ ) {
        $(this).each(function () {
            var $this = $(this);

            this.type = "text";
            var $showpass = $('<input type="checkbox" class="TX_title"/>');
            $this.after($showpass);
            $this.data("skip_pass_change", 0);
            $this.data("pass_hidden", true);
            $this.data("hidden_pass", "");

            function skip_next_change($this) {
                $this.data("skip_pass_change",
                    $this.data("skip_pass_change") + 1);
            }

            $showpass
                .on("click", function () {
                    if ($this.data("pass_hidden")) {
                        $this.val($this.data("hidden_pass"));
                        skip_next_change($this);
                        $this.data("pass_hidden", false);
                    } else {
                        $this.data("hidden_pass", $this.val());
                        skip_next_change($this);
                        $this.val($this.val().replace(/./g, "•"));
                        $this.data("pass_hidden", true);
                    }
                })
                .prop("checked", false);

            $this.on("input", function () {
                var v = $this.val();
                if ($this.data("pass_hidden")) {
                    var hp = $this.data("hidden_pass");
                    if (v.length > hp.length) {
                        var c = v.substring(v.length - 1);
                        $this.data("hidden_pass", hp + c);
                        skip_next_change($this);
                        $this.val(v.substring(0, v.length - 1) + "•");
                    } else {
                        $this.data(
                            "hidden_pass",
                            hp.substring(0, hp.length - (hp.length - v.length)));
                    }
                    return false;
                } else {
                    $this.data("hidden_pass", v);
                }
            });

            $this.on("change", function () {
                if ($this.data("skip_pass_change") > 0) {
                    $this.data("skip_pass_change",
                        $this.data("skip_pass_change") - 1);
                    return false;
                }
                $this.val($this.data("hidden_pass"));
                return true;
            });
        });
    };
})(jQuery);