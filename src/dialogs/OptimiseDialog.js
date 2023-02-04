/*@preserve Copyright (C) 2019-2023 Crawford Currie http://c-dot.co.uk license MIT*/
/* eslint-env browser */

/**
 * Store optimisiation control dialog
 */
import { AlertDialog } from "./AlertDialog.js";

import "../jq/template.js";

class OptimiseDialog extends AlertDialog {

  initialise() {
    this.$control("existing").template();
    this.$control("study").template();
  }

  onOK() {
    return this.options.optimise();
  }
  
  onOpened() {
    super.onOpened();

    this.$control("study").hide();
    this.$control("calculating")
    .show()
    .toggle("pulsate", 101);

    const analysis = this.options.analyse();
    
    this.$control("existing").template("expand", analysis.cloud);

    this.$control("calculating").hide();
    this.$control("study")
    .template(
      "expand",
      analysis.N, analysis.A, analysis.X,
      analysis.N + analysis.A + analysis.X)
    .show();
    if (analysis.N + analysis.A + analysis.X >= analysis.cloud)
      this.push($.i18n("dont_opt"));
  }
}

export { OptimiseDialog }
