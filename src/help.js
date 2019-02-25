/*@preserve Copyright (C) 2017 Crawford Currie http://c-dot.co.uk license MIT*/

jQuery(
    function() {
        $("button").icon_button();
        $(".twisted").twisted();
        if (Cookies.get("ui_scale"))
            $("body").css("font-size", Cookies.get("ui_scale") + "px");
    }
);
