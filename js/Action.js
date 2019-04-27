/*@preserve Copyright (C) 2015-2019 Crawford Currie http://c-dot.co.uk license MIT*/
/* eslint-env browser,node */

define("js/Action", ["js/Translator"], function(Translator) {
    
    class Action {
        
        /**
         * Construct a new action object.
         * @param proto an action structure to clone, or a simple object with
         * type, path, time and data fields.
         */
        constructor(proto) {
            this.type = proto.type;
            this.path = proto.path.slice();
            this.time = proto.time ? proto.time : Date.now();

            if (typeof proto.data !== "undefined")
                this.data = proto.data;
        }

        /**
         * Generate a terse string version of the action for reporting
         * @param action action to report on
         * @return {string} human readable description of action
         */
        toString() {
            return this.type + ":" +
            this.path.join("↘") +
            (typeof this.data !== "undefined" ?
             (" '" + this.data + "'") : "") +
            " @" + new Date(this.time)
            .toLocaleString();
        }
    }
    
    return Action;
});

