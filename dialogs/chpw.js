/**
 * Encryption password change dialog
 */
define(["dialogs/Dialog"], function(Dialog) {
    class ChangePasswordDialog extends Dialog {
        samePass() {
            let p = this.control("pass").val(),
                c = this.control("conf").val();
            this.control("nomatch")
                .toggle(p !== c);
            return (p === c);
        }

        initialise() {
            let self = this;
            
            this.control("show")
                .on("change", function () {
                    if (this.control("show")
                        .prop("checked")) {
                        this.control("pass")
                            .attr("type", "text");
                        this.control("conf")
                            .attr("type", "text");
                    } else {
                        this.control("pass")
                            .attr("type", "password");
                        this.control("conf")
                            .attr("type", "password");
                    }
                });

            this.control("conf")
                .on("change", function () {
                   self.samePass();
                });

            this.control("set")
                .on(this.tapEvent(), function () {
                    if (!self.samePass())
                        return false;
                    this.close();
                    let p = this.control("pass").val();
                    let app = this.app();
                    app.client
                        .store.option("pass", p);
                    app.client.status = app.NEW_SETTINGS;
                    app.cloud
                        .store.option("pass", p);
                    app.cloud.status = app.NEW_SETTINGS;
                    app.trigger("update_save");

                    return true;
                });
        }

        open() {
            this.samePass();
        }
    }
    return ChangePasswordDialog;
});
      
