# Copyright (C) 2015 Crawford Currie http://c-dot.co.uk / MIT

LIBS := $(wildcard libs/*.uncompressed.*)
SOURCES := $(wildcard *.uncompressed.* common/*.uncompressed.* desktop/*.uncompressed.* mobile/*.uncompressed.*)
MIN := $(subst .uncompressed.,.min.,$(SOURCES) $(LIBS))
MAP := $(subst .uncompressed.js,.map,$(filter %.uncompressed.js,$(SOURCES) $(LIBS)))

%.map %.min.js : %.uncompressed.js
	uglifyjs \
		--source-map $(patsubst %.min.js,%.map,$@) \
		--source-map-url $(subst libs/,,$(subst desktop/,,$(subst mobile/,,$(subst common/,,$(patsubst %.min.js,%.map,$@))))) \
		--source-map-include-sources \
		--comments \
		--compress \
		-o $@ \
		-- $^

# To strip DEBUG completely, use:
#		--define DEBUG=false \

%.min.css : %.uncompressed.css
	cleancss $^ > $@

%.min.html : %.uncompressed.html
	cat $^ | sed -e 's/\.uncompressed\./.min./g' > $@

# Making release 

%.map : %.min.js

release: $(MIN) $(MAP)
	@echo "Done"

# Other targets
%.esl : %.uncompressed.js
	eslint --config package.json $^
	touch $@

clean:
	find . -name '*~' -exec rm \{\} \;
	find . -name '*.min.*' -exec rm \{\} \;
	find . -name '*.map' -exec rm \{\} \;
	find . -name '*.esl' -exec rm \{\} \;

eslint: $(subst .uncompressed.js,.esl,$(SOURCES))

locale/%.json: *.uncompressed.js Squirrel.html.src
	perl build_scripts/translate.pl $(*F) *.uncompressed.js Squirrel.html.src

#	$(wildcard libs/images/icons-png/*.png  libs/images/icons-svg/*.svg) 
upload: $(MIN) $(MAP) \
	$(wildcard images/*.svg images/*.ico images/*.png images/*.gif) \
	$(wildcard libs/images/*.png libs/images/*.gif) \
	$(wildcard libs/*.swf)
	perl build_scripts/upload.pl $^

