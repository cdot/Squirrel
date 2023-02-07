/*@preserve Copyright (C) 2015-2022 Crawford Currie http://c-dot.co.uk license MIT*/
/* eslint-env browser */

import "jquery/dist/jquery.js";
import "../jq/cookie.js";

const DEFAULT_CONSTRAINTS = {
  size: 30,
  chars: "A-Za-z0-9!%^&*_$+-=;:@#~,./?"
};

/**
 * Generate the sorted character set by parsing given constraints string.
 * The constraints string is an unsorted string of UTF-8. The only meta
 * is that A-Z expands to the letters, 0-9 to the numbers etc.
 * @return {string} string of legal chars
 */
function parseConstraintString(cs) {
  const legal = [];
  let n = 0;
  while (n < cs.length) {
    const sor = cs.charAt(n++);
    if (n + 2 < cs.length && cs.charAt(n) === "-") {
      n++;
      const eor = cs.charAt(n++);
      let sorc = sor.charCodeAt(0);
      let eorc = eor.charCodeAt(0);
      if (sorc > eorc) {
        const t = eorc; eorc = sorc; sorc = t;
      }
      while (sorc <= eorc)
        legal.push(String.fromCharCode(sorc++));
    } else
      legal.push(sor);
  }
  return legal.sort().join("");
}

/**
 * Shared functionality for dialogs that use constraints
 * @mixin ConstraintsMixin
 */
const ConstraintsMixin = (superclass) => class extends superclass {
  
  /**
   * Generate a new password subject to constraints
   * @param {object} constraints the constraints
   * @param {string} constraints.size the length to generate
   * @param {string} constraints.chars characters legal in the
   * password. Ranges can be defined using A-Z syntax. - must be the
   * last or first character for it to be included. Inverted ranges
   * are supported e.g. Z-A
   */
  generatePassword(constraints) {
    let cs = constraints.chars;
    const legal = parseConstraintString(cs);
    let s = "";
    while (s.length < constraints.size)
      s += legal.charAt(Math.floor(Math.random() * legal.length));
    return s;
  }

  /**
   * Determine if two constraints strings generate the same
   * character set.
   */
  sameConstraints(a, b) {
    return a.size === b.size
    && parseConstraintString(a.chars) === parseConstraintString(b.chars);
  }
  
  /**
   * Get the default constraints for password generation
   * @return {object} object with size: and chars:
   */
  get defaultConstraints() {
    const glob_cons = $.cookie("ui_randomise");
    if (typeof glob_cons !== 'undefined')
      return JSON.parse(glob_cons);
    return DEFAULT_CONSTRAINTS;
  }

  /**
   * Set the default constraints for password generation
   * @param {object} constraints the constraints
   * @param {string} constraints.size the length to generate
   * @param {string} constraints.chars characters legal in the
   * password. Ranges can be defined using A-Z syntax. - must be the
   * last or first character for it to be included. Inverted ranges
   * are supported e.g. Z-A
   */
  set defaultConstraints(constraints) {
    $.cookie("ui_randomise", JSON.stringify(constraints));
  }
};

export { ConstraintsMixin }
