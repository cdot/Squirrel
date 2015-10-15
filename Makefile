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

.SECONDEXPANSION:
upload: \
	$(patsubst %,%.uncompressed.html,$(STORES)) \
	$(patsubst %,%.html,$(STORES)) \
	$(subst uncompressed,min,$(COMMONJS)) \
	$(subst uncompressed.js,map,$(COMMONJS)) \
	$(subst uncompressed,min,$(LIBSJS)) \
	$(subst uncompressed.js,map,$(LIBSJS)) \
	$(patsubst %.uncompressed.css,%.min.css,$(COMMONCSS)) \
	$(patsubst %.uncompressed.css,%.min.css,$(LIBSCSS)) \
	$(wildcard images/*) \
	$(wildcard libs/images/*) \
	$(wildcard libs/*.swf) \
	$$(subst uncompressed,min,$(patsubst %,$$(%JS),$(STORES))) \
	$$(subst uncompressed.js,map,$(patsubst %,$$(%JS),$(STORES))) \
	$(COMMONJS) $(LIBSJS) $(COMMONCSS) $(LIBSCSS) $(driveJS)
	perl build_scripts/upload.pl $^

