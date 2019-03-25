/*@preserve Copyright (C) 2019 Crawford Currie http://c-dot.co.uk license MIT*/
/* eslint-env browser,node */

define(function() {
    /**
     * Store error. Generic vehicle for exceptions thrown by a store.
     */
    class Serror {
        /**
         * @param path String path where it failed,
         * @param status an HTTP status code describing the error
         * @param message optional message describing the error
         */
        constructor(path, status, message) {
            this.path = path;
            this.status = status;
            this.message = message;
        }

        toString() {
            return "status " + this.status + " " + this.path + " "
                + (this.message || "");
        }
    }

    return Serror;
});
