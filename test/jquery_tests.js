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
        jsjq: "src/jquery"
    }
});

define(["src/Translator", "jquery", "jsjq/simulated_password", "jsjq/icon_button", "test/simulated_password", "jsjq/squirrel_dialog"], function(Translator) {

    let TX = Translator.instance({ url: "locale", debug: console.debug});

    function assert(v, m) {
        if (!v) {
            if (typeof m !== "undefined")
                throw "Assert failed: " + m;
            else
                throw "Assret failed";
        }
    }
    
    function simulated_password() {
        let res = $("#hidden_pw")
            .simulated_password()
            .on("change", function() {
                let info = $(this).val() + " (on change)";
                console.debug(info);
                $("#pw_val").text(info);
            })
            .on("input", function() {
                let info = $(this).val() + "(on input)";
                console.debug(info);
                $("#pw_val").text(info);
            });
        $("#password_reset").on("click", function() {
            $("#hidden_pw").val("reset");
            $("#pw_val").text($("#hidden_pw").val());
        });
    }      

    function icon_button() {
        $(".icon_button").icon_button();
    }

    function squirrel_dialog() {
        $.set_dialog_options({
            loadFrom: "dialogs",
            autoOpen: false,
            debug: console.debug
        });
        
        $("#test_dlg_open").on("click", () => {
            $.load_dialog("test").then(($dlg) => {
                $dlg.on('dlg-initialise', function() {
                    $dlg.find(".icon_button").icon_button();
                    TX.translate($dlg[0]);
                });
                $dlg.on('dlg-open', function() {
                    let $signin = $dlg.squirrel_dialog("control", "test_signin");
                    if ($signin.length === 0)
                        throw new Error("Control failed");
                    $signin.on("click", function() {
                        $dlg.squirrel_dialog("close");
                        assert($dlg.squirrel_dialog("control", "by_id").attr("id") === "by_id");
                        assert($dlg.squirrel_dialog("control", "by_name").attr("name") === "by_name");
                        assert($dlg.squirrel_dialog("control", "by_data_id").data("id") === "by_data_id");
                        console.debug("controls verified");
                    });
                });
                $dlg.squirrel_dialog("open");
            });
        });
    }
    
    return () => {
        // on ready
        TX.language("fr").then(() => {
            simulated_password();
            icon_button();
            squirrel_dialog();
        });
    };
});
