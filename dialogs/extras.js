define(function() {
    return function($dlg) {
        $dlg.on('dlg-initialise', function () {
            $dlg.squirrel_dialog("control", "theme")
                .on("selectmenuchange", function () {
                    $dlg.squirrel_dialog("squirrel").theme($(this)
                                                           .val());
                })
                .selectmenu();

            $dlg.squirrel_dialog("control", "autosave")
                .on("change", function () {
                    $dlg.squirrel_dialog("squirrel").autosave($(this)
                                                              .prop("checked"));
                });

            $dlg.squirrel_dialog("control", "hidevalues")
                .on("change", function () {
                    Tree.hidingValues = $(this).prop("checked");
                });

            $dlg.squirrel_dialog("control", "chpw")
                .on($.getTapEvent(), function () {
                    $dlg.squirrel_dialog("close");
                    $.load_dialog("chpw").then(($dlg) => {
                        $dlg.squirrel_dialog("open");
                    });
                });

            $dlg.squirrel_dialog("control", "chss")
                .on($.getTapEvent(), function () {
                    $dlg.squirrel_dialog("close");
                    $.load_dialog("store_settings").then(($dlg) => {
                        $dlg.squirrel_dialog("open");
                    });
                });

            $dlg.squirrel_dialog("control", "theme")
                .on($.getTapEvent(), function () {
                    $dlg.squirrel_dialog("close");
                    $.load_dialog("theme").then(($dlg) => {
                        $dlg.squirrel_dialog("open");
                    });
                });

            $dlg.squirrel_dialog("control", "json")
                .on($.getTapEvent(), function () {
                    $dlg.squirrel_dialog("close");
                    $.load_dialog("json").then(($dlg) => {
                        $dlg.squirrel_dialog("open");
                    });
                });

            $dlg.squirrel_dialog("control", "optimise")
                .on($.getTapEvent(), function () {
                    $dlg.squirrel_dialog("close");
                    $.load_dialog("optimise").then(($dlg) => {
                        $dlg.squirrel_dialog("open");
                    });
                });

            $dlg.squirrel_dialog("control", "bigger")
                .on("click", function () {
                    $dlg.squirrel_dialog("squirrel").zoom(1.25);
                });

            $dlg.squirrel_dialog("control", "smaller")
                .on("click", function () {
                    $dlg.squirrel_dialog("squirrel").zoom(0.8);
                });

            $dlg.squirrel_dialog("control", "about")
                .on($.getTapEvent(), function () {
                    $dlg.squirrel_dialog("close");
                    $.load_dialog("about").then(($dlg) => {
                        $dlg.squirrel_dialog("open");
                    });
                });

            $dlg.squirrel_dialog("control", "language")
                .on("change", function () {
                    let fresh = $dlg.squirrel_dialog("control", "language").val();
                    let stale = TX.language(fresh);
                    if (fresh !== stale)
                        // Re-translate for new language
                        TX.init();
                });
        });

        $dlg.on('dlg-open', function () {
            if (!($dlg.squirrel_dialog("squirrel").USE_STEGANOGRAPHY ||
                  $dlg.squirrel_dialog("squirrel").cloud
                  .store &&
                  $dlg.squirrel_dialog("squirrel").cloud
                  .store.option("needs_path"))) {
                $dlg.squirrel_dialog("control", "chss")
                    .hide();
            }

            $dlg.squirrel_dialog("control", "autosave")
                .prop("checked", $dlg.squirrel_dialog("squirrel").autosave());

            $dlg.squirrel_dialog("control", "hidevalues")
                .prop("checked", Tree.hidingValues);

            $dlg.squirrel_dialog("control", "theme")
                .find("option:selected")
                .prop("selected", false);
            $dlg.squirrel_dialog("control", "theme")
                .find("option[value='" + $dlg.squirrel_dialog("squirrel").theme() + "']")
                .prop("selected", true);

            TX.language().then((lingo) => {
                $dlg.squirrel_dialog("control", "language")
                    .val(lingo);
            });

        });
    }
});
