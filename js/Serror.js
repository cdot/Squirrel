/*@preserve Copyright (C) 2019 Crawford Currie http://c-dot.co.uk license MIT*/
/* eslint-env browser,node */

define("js/Serror", function() {
    
    /**
     * Squirrel error. Generic vehicle for errors that have a status code
     * and optional path information.
     */
    class Serror extends Error {
        /**
         * @param status an optional HTTP status code describing the error
         * (defaults to 400)
         * @param path optional path array where it failed,
         * @param message is passed to the Error constructor
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
         */
        static assert(cond, message) {
            if (cond) return;
            if (typeof message === "undefined")
                message = "Assertion failed";
            throw new Error(message);
        }
        
        toString() {
            return this.status
            + (this.path ? " " + this.path.join("/") : "")
            + (this.message ? " " + this.message : "");
        }
    }

    return Serror;
});
