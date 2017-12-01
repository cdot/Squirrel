# Copyright (C) 2015 Crawford Currie http://c-dot.co.uk / MIT
FIND := find . -name 'jquery*' -prune -o -name

JS_SOURCES := $(patsubst %.min.%,,$(wildcard js/*.js libs/*.js))
JS_TESTS := $(wildcard js/test/*.js test/*.js)
CSS_SOURCES := $(patsubst %.min.%,,$(wildcard css/*.css))
HTML_SOURCES := Squirrel.html
MIN :=  $(patsubst %.js,%.min.js,$(JS_SOURCES)) \
	$(patsubst %.css,%.min.css,$(CSS_SOURCES)) \
	$(patsubst %.html,%.min.html,$(HTML_SOURCES))
MAP := $(subst .js,.map,$(JS_SOURCES))
LINT := $(subst .js,.esl,$(JS_SOURCES))

debug:
	echo JS_SOURCES $(JS_SOURCES)
	echo CSS_SOURCES $(CSS_SOURCES)
	echo HTML_SOURCES $(HTML_SOURCES)
	echo MIN $(MIN)
	echo MAP $(MAP)
	echo LINT $(LINT)

%.map %.min.js : %.js
	uglifyjs \
		--source-map $(patsubst %.min.js,%.map,$@) \
		--source-map-url $(subst js/,,$(patsubst %.min.js,%.map,$@)) \
		--source-map-include-sources \
		--comments \
		--compress \
		-o $@ \
		-- $^

# To strip DEBUG completely, use:
#		--define DEBUG=false \

%.min.css : %.css
	cleancss $^ > $@

%.min.html : %.html
	cat $^ | \
	sed -E -e 's/class="compressable" ([^.]*)\.([a-z]+)"/\1.min.\2/g' > $@

# Making release 

%.map : %.min.js

release: $(MIN) $(MAP)
	@echo "Done $(MIN) $(MAP)"

# Other targets
%.esl : %.js
	eslint --config package.json $^
	touch $@

test:
	mocha $(JS_TESTS)

clean:
	$(FIND) '*~' -exec rm \{\} \;
	$(FIND)  '*.min.*' -exec rm \{\} \;
	$(FIND) '*.map' -exec rm \{\} \;
	$(FIND) '*.esl' -exec rm \{\} \;

lint: $(LINT)

locale/%.json: $(JS_SOURCES) $(HTML_SOURCES)
	perl build_scripts/translate.pl $(*F) $^

# Upload to FTP
#	$(wildcard libs/images/icons-png/*.png  libs/images/icons-svg/*.svg) 
upload: $(MIN) $(MAP) \
	$(wildcard images/*.svg images/*.ico images/*.png images/*.gif) \
	$(wildcard libs/images/*.png libs/images/*.gif) \
	$(wildcard libs/*.swf)
	perl build_scripts/upload.pl $^

