Squirrel.Dialog = {
    squeak: function(p) {
        if (typeof p === "string") {
            p = {
                message: p
            };
        } else if (p.after_close) {
            p.after_close = function() {
                    Utils.soon(p.after_close);
            }
        }
        Page_get("activity").open(p);
    },
    squeak_more: function(mess) {
        $("#activity_message").append(mess);
    },
    close_squeak: function() {
        // change page....
    },
    store_settings: function(next) {
        Page_get("store_settings").open(
            {
                on_close: function() {
                    next();
                    return true;
                }
            });
    },
    login: function(p) {
        p.replace = true;
        Page_get("login").open(p);
    },

    alarm: function(p) {
        Page_get("alarm").open(p);
    }
};
