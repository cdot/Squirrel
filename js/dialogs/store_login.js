/*@preserve Copyright (C) 2022 Crawford Currie http://c-dot.co.uk license MIT*/
/* eslint-env browser */

define([
	"js/dialogs/LoginDialog"
], LoginDialog => {

	/**
	 * Store login dialog. This is just an alias for a shared LoginDialog.
	 */
  class StoreLoginDialog extends LoginDialog {
  }

  return StoreLoginDialog;
});
