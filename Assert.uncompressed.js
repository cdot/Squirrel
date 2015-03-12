// Used in testing only
function assert(t, e) {
    "use strict";

    if (!t) {
        if (!e)
            e = "Assert failed";
        console.debug(e);
        debugger;
    }
}
