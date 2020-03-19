/*@preserve Copyright (C) 2018-2019 Crawford Currie http://c-dot.co.uk license MIT*/
/* eslint-env browser,jquery */

/**
 * Simulated password plugin, to overcome Firefox infinite loop and add
 * a "show pass" checkbox
 */
define("js/jq/simulated_password", ["jquery"], function() {

    const SPOT = "•";
    let debug; // global for all instances
    let selectionStart = 0, selectionEnd = 0, keyDown = -1;
    
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

        if (typeof dopts.debug === "function")
            debug = dopts.debug;
        
        $(this)
        .addClass("simulated_password")
        .each(function () {
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
                .on($.getTapEvent(), function () {
                    showPass($this, $this.hasClass("pass_hidden"));
                })
                .prop("checked", !options.hidden);
            }

            // Handle input rather than keydown, as it's more friendly to
            // mobile devices
            $this
            // Because selectionchange event doesn't get fired on firefox
            // (unknown reason) we instead trap paste and keydown events
            // so we know what the selection was (for overtyping) and also
            // what the keycode was
            .on("paste", function(/*e*/) {
                let el = document.activeElement;
                selectionStart = el.selectionStart;
                selectionEnd = el.selectionEnd;
                if (debug) debug("paste:", selectionStart,
                                 "-", selectionEnd);
                keyDown = -1;
            })
            .on("keydown", function(e) {
                // Because selectionchange event doesn't get
                // fired on firefox
                let el = document.activeElement;
                selectionStart = el.selectionStart;
                selectionEnd = el.selectionEnd;
                keyDown = e.keyCode; 
                if (debug) debug("keydown:", selectionStart,
                                 "-", selectionEnd, "key", keyDown);
            })
            .on("input", function (/*e*/) {
                let el = document.activeElement;
                if (debug) debug("input:", el.selectionStart,
                                 "selEnd:", el.selectionEnd);
                if ($this.hasClass("pass_hidden")) {
                    let cPos = getCursorPosition(self);
                    let hv = $this.data("hidden_pass");
                    let dv = $.fn.raw_val.call($this);
                    if (debug)
                        debug("at:", cPos, "actual:", hv, "displayed:", dv);

                    if (selectionStart !== selectionEnd) {
                        // A selection was typed (or pasted) over
                        hv = hv.substring(0, selectionStart)
                        + dv.substring(selectionStart, cPos)
                        + hv.substring(selectionEnd);
                        if (debug)
                            debug("sel cut:", selectionStart, selectionEnd,
                                  "actual:", hv, "at:", cPos);
                    }                    
                    else if (dv.length >= hv.length) {
                        // No select to replace, all hv chars retained
                        // Characters added before cPos
                        let count = (dv.length - hv.length);
                        hv = hv.substring(0, cPos - count)
                        + dv.substring(cPos - count, cPos)
                        + hv.substring(cPos - count);
                    }
                    else if (keyDown === 46){
                        if (debug) debug("delete");
                        hv = hv.substring(0, cPos) + hv.substring(cPos + 1);
                    }
                    else if (keyDown === 8) {
                        if (debug) debug("backspace");
                        hv = hv.substring(0, cPos) + hv.substring(cPos + 1);
                    }
                    else {
                        debugger; // WTF? input event raised but not in
                        // response to a key event...?
                    }
                    $this.data("hidden_pass", hv);
                    $.fn.raw_val.call($this, hv.replace(/./g, SPOT));
                    setCursorPosition(self, cPos);
                    if (debug) debug("final:", hv, "cursor", cPos)
                }
                return true;
            });

            showPass($this, !options.hidden);
        });
        return $(this);
    };
});
