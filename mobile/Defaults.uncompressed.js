(function($) {
    "use strict";
    $(document).on("mobileinit", function() {
        // See https://api.jquerymobile.com/global-config/
        $.mobile.ajaxEnabled = false;
        $.mobile.hasListeningEnabled = false;
        $.mobile.linkBindingEnabled = false;
        // Require call to $.mobile.initializePage
        //$.mobile.autoInitializePage = false;
        //console.debug("Load defaults");
    });
})(jQuery);
