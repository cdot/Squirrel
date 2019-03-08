/*@preserve Copyright (C) 2019 Crawford Currie http://c-dot.co.uk license MIT*/

if (typeof requirejs === "undefined")
    throw new Error(__filename + " is not runnable stand-alone");

/**
 * Support for jquery_tests HTML page
 */
requirejs.config({
    baseUrl: "..",
    urlArgs: "nocache=" + Date.now(),
    paths: {
        mocha: "//cdnjs.cloudflare.com/ajax/libs/mocha/6.0.2/mocha",
        chai: "//cdnjs.cloudflare.com/ajax/libs/chai/4.2.0/chai",
        jquery: "//code.jquery.com/jquery-3.3.1",
        "jquery-ui": "//cdnjs.cloudflare.com/ajax/libs/jqueryui/1.12.1/jquery-ui",
        js: "src",
        jsjq: "src/jquery",
        dialogs: "dialogs",
        images: "images"
    }
});

define(["js/Translator", "jquery", "jsjq/simulated_password", "jsjq/icon_button", "jsjq/squirrel_dialog"], function(Translator) {

    let list = [
        "about",
        "chpw",
        "insert",
        "optimise",
        "store_login",
        "add",
        "delete",
        "json",
        "pick",
        "store_settings",
        "alarm",
        "extras",
        "network_login",
        "randomise"
    ];
    
    $.set_dialog_options({
        loadFrom: "../dialogs",
        autoOpen: false,
        debug: console.debug
    });

    return () => {
        Translator.instance({ url: "locale" }).language("en");
        for (let i in list) {
            let name = list[i];
            let $button = $("<button>" + name + " </button>");
            $button.on("click", () => {
                $.load_dialog(name).then(($dlg) => {
                    $dlg.squirrel_dialog("open");
                });
            });
            $("#buttons").append($button);
        }
    };
});
