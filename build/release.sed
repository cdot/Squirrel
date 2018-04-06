# Process HTML to generate release
s/[ \t]+/ /g
s/<!--.*?-->//g
s/<meta name="expires".*?>/<meta name="expires" content="Wed, 1 Jan 2025 12:00:00 GMT">/g
s/(<[a-z]* )class="compressable" (.*?="[A-Za-z_]*\/)([A-Za-z_]*)\.(js|css)(.*?".*?>)/\1\2\3.min.\4\5/
#/^.*?class="compressable".*?/d
/^ *$/d
s/^ //
s/ $//
