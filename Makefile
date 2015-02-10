all:	$(patsubst %.uncompressed.js,%.min.js,$(wildcard *.uncompressed.js)) \
	$(patsubst %.uncompressed.css,%.min.css,$(wildcard *.uncompressed.css)) \
	$(patsubst %.uncompressed.html,%.html,$(wildcard *.uncompressed.html))

test:	all test.js
	cat index.uncompressed.html | sed -e 's/Squirrel\.uncompressed\.js/test.js/g' > test.html

%.min.js : %.uncompressed.js
	java -jar yuicompressor.jar -v $< > $@

%.min.css : %.uncompressed.css
	java -jar yuicompressor.jar $< > $@

%.html : %.uncompressed.html
	cat $< | sed -e 's/\.uncompressed\./.min./g' > $@
