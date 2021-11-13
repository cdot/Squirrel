/*@preserve Copyright (C) 2019 Crawford Currie http://c-dot.co.uk license MIT*/
/* eslint-env browser,node */

define("js/Serror", function() {
    
    /**
     * Squirrel error. Generic vehicle for errors that have a status code
     * and optional path information.
	 * @extends Error
     */
    class Serror extends Error {
        /**
         * @param {number} [status=400] HTTP status code describing the error
         * @param {string=} path path array where it failed,
         * @param {string} message is passed to the Error constructor
         * (filename and line number not supported)
         */
        constructor(...rest) {
            let status = 400, path;
            if (rest.length > 0 && typeof rest[0] === "number")
                status = rest.shift();
            if (rest.length > 1)
                path = rest.shift();
            super(...rest);
            this.status = status;
            this.path = path;
                        
            // Maintains proper stack trace for where our error
            // was thrown (only available on V8)
            if (Error.captureStackTrace) {
                Error.captureStackTrace(this, Serror);
            }
        }

        /**
         * Classic assert
		 * @param {boolean} cond condition to assert result
		 * @param {string} message failed message
         */
        static assert(cond, message) {
            if (cond) return;
            if (typeof message === "undefined")
                message = "Assertion failed";
            throw new Error(message);
        }
        
        toString() {
            return this.status
            + (this.path ? ` ${this.path.join("/")}` : "")
            + (this.message ? ` ${this.message}` : "");
        }
    }

    return Serror;
});
