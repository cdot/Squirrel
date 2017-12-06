/*@preserve Copyright (C) 2017 Crawford Currie http://c-dot.co.uk license MIT*/

jQuery(
    function() {
        $("button").each(function() {
            var $this = $(this);
            var opts;
            
            if (typeof $this.data("icon") !== "undefined") {
                var name = $this.data("icon");
                if (/squirrel/.test(name)) {
                    opts = {
                        icons: {
                            primary: name
                        },
                        classes: {
                            "ui-button-icon": "squirrel-icon"
                        },
                        text: false
                    };
                } else {
                    opts = {
                        icon: name,
                        text: false
                    }
                }
            }
            $this.button(opts);
        });
        $(".twisted").twisted();
        if (Cookies.get("ui_scale"))
            $("body").css("font-size", Cookies.get("ui_scale") + "px");
    }
);
