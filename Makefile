all:	$(patsubst %.uncompressed.js,%.min.js,$(wildcard *.uncompressed.js)) \
	$(patsubst %.uncompressed.css,%.min.css,$(wildcard *.uncompressed.css)) \
	$(patsubst %.uncompressed.html,%.html,$(wildcard *.uncompressed.html))

test:	all test.js
	cat index.uncompressed.html | sed -e 's/Squirrel\.uncompressed\.js/test.js/g' > test.html

eslint: *.uncompressed.js
	eslint --config package.json *.uncompressed.js

locale/*.json: *.uncompressed.* Makefile translate.pl
	cat *.uncompressed.* | \
		perl translate.pl

%.min.js : %.uncompressed.js
	cat $< \
	  | perl -pe '$/=undef;s{((console\.debug|assert)\(.*?\);)}{/*$1*/}gs' \
	  | java -jar yuicompressor.jar --type js --verbose -o $@

%.min.css : %.uncompressed.css
	java -jar yuicompressor.jar $< > $@

%.html : %.uncompressed.html
	cat $< \
	  | sed -e '/Assert\.uncompressed\.js/d' \
	  | sed -e 's/\.uncompressed\./.min./g' > $@
