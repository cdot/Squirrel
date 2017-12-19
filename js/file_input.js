/*@preserve Copyright (C) 2015 Crawford Currie http://c-dot.co.uk license MIT*/

/**
 * A wrapper widget for a file input that replaces it with a button that
 * uses the input's title attribute for its label
 */
(function($) {
    "use strict";
    $.widget("squirrel.file_input", {
        _create: function() {

            var $self = $(this.element)
                .wrap($(document.createElement("div"))
                      /*.css("position", "relative")
                        .css("display", "inline-block")*/);
            $self.hide();
            $self.parent().append(
                $(document.createElement("button"))
                    .iconbutton({
                        label: $self.attr("title")
                    })
                    .on($.getTapEvent(), function(evt) {
                        $self.trigger(evt);
                    }));
        }
    });
})(jQuery);
