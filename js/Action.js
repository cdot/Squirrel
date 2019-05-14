/*@preserve Copyright (C) 2015-2019 Crawford Currie http://c-dot.co.uk license MIT*/
/* eslint-env browser,node */

define("js/Action", ["js/Translator"], function(Translator) {
    let TX = Translator.instance();

    class Action {
        
        /**
         * Construct a new action object.
         * @param proto an action structure to clone, or a simple object with
         * type, path, time and data fields.
         */
        constructor(proto) {
            this.type = proto.type;
            if (typeof proto.path !== "undefined")
                this.path = proto.path.slice();
            this.time = proto.time ? proto.time : Date.now();

            if (typeof proto.data !== "undefined")
                this.data = proto.data;
        }

        /**
         * Generate a florid description of the action for using in dialogs
         * @return {string} human readable description of action
         */
        verbose() {
            let p = this.path.join("↘");
            let s;
            switch (this.type) {
            case "A":
                s = TX.tx("Add reminder on $1$2 to $3",
                          new Date(this.data.due).toLocaleString(),
                          (this.data.repeat === 0)
                              ? ""
                              : TX.tx(" (repeat every $1)",
                                  TX.deltaTimeString(0, this.data.repeat)),
                          p);
                break;
            case "C":
                s = TX.tx("Cancel reminder on $1", p);
                break;
            case "D":
                s = TX.tx("Delete $1", p);
                break;
            case "E":
                s = TX.tx("Change value of $1 to '$2'", p, this.data);
                break;
            case "I":
                s = TX.tx("Insert $1 = $2", p, p.data);
                break;
            case "M":
                s = TX.tx("Move $1 to $2", p, this.data.join("↘"));
                break;
            case "N":
                s = TX.tx("Create $1", p);
                break;
            case "R":
                s = TX.tx("Rename $1 to '$2'", p, this.data);
                break;
            case "X":
                s = TX.tx("Constrain $1 to $2 character$?($2=1,,s) from $3",
                          p, this.data.size, this.data.chars);
                break;
            }
            return s;
        }
        
        /**
         * Generate a terse string version of the action for reporting
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

