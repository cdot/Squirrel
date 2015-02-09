all: $(patsubst %.uncompressed.js,%.js,$(wildcard *.uncompressed.js))

%.js : %.uncompressed.js
	java -jar yuicompressor.jar $< > $@
