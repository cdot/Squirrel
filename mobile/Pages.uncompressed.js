/* Copyright (C) 2015 Crawford Currie http://c-dot.co.uk / MIT */

/**
 * Pages are defined by an id that is the id of a div with data-role=page
 * in the HTML.
 * When a page is needed, it is found using Page_get, which constructs a
 * subclass of Page for it. The subclass may have overrides for the
 * construct and open methods (the subclass methods do NOT need to
 * call the superclass, that's automatic)
 */
var Page_active = null;
var Pages = {};

/**
 * Change to a different page, with an optional follow-on function
 * invoked when the transition is complete.
 */
function Page_change(page_id, on_open) {
    "use strict";

    var lastpage = $("body").pagecontainer("getActivePage").attr("id");
    if (typeof(on_open) !== "undefined") {
        if (lastpage === page_id) {
            // pagecontainer will not fire a change event if the page
            // isn't actually changing
            on_open.call(this);
        } else {
            // Set up an event to call fn() when the transition is complete
            $("body").pagecontainer().on("pagecontainerchange", function () {
                $("body").pagecontainer().off("pagecontainerchange");
                on_open.call(this);
            });
        }
    }
    // else no follow-on function, simply fire the change

    $("body").pagecontainer("change", $("#" + page_id), {
        transition: "fade",
        changeHash: false
    });
};

/**
 * Get the singleton for a page, given it's id.
 * Construct the page as necessary.
 */
Page_get = function(id) {
    "use strict";

    if (!Pages[id])
        Pages[id] = {};

    if (!Pages[id].singleton) {
        window[id + "Page"] = function() {
            Page.call(this, id);
            if (typeof Pages[id].construct === "function")
                Pages[id].construct.call(this);
        };
        window[id + "Page"].prototype = Object.create(Page.prototype);
        Pages[id].singleton = new window[id + "Page"](id);
    }
    return Pages[id].singleton;
};

/**
 * Options may include handlers as follows:
 * on_cancel: called when the cancel button is clicked
 * on_ok: called when the ok button is clicked
 * on_close: called when the page is closed using the .close()
 * method. The close() action indicates that the page is finished
 * with (for now).
 * All handlers must return true to complete the action, or false
 * to abort it.
 */
function Page(id) {
    "use strict";

    this.id = id;

    var self = this;

    // Generic buttons

    self.control("close")
        .click(function() {
            if (typeof self.options.on_close === "function"
                && !self.options.on_close.call(self))
                return false; // abort the close
            self.close();
            if (typeof self.options.after_close === "function")
                self.options.after_close.call(self);
            return true;
        });

    self.control("cancel")
        .click(function () {
            if (typeof self.options.on_cancel === "function"
                && !self.options.on_cancel.call(self))
                return false; // abort the close
            self.close();
            if (typeof self.options.after_cancel === "function")
                self.options.after_cancel.call(self);
            return true;
        });

    self.control("ok")
        .click(function () {
            if (typeof self.options.on_ok === "function"
                && !self.options.on_ok.call(self))
                return false; // abort the close
            var aok = self.options.after_ok;
            self.close();
            if (typeof aok === "function") {
                aok.call(self);
            }
            return true;
        });
}

/**
 * Change to a page. Any of the Page handlers (on_close, on_cancel,
 * on_ok) can be overridden in the options. The additional on_open
 * handler will be called when the page is actually known to be open.
 */
Page.prototype.open = function(options) {
    if (!options)
        options = {};

    if (options.replace)
        console.debug("*** replace " +
                  + (Page_active !== null ? Page_active.id : "<no page>")
                  + " with " + this.id);
    else
        console.debug("*** open " + this.id + " over "
                  + (Page_active !== null ? Page_active.id : "<no page>"));

    if (options.replace && Page_active) {
        this.parent_page = Page_active.parent_page;
        if (typeof Page_active.options.on_close === "function")
            Page_active.options.on_close.call(Page_active);
        Page_active.parent_page = null;
        var ac = Page_active.options.after_close;
        Page_active.options = null;
        if (typeof ac === "function")
            ac.call(Page_active);
    } else
        this.parent_page = Page_active;

    if (typeof Pages[this.id].open === "function") {
        Pages[this.id].open.call(this, options);
    }

    this.options = options;
    Page_active = this;
    Page_change(this.id, options.on_open);
};

/**
 * Pop to the last visited page, with an optional pass-on function
 * invoked when the transition is complete
 */
Page.prototype.close = function() {
    "use strict";

    var new_page = this.parent_page;
    console.debug("*** close(" + this.id + ") to " + new_page.id);
    var closer = this.options.on_close;
    this.parent_page = null;
    Page_active = new_page;
    if (new_page)
        Page_change(new_page.id, closer);
};

/**
 * Shorthand to get a control on this page. For a page with
 * id="P", control("Q") is synonymous with $("#P_Q"). With no parameters,
 * returns the page DIV itself.
 */
Page.prototype.control = function(id) {
    "use strict";

    if (id)
        return $('#' + this.id + "_" + id);
    else
        return $('#' + this.id);
};

Pages.authenticated = {
    open: function(options) {
        $("#authenticated_whoami").text(Squirrel.client.store.user());
    }
};

