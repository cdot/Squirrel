define(function() {
    return function($dlg) {
        $dlg.on('dlg-initialise', function () {
            let $dlg = $(this);
            $dlg.squirrel_dialog("control", "clear")
                .on($.getTapEvent(), function () {
                    $dlg.find(".dlg-picked")
                        .removeClass("dlg-picked");
                });
        });

        $dlg.on('dlg-open', function () {
            let $node = $dlg.data("node");
            let val = $node.data("value");
            let $which = $dlg.squirrel_dialog("control", "which");
            let $from = $dlg.squirrel_dialog("control", "from");
            let i, $f;

            $dlg.find(".dlg-pick-cell")
                .remove();

            let item_clicked = function () {
                let ii = $(this)
                    .data("i");
                $dlg
                    .find("td.i" + ii)
                    .addClass("dlg-picked");
            };

            for (i = 0; i < val.length; i++) {
                $f = $from.children("td.i" + i);
                if ($f.length === 0) {
                    $(document.createElement("td"))
                        .data("i", i)
                        .addClass("dlg-pick-cell i" + i)
                        .text(i + 1)
                        .on($.getTapEvent(), item_clicked)
                        .appendTo($which);
                    $f = $(document.createElement("td"))
                        .data("i", i)
                        .addClass("dlg-pick-cell i" + i)
                        .on($.getTapEvent(), item_clicked)
                        .appendTo($from);
                }
                $f.text(val.charAt(i));
            }

            while (i < $from.children("td")
                   .length) {
                $from.children("td")
                    .last()
                    .remove();
                i++;
            }

            $dlg.find(".dlg-picked")
                .removeClass("dlg-picked");
        });
    }
});
