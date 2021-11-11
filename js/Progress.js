/*@preserve Copyright (C) 2021 Crawford Currie http://c-dot.co.uk license MIT*/
/* eslint-env browser */
define("js/Progress", () => {

	/**
	 * Interface to an object that accepts progress updates
	 */
	class Progress {
		/**
		 * Add a progress message.
		 * @param {object|object[]} mess {severity: string, message: string}
		 */
		push(mess) {}
	}

	return Progress;
});
