// Store engine for encrypted data. Uses an underlying engine to actually
// store the encrypted data. Each user's data is encrypted using their unique
// password. Note that keys are *not* encyrpted.

function EncryptedStore(engine) {
    "use strict";

    AbstractStore.call(this);
    this.engine = engine;
}

EncryptedStore.prototype = Object.create(AbstractStore.prototype);

EncryptedStore.prototype.register = function(user, pass, ok, fail) {
    "use strict";

    var self = this,
    xpass = Aes.Ctr.encrypt(pass, pass, 256);
    this.engine.register(
        user,
        xpass,
        function() {
            self.user = user;
            self.pass = pass;
            ok.call(self);
        }, fail);
};

EncryptedStore.prototype.log_in = function(user, pass, ok, fail) {
    "use strict";

    var self = this;
    this.engine._read(
        function() {
            var xpass = Aes.Ctr.decrypt(this.engine.pass, pass, 256);
            if (xpass === pass) {
                self.user = user;
                self.pass = pass;
                try {
                    self.data = JSON.parse(
                        Aes.Ctr.decrypt(self.engine.data, pass, 256));
                    ok.call(self);
                } catch (e) {
                    fail.call(self, e);
                }
            } else {
                fail.call(self, "Incorrect details");
            }
        },
        fail);
};

EncryptedStore.prototype.log_out = function() {
    "use strict";

    this.engine.log_out();
    this.user = null;
    this.pass = null;
    this.data = null;
};

EncryptedStore.prototype.save = function(ok, fail) {
    "use strict";

    this.engine.data = Aes.Ctr.encrypt(this.data, this.pass, 256);
    this.engine.save(ok, fail);
};


