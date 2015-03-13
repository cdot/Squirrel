debug: dropbox drive eslint

release: \
	$(patsubst %.uncompressed.js,%.min.js,$(wildcard *.uncompressed.js)) \
	$(patsubst %.uncompressed.css,%.min.css,$(wildcard *.uncompressed.css)) \
	dropbox.html drive.html

test:	all test.js
	cat index.uncompressed.html | sed -e 's/Squirrel\.uncompressed\.js/test.js/g' > test.html

eslint: *.uncompressed.js
	eslint --config package.json *.uncompressed.js

locale/*.json: *.uncompressed.* Makefile translate.pl
	cat *.uncompressed.* | \
		perl translate.pl

%.min.js : %.uncompressed.js
	cat $< \
	  | perl -pe 's{\b((console\.debug|assert)\(.*?\)|debugger);}{/*$1*/}gs' \
	  | uglifyjs --compress -- $< > $@

%.min.css : %.uncompressed.css
	cleancss $< > $@

dropbox : dropbox.uncompressed.html

drive : drive.uncompressed.html

%.uncompressed.html : index.uncompressed.html
	echo "$< and $*"
	cat $< \
	| perl -e '$$/=undef;$$x=<>;$$x=~s{<!--cloud:$*\s*(.*?)\s*cloud:$*-->}{"$$1"}sge;$$x=~s{<!--cloud:.*cloud:\w+-->}{}sg;print $$x;' > $@

%.html : %.uncompressed.html
	cat $< \
	  | sed -e '/Assert\.uncompressed\.js/d' \
	  | sed -e 's/\.uncompressed\./.min./g' > $@
