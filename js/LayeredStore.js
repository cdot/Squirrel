/*@preserve Copyright (C) 2015 Crawford Currie http://c-dot.co.uk license MIT*/

/* global AbstractStore: true */

if (typeof module !== "undefined")
    AbstractStore = require('AbstractStore');

/**
 * @class
 * A LayeredStore is an AbstractStore where actual store services are provided
 * by another underlying AbstractStore. A LayeredStore is used where data to
 * be stored/read is to be preprocessed, for example through encryption.
 * To the AbstractStore constructor params options we add the 'understore'
 * option (required) which must be a function that will construct
 * the underlying store to be used as the engine, using parameters passed
 * down.
 */
function LayeredStore(params) {
    "use strict";

    var self = this,
        pok = params.ok;

    // Override the OK function
    params.ok = function () {
        // 'this' is the engine.
        // Don't call AbstractStore(), it doesn't do anything useful
        // for us - we don't want to call params.ok for this layer,
        // only in the understore.
        self.engine = this;
        pok.call(self);
    };

    // We don't use the return value from the understore factory, instead
    // we set self.engine in the ok function, above.
    params.understore(params);
}

LayeredStore.prototype = Object.create(AbstractStore.prototype);

LayeredStore.prototype.options = function () {
    "use strict";

    return this.engine.options();
};

LayeredStore.prototype.user = function (u) {
    "use strict";

    return this.engine.user(u);
};

LayeredStore.prototype.pass = function (pw) {
    "use strict";

    return this.engine.pass(pw);
};

if (typeof module !== "undefined")
    module.exports = LayeredStore;