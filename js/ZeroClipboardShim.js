/*@preserve Copyright (C) 2017 Crawford Currie http://c-dot.co.uk license MIT*/

/* eslint-env jquery */

/* global DEBUG:true */
/* global ZeroClipboard */

function ZeroClipboardShim() {
    "use strict";
    var self = this;

    this.ready = false;
    this.queue = [];
    this.clipboards = [];
    
    if (typeof ZeroClipboard === "undefined" ||
        ZeroClipboard.isFlashUnusable()) {
        if (DEBUG) console.debug("ZeroClipboard is unusable");
        this.ready = false;
        return;
    }

    if (DEBUG) console.debug("Initialising ZeroClipboard");

    // Create dummy element to force initialisation of ZeroClipboard
    this.$zc_dummy = $("<div></div>");
    $("body").append(this.$zc_dummy);

    ZeroClipboard.config({
        debug: DEBUG
    });

    // We won't get a "ready" event until at leat one ZeroClipboard
    // has been instantiated, but we want to start the creation process
    // as early as possible. So we create a dummy element to trigger
    // the process.
    ZeroClipboard.on("ready", function(e) {      
        self.ready = true;
        while (self.queue.length) {
            self.addClipboard(self.queue.pop());
        }
        // Destroy the dummy event we created to get "ready" called
        // Can't do that, it kills ZC
        // ZeroClipboard.destroy(self.$zc_dummy);
        // self.$zc_dummy.remove();
    });
    
    ZeroClipboard.on("error", function(e) {
        if (e.name === "flash-deactivated" ||
            e.name === "flash-disabled" ||
            e.name === "swf-not-found" ||
            e.name === "browser-unsupported") {
            for (var i = 0; i < self.clipboards.length; i++)
                self.clipboards[i].destroy();
            if (DEBUG) console.log("ZeroClipboard disabled: " + e.name)
            self.ready = false;
        } else if (DEBUG) console.log("ZeroClipboard warning: " + e.name)
    });

    // Construct the dummy element to kick off the "ready" event
    this.clipboards.push(new ZeroClipboard(this.$zc_dummy));
}

ZeroClipboardShim.prototype.addClipboard = function(opts) {

    if (this.ready) {
        var $item = $(opts.selector);
        if ($item.length === 0)
            return;
        
        var self = this;
        var handler = opts.handler;
        
        var zc = new ZeroClipboard($item);
        
        // Handle the "copy" event that comes from
        // the Flash movie and populate the event with our data
        zc.on("copy", function(event) {
            // The receiving object here is the menu item
            var clip = handler();
            event.clipboardData.setData(clip.contentType, clip.data);
        });

        this.clipboards.push(zc); // remember in case we need to destroy

        if (DEBUG) console.debug("Attached ZC handler to " + opts.selector);
    } else {
        this.queue.push(opts);
    }
};
