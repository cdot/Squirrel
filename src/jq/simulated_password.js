/*@preserve Copyright (C) 2018-2023 Crawford Currie http://c-dot.co.uk license MIT*/
/* eslint-env browser,jquery */

import "jquery";

/**
 * Simulated password jQuery plugin, fixes `input type="password".
 * Sits over an `input` tag to overcome Firefox infinite loop and add
 * a "show pass" checkbox.
 * ```
 * $("input[type='password']").simulated_password();
 * ```
 * @namespace $.simulated_password
 */
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
    const sel = document.selection.createRange();
    const selLen = document.selection.createRange().text.length;
    sel.moveStart('character', -input.value.length);
    return sel.text.length - selLen;
  } else
		return -1;
}

function setCursorPosition(input, pos) {
  if ('setSelectionRange' in input) {
    input.setSelectionRange(pos, pos);
  } else if ('createTextRange' in input) {
    const range = input.createTextRange();
    range.collapse(true);
    range.moveEnd('character', pos);
    range.moveStart('character', pos);
    range.select();
  }
}

/**
 * Switch password between clear/hidden
 * @param {Element} el input element
 * @param {boolean} show true to show
 */
function showPass(el, show) {
  const $this = $(el);
  const isHidden = $this.hasClass("pass_hidden");
  if (show && isHidden) {
    $.fn.raw_val.call($this, $this.data("hidden_pass"));
    $this.removeClass("pass_hidden");
  } else if (!show && !isHidden) {
    const dv = $.fn.raw_val.call($this);
    $this.data("hidden_pass", dv);
    if (typeof dv === 'string') {
      const hv = dv.replace(/./g, SPOT);
      $.fn.raw_val.call($this, hv);
    }
    $this.addClass("pass_hidden");
  }
	const $showpass = $this.next();
	if (show) {
		$showpass.addClass("squirrel-icon-eye-open");
		$showpass.removeClass("squirrel-icon-eye-closed");
	} else {
		$showpass.removeClass("squirrel-icon-eye-open");
		$showpass.addClass("squirrel-icon-eye-closed");
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
  const $this = $(this);
  if (!$this.hasClass("pass_hidden"))
    return $.fn.raw_val.apply($this, arguments);
  if (arguments.length >= 1) {
    // Set value
    let dv = arguments[0];
    $this.data("hidden_pass", dv);
    const hv = dv.replace(/./g, SPOT);
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

  if (typeof dopts.debug === 'function')
    debug = dopts.debug;
  
  $(this)
  .addClass("simulated_password")
  .each(function () {
    const self = this;
    const $input = $(this);
    const options = $.extend([], dopts);

    if (typeof $(this).data("options") !== 'undefined')
      $.extend(options, $(this).data("options"));

    if (typeof options.checkbox === 'undefined')
      options.checkbox = true;
    if (typeof options.hidden === 'undefined')
      options.hidden = true;

    if (this.type === "password")
      this.type = "text"; // because Firefox screws up "password"

    if (options.checkbox) {
      // Add a show/no show checkbox
      const $showpass = $('<span></span>')
					  .addClass("ui-icon squirrel-icon");
      $input.after($showpass);

      $showpass
      .on("click", function () {
        showPass($input, $input.hasClass("pass_hidden"));
      });

			showPass($input, !options.hidden);
    }

    // Handle input rather than keydown, as it's more friendly to
    // mobile devices
    $input

    // Because selectionchange event doesn't get fired on firefox
    // (unknown reason) we instead trap paste and keydown events
    // so we know what the selection was (for overtyping) and also
    // what the keycode was
    .on("paste", function(/*e*/) {
      const el = document.activeElement;
      selectionStart = el.selectionStart;
      selectionEnd = el.selectionEnd;
      if (debug) debug("paste:", selectionStart,
                       "-", selectionEnd);
      keyDown = -1;
    })

    .on("keydown", function(e) {
      // Because selectionchange event doesn't get
      // fired on firefox
      const el = document.activeElement;
      selectionStart = el.selectionStart;
      selectionEnd = el.selectionEnd;
      keyDown = e.keyCode; 
      if (debug) debug("keydown:", selectionStart,
                       "-", selectionEnd, "key", keyDown);
    })

    .on("input", function (/*e*/) {
      const el = document.activeElement;
      if (debug) debug("input:", el.selectionStart,
                       "selEnd:", el.selectionEnd);
      if ($input.hasClass("pass_hidden")) {
        const cPos = getCursorPosition(self);
        let hv = $input.data("hidden_pass");
        const dv = $.fn.raw_val.call($input);
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
          const count = (dv.length - hv.length);
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
        $input.data("hidden_pass", hv);
        $.fn.raw_val.call($input, hv.replace(/./g, SPOT));
        setCursorPosition(self, cPos);
        if (debug) debug("final:", hv, "cursor", cPos)
      }
      return true;
    });

    showPass($input, !options.hidden);
  });
  return $(this);
};
