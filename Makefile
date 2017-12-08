# Copyright (C) 2015-2017 Crawford Currie http://c-dot.co.uk / MIT
FIND         := find . -name 'jquery*' -prune -o -name
SQUIRREL_JS  := $(shell cat Squirrel.html | \
		grep '<script class="compressable" src=' $^ | \
		sed -e 's/.*src="//;s/".*//g' )
STORES_JS    := $(wildcard js/*Store.js)
TESTS_JS     := $(wildcard js/test/*.js test/*.js)
SQUIRREL_CSS := $(shell cat Squirrel.html | \
		grep '<link class="compressable"' $^ | \
		sed -e 's/.*href="//;s/".*//g' )

HELP_JS      := $(shell cat help.html | \
		grep '<script class="compressable" src=' $^ | \
		sed -e 's/.*src="//;s/".*//g' )
HELP_CSS     := $(shell cat help.html | \
		grep '<link class="compressable"' $^ | \
		sed -e 's/.*href="//;s/".*//g' )

# The min target supports generating a minified test version, halfway to a
# release

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

min:	$(patsubst %.js,%.min.js,$(SQUIRREL_JS) $(STORES_JS)) \
	$(patsubst %.js,%.map,$(SQUIRREL_JS) $(STORES_JS)) \
	$(patsubst %.css,%.min.css,$(SQUIRREL_CSS))
	@echo "Made min"

# Release 

release/js/Squirrel.min.js : $(SQUIRREL_JS)
	@mkdir -p release/js
	uglifyjs \
		--comments \
		--compress \
		--mangle \
		--define DEBUG=false \
		-o $@ \
		-- $^

release/js/help.min.js : $(HELP_JS)
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

release/css/Squirrel.min.css : $(SQUIRREL_CSS)
	@mkdir -p release/css
	cat $^ | cleancss -o $@

release/css/help.min.css : $(HELP_CSS)
	@mkdir -p release/css
	cat $^ | cleancss -o $@t

release/images/% : images/%
	@mkdir -p release/images
	cp $^ $@

release/%.html : %.html
	@mkdir -p release
	cat $^ | \
	sed -E -e 's/(<script )class="compressable"(.*")js\/Squirrel.js(".*>)/\1\2js\/Squirrel.min.js\3/' | \
	sed -E -e 's/(<script )class="compressable"(.*")js\/help.js(".*>)/\1\2js\/help.min.js\3/' | \
	sed -E -e 's/(<link )class="compressable"(.*")css\/Squirrel\.css(".*>)/\1\2css\/Squirrel.min.css\3/' | \
	sed -E -e 's/(<link )class="compressable"(.*")css\/help\.css(".*>)/\1\2css\/help.min.css\3/' | \
	sed -e '/^.*class="compressable".*/d' > $@

release: release/Squirrel.html release/help.html \
	release/js/help.min.js release/css/Squirrel.min.css \
	release/js/Squirrel.min.js release/css/Squirrel.min.css \
	$(patsubst %.js,%.min.js,$(patsubst js/%,release/js/%,$(STORES_JS))) \
	$(patsubst images/%,release/images/%,$(wildcard images/*))
	@-rm -f release/js/*.map
	echo $^ built

# Tests

test:
	mocha $(TESTS_JS)

# Clean generated stuff

clean:
	rm -rf release
	$(FIND) '*~' -exec rm \{\} \;
	$(FIND)  '*.min.*' -exec rm \{\} \;
	$(FIND) '*.map' -exec rm \{\} \;
	$(FIND) '*.esl' -exec rm \{\} \;
	$(FIND) '*.strings' -exec rm \{\} \;

# Formatting

%.js.tidy : %.js
	js-beautify -j -B --good-stuff -o $^ $^

tidy: $(patsubst %.js,%.js.tidy,$(SQUIRREL_JS) $(STORES_JS))

# eslint

%.esl : %.js
	-eslint $^ && touch $@

lint: $(subst .js,.esl,$(patsubst %.min.js,,$(SQUIRREL_JS) $(STORES_JS)))

# Make a language file
%.js.strings: %.js
	node build/extractTX.js $^

%.html.strings: %.html
	node build/extractTX.js $^


locale/%.json: $(patsubst %.js,%.js.strings,$(SQUIRREL_JS) $(STORES_JS)) Squirrel.html.strings help.html.strings
	node build/translate.js -l $@ $^

# debug, keep .strings files around
.SECONDARY: $(patsubst %.js,%.js.strings,$(SQUIRREL_JS) $(STORES_JS)) Squirrel.html.strings help.html.strings


