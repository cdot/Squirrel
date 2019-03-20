/*@preserve Copyright (C) 2018-2019 Crawford Currie http://c-dot.co.uk license MIT*/
/* eslint-env browser */

/**
 * Simulated password plugin, to overcome Firefox infinite loop and add
 * a "show pass" checkbox
 */
define(["jquery"], function() {

    const SPOT = "•";

    function getCursorPosition(input) {
        if ('selectionStart' in input) {
            // Standards-compliant browsers
            return input.selectionStart;
        } else if (document.selection) {
            // IE
            input.focus();
            let sel = document.selection.createRange();
            let selLen = document.selection.createRange().text.length;
            sel.moveStart('character', -input.value.length);
            return sel.text.length - selLen;
        }
    }

    function setCursorPosition(input, pos) {
        if ('setSelectionRange' in input) {
            input.setSelectionRange(pos, pos);
        } else if ('createTextRange' in input) {
            let range = input.createTextRange();
            range.collapse(true);
            range.moveEnd('character', pos);
            range.moveStart('character', pos);
            range.select();
        }
    }

    /**
     * Switch between shown/not shown
     * @param el DOM element
     * @param show boolean whther to show or not
     */
    function showPass(el, show) {
        let $this = $(el);
        let isHidden = $this.hasClass("pass_hidden");
        if (show && isHidden) {
            $.fn.raw_val.call($this, $this.data("hidden_pass"));
            $this.removeClass("pass_hidden");
        } else if (!show && !isHidden) {
            let dv = $.fn.raw_val.call($this);
            $this.data("hidden_pass", dv);
            if (typeof dv === "string") {
                let hv = dv.replace(/./g, SPOT)
                $.fn.raw_val.call($this, hv);
            }
            $this.addClass("pass_hidden");
        }
    }

    // Require an unload handler on FF (and maybe others) to revert the
    // password field to the hidden value. Otherwise the browser caches
    // the display dots.
    $(window).on("unload", function() {
        $("input.pass_hidden").each(function() {
            showPass(this, true);
        });
    });

    // Override global val() to handle this plugin
    $.fn.raw_val = $.fn.val;

    $.fn.val = function() {
        let $this = $(this);
        if (!$this.hasClass("pass_hidden"))
            return $.fn.raw_val.apply($this, arguments);
        if (arguments.length >= 1) {
            // Set value
            let dv = arguments[0];
            $this.data("hidden_pass", dv);
            let hv = dv.replace(/./g, SPOT)
            $.fn.raw_val.call($this, hv);
        }
        return $this.data("hidden_pass");
    };

    /**
     * options.hidden: false to show the pass initially (default true)
     * options.checkbox: false to hide checkbox (default true)
     */
    $.fn.simulated_password = function (dopts) {
        dopts = dopts || {};

        $(this).each(function () {
            let self = this;
            let $this = $(this);
            let options = $.extend([], dopts);

            if (typeof $(this).data("options") !== "undefined")
                $.extend(options, $(this).data("options"));

            if (typeof options.checkbox === "undefined")
                options.checkbox = true;
            if (typeof options.hidden === "undefined")
                options.hidden = true;

            if (this.type === "password")
                this.type = "text"; // because Firefox screws up "password"

            if (options.checkbox) {
                // Add a show/no show checkbox
                let $showpass = $('<input type="checkbox"/>');
                $this.after($showpass);
                $showpass
                .on($.getTapEvent ? $.getTapEvent() : "click", function () {
                    showPass($this, $this.hasClass("pass_hidden"));
                })
                .prop("checked", !options.hidden);
            }

            // Handle input rather than keydown, as it's more friendly to
            // mobile devices
            $this.on("input", function (e) {
                //console.log("widget.input");
                if ($this.hasClass("pass_hidden")) {
                    let cPos = getCursorPosition(self);
                    let hv = $this.data("hidden_pass");
                    let dv = $.fn.raw_val.call($this);
                    if (dv.length > hv.length) {
                        // Character added
                        hv = hv.substring(0, cPos - 1) +
                        dv.substring(cPos - 1, cPos) +
                        hv.substring(cPos - 1);
                        $this.data("hidden_pass", hv);
                        $.fn.raw_val.call($this, hv.replace(/./g, SPOT));
                        setCursorPosition(self, cPos);
                    } else {
                        // Could be a forward delete or a
                        // backspace. Some browsers may help.
                        //console.log(e.keyCode);
                        if (e.originalEvent
                            && e.originalEvent.inputType === "deleteContentForward") {
                            // Chrome. Deleted character is the one
                            // *after* cPos
                            hv = hv.substring(0, cPos) + hv.substring(cPos + 1);
                        } else {
                            // Otherwise treat as a backspace. This is
                            // the most likely; and anyone editing
                            // within a hidden password is asking for
                            // trouble anyway.
                            hv = hv.substring(0, cPos) + hv.substring(cPos + 1);
                        }
                        $this.data("hidden_pass", hv);
                    }
                }
                return true;
            });

            showPass($this, !options.hidden);
        });
        return $(this);
    };
});
