# Process HTML to generate release
s/[ \t]+/ /g
s/<!--.*?-->//g
s/(<script )class="compressable"(.*")js\/Squirrel.js(".*>)/\1\2js\/Squirrel.min.js\3/
s/(<script )class="compressable"(.*")js\/help.js(".*>)/\1\2js\/help.min.js\3/
s/(<link )class="compressable"(.*")css\/Squirrel\.css(".*>)/\1\2css\/Squirrel.min.css\3/
s/(<link )class="compressable"(.*")css\/help\.css(".*>)/\1\2css\/help.min.css\3/
/^.*class="compressable".*/d
/^ *$/d
s/^ //
s/ $//
