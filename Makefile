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

# To strip DEBUG completely, use:
#		--define DEBUG=false
%.map %.min.js : %.js
	uglifyjs \
		--source-map $(patsubst %.min.js,%.map,$@) \
		--source-map-url $(subst js/,,$(patsubst %.min.js,%.map,$@)) \
		--source-map-include-sources \
		--comments \
		--compress \
		-o $@ \
		-- $^

%.min.css : %.css
	cleancss $^ > $@

%.min.html : %.html
	cat $^ | \
	sed -E -e 's/class="compressable" ([^.]*)\.([a-z]+)"/\1.min.\2"/g' > $@

%.map : %.min.js

# The min target supports generating a minified test version, halfway to a
# release
min:	$(patsubst %.js,%.min.js,$(JS_SOURCES) $(JS_STORES)) \
	$(patsubst %.js,%.map,$(JS_SOURCES) $(JS_STORES)) \
	$(patsubst %.css,%.min.css,$(CSS_SOURCES)) \
	$(patsubst %.html,%.min.html,$(HTML_SOURCES))
	@echo "Made min"

# Making release 
release/js/Squirrel.min.js : $(JS_SOURCES)
	@mkdir -p release/js
	uglifyjs \
		--comments \
		--compress \
		--mangle \
		--defined DEBUG=false \
		-o $@ \
		-- $^

release/js/%Store.js : js/%Store.js
	@mkdir -p release/js
	uglifyjs \
		--comments \
		--compress \
		--mangle \
		--defined DEBUG=false \
		-o $@ \
		-- $^

release/css/Squirrel.min.css : $(CSS_SOURCES)
	@mkdir -p release/css
	cat $^ | cleancss -o $@

release/images/% : images/%
	@mkdir -p release/images
	cp $^ $@

release/Squirrel.min.html : Squirrel.html
	@mkdir -p release
	cat Squirrel.html | \
	sed -E -e 's/(<script )class="compressable"(.*")js\/Squirrel.js(".*>)/\1\2js\/Squirrel.min.js\3/' | \
	sed -E -e 's/(<link )class="compressable"(.*")css\/Squirrel\.css(".*>)/\1\2css\/Squirrel.min.css\3/' | \
	sed -e '/^.*class="compressable".*/d' > $@

release: release/Squirrel.min.html \
	release/js/Squirrel.min.js release/css/Squirrel.min.css \
	$(patsubst %.js,%.min.js,$(patsubst js/%,release/js/%,$(JS_STORES))) \
	$(patsubst images/%,release/images/%,$(wildcard images/*))
	echo $^ built

# Other targets
%.esl : %.js
	-eslint $^ && touch $@

test:
	mocha $(JS_TESTS)

clean:
	rm -rf release
	$(FIND) '*~' -exec rm \{\} \;
	$(FIND)  '*.min.*' -exec rm \{\} \;
	$(FIND) '*.map' -exec rm \{\} \;
	$(FIND) '*.esl' -exec rm \{\} \;

lint: $(LINT)

locale/%.json: $(JS_SOURCES) $(HTML_SOURCES)
	perl build_scripts/translate.pl $(*F) $^

# Upload to FTP
#	$(wildcard libs/images/icons-png/*.png  libs/images/icons-svg/*.svg) 
upload: release \
	$(wildcard images/*.svg images/*.ico) \
	$(wildcard release/*)
	perl build_scripts/upload.pl $^

