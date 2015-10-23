/* Copyright (C) 2015 Crawford Currie http://c-dot.co.uk / MIT */

/**
 * A wrapper widget for a file input that replaces it with a button that
 * uses the input's title attribute for its label
 */
(function($) {
    "use strict";
    $.widget("squirrel.file_input", {
        _create: function() {

            var $self = $(this.element)
                .wrap($("<div></div>")
                      /*.css("position", "relative")
                        .css("display", "inline-block")*/);
            $self.hide();
            $self.parent().append(
                $("<button></button>")
                    .button({
                        label: $self.attr("title")
                    })
                    .click(function(evt) {
                        $self.trigger(evt);
                    }));
        }
    });
})(jQuery);
