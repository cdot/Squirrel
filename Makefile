SOURCES := $(wildcard *.uncompressed.* */*.uncompressed.*)
MIN := $(subst .uncompressed.,.min.,$(SOURCES))

%.map %.min.js : %.uncompressed.js
	uglifyjs \
		--source-map $(patsubst %.min.js,%.map,$@) \
		--source-map-url $(patsubst libs/%,%, $(patsubst %.min.js,%.map,$@)) \
		--source-map-include-sources \
		--compress \
		--define DEBUG=false \
		-o $@ \
		-- $^

%.min.css : %.uncompressed.css
	cleancss $^ > $@

%.min.html : %.uncompressed.html
	cat $^ | sed -e 's/\.uncompressed\./.min./g' > $@

# Making release 

%.map : %.min.js

release: $(MIN)
	@echo "Done"

# Other targets

clean:
	find . -name '*~' -exec rm \{\} \;
	find . -name '*.min.*' -exec rm \{\} \;
	find . -name '*.map' -exec rm \{\} \;

eslint: $(wildcard *.uncompressed.js */*.uncompressed.js)
	eslint --config package.json $^

locale/%.json: *.uncompressed.js Squirrel.html.src
	perl build_scripts/translate.pl $(*F) *.uncompressed.js Squirrel.html.src

#	$(wildcard libs/images/icons-png/*.png  libs/images/icons-svg/*.svg) 
upload: $(MIN) \
	$(wildcard images/*.svg images/*.ico images/*.png images/*.gif) \
	$(wildcard libs/images/*.png libs/images/*.gif) \
	$(wildcard libs/*.swf)
	perl build_scripts/upload.pl $^

