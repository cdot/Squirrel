debug: dropbox.html drive.html eslint

release: \
	dropbox.html drive.html

clean:
	rm libs/*.min.*
	rm *.min.*
	rm *.pruned.*
	rm *.html
	git checkout libs/ZeroClipboard.min.js

eslint: *.uncompressed.js
	eslint --config package.json *.uncompressed.js

locale/*.json: *.uncompressed.js Squirrel.html.src Makefile translate.pl
	cat $^ \
	| perl translate.pl

%.min.js : %.uncompressed.js
	cat $< \
	| grep -v 'use strict";' \
	| perl -e '$$/=undef;$$_=<>;s{\b((console\.debug|assert)\(.*?\)|debugger);}{/*$1*/}gs;print $$_' \
	> $*.pruned.js
	uglifyjs --compress --source-map $*.min.map -o $@ -- $*.pruned.js

%.min.css : %.uncompressed.css
	cleancss $< > $@

%.uncompressed.html : Squirrel.html.src Makefile
	cat Squirrel.html.src \
	| perl -e '$$/=undef;$$_=<>;s{<!--cloud:$*\s*(.*?)\s*cloud:$*-->}{"$$1"}sge;print $$_;' \
	> $@

minified : \
	$(patsubst %.uncompressed.js,%.min.js,$(wildcard *.uncompressed.js)) \
	$(patsubst %.uncompressed.css,%.min.css,$(wildcard *.uncompressed.css)) \
	$(patsubst libs/%.uncompressed.js,libs/%.min.js,$(wildcard libs/*.uncompressed.js)) \
	$(patsubst libs/%.uncompressed.css,libs/%.min.css,$(wildcard libs/*.uncompressed.css))

%.html : %.uncompressed.html minified
	cat $*.uncompressed.html \
	| sed -e '/Assert\.uncompressed\.js/d' \
	| sed -e 's/\.uncompressed\./.min./g' \
	| perl -e '$$/=undef;$$_=<>;s/<!--.*?-->//gs;s/>\s*</></gs;print $$_' \
	> $@
