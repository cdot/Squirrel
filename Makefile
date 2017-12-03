# Copyright (C) 2015-2017 Crawford Currie http://c-dot.co.uk / MIT
FIND := find . -name 'jquery*' -prune -o -name

JS_SOURCES   := $(shell cat Squirrel.html | \
		grep '<script class="compressable"' $^ | \
		sed -e 's/.*src="//;s/".*//g' )
JS_STORES    := $(wildcard js/*Store.js)
JS_TESTS     := $(wildcard js/test/*.js test/*.js)
CSS_SOURCES  := $(shell cat Squirrel.html | \
		grep '<link class="compressable"' $^ | \
		sed -e 's/.*href="//;s/".*//g' )
HTML_SOURCES := Squirrel.html
MIN          :=  $(patsubst %.js,%.min.js,$(JS_SOURCES)) \
		$(patsubst %.css,%.min.css,$(CSS_SOURCES)) \
		$(patsubst %.html,%.min.html,$(HTML_SOURCES))
MAP          := $(subst .js,.map,$(JS_SOURCES))
LINT         := $(subst .js,.esl,$(patsubst %.min.js,,$(JS_SOURCES)))
SUPERMIN_JS  := $(patsubst %.js,%.min.js,$(JS_SOURCES))
SUPERMIN_CSS := $(patsubst %.css,%.min.css,$(CSS_SOURCES))

debug:
	@echo CSS_SOURCES $(CSS_SOURCES)
	@echo HTML_SOURCES $(HTML_SOURCES)
	@echo MAP $(MAP)

other:  @echo MIN $(MIN)
	@echo JS_SOURCES $(JS_SOURCES)
	@echo LINT $(LINT)

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

%.map : %.min.js

# Making release 

release/Squirrel.min.js : $(JS_SOURCES)
	uglifyjs \
		--comments \
		--compress \
		--mangle \
		--defined DEBUG=false \
		-o $@ \
		-- $^

release/%Store.js : js/%Store.js
	uglifyjs \
		--comments \
		--compress \
		--mangle \
		--defined DEBUG=false \
		-o $@ \
		-- $^

release/Squirrel.min.css : $(CSS_SOURCES)
	cleancss $^ > $@

release/Squirrel.html : Squirrel.html
	cat Squirrel.html | \
	sed -E -e 's/.*"js\/Squirrel.js".*/<script src="Squirrel.min.js"><\/script>/' | \
	sed -E -e 's/.*"css\/Squirrel.css".*/<script src="Squirrel.min.css"><\/script>/' | \
	sed -E -e '/.*class="compressable".*/d' > $@

release: $(MIN) $(MAP) release/Squirrel.html \
	release/Squirrel.min.js release/Squirrel.min.css \
	$(patsubst js/,release/,$(JS_STORES))
	@echo $@ built

# Other targets
%.esl : %.js
	-eslint $^ && touch $@

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

