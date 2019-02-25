# Copyright (C) 2015-2018 Crawford Currie http://c-dot.co.uk / MIT
# Main targets are:
#
# make test    - run unit tests
# make release - build all derived objects
# make tidy    - beautify code
# make clean   - remove intermediates and derived objects
# make lint    - run eslint
# make langs   - update all translations

# Macros using shell commands
FIND         := find . -name 'jquery*' -prune -o -name
DATE_SED     := sed -e 's/BUILD_DATE/$(shell date)/g'
SQUIRREL_JS  := $(shell cat index.html | \
		grep '<script class="compressable" src=' $^ | \
		sed -e 's/.*src="//;s/[?"].*//g' )
SQUIRREL_CSS := $(shell cat index.html | \
		grep '<link class="compressable"' $^ | \
		sed -e 's/.*href="//;s/[?"].*//g' )
HELP_JS      := $(shell cat help.html | \
		grep '<script class="compressable" src=' $^ | \
		sed -e 's/.*src="//;s/[?"].*//g' )
HELP_CSS     := $(shell cat help.html | \
		grep '<link class="compressable"' $^ | \
		sed -e 's/.*href="//;s/["?].*//g' )

STORES_JS    := $(wildcard src/*Store.js)
TESTS_JS     := $(wildcard test/*.js test/*.js node.js.server/test/*.js)
SERVER_JS    := $(wildcard node.js.server/*.js)
LANGS        := $(wildcard locale/*.json)

%.map %.min.js : %.js
	uglifyjs \
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

index.html : $(SQUIRREL_JS)
	perl build/reversion.pl $@

# Release 
# 1. Combining all the non-store js in the order it is included in the HTML
#    into a single minified file
# 2. Combining all the css (in the order it is included in the HTML) into a
#    single minified file
# Note that the stores are minified but not concatenated
release/src/Squirrel.min.js : $(SQUIRREL_JS)
	@mkdir -p release/js
	uglifyjs \
		--comments \
		--compress \
		--define DEBUG=false \
		-o $@ \
		-- $^

release/src/help.min.js : $(HELP_JS)
	@mkdir -p release/js
	uglifyjs \
		--comments \
		--compress \
		--define DEBUG=false \
		-o $@ \
		-- $^

release/src/%Store.js : src/%Store.js
	@mkdir -p release/js
	uglifyjs \
		--comments \
		--compress \
		--define DEBUG=false \
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
	cat $^ \
	| $(DATE_SED) \
	| sed -E -f build/release.sed \
	> $@

release: release/index.html release/help.html \
	release/src/help.min.js release/css/Squirrel.min.css \
	release/src/Squirrel.min.js release/css/Squirrel.min.css \
	$(patsubst %.js,%.min.js,$(patsubst src/%,release/src/%,$(STORES_JS))) \
	$(patsubst images/%,release/images/%,$(wildcard images/*))
	@-rm -f release/src/*.map
	@echo $^ built

# Languages

langs : $(LANGS)

# Tests

test:
	mocha $(TESTS_JS)

# Clean generated stuff

clean:
	$(FIND) '*~' -exec rm \{\} \;
	$(FIND)  '*.min.*' -exec rm \{\} \;
	$(FIND) '*.map' -exec rm \{\} \;
	$(FIND) '*.esl' -exec rm \{\} \;
	$(FIND) '*.strings' -exec rm \{\} \;

# Formatting

%.js.tidy : %.js
	js-beautify -j --good-stuff -o $^ $^

tidy: $(patsubst %.js,%.js.tidy,$(SQUIRREL_JS) $(STORES_JS) $(SERVER_JS))

# eslint

%.esl : %.js
	-eslint $^ && touch $@

lint: $(patsubst %.js,%.esl,$(patsubst %.min.js,,$(SQUIRREL_JS) $(STORES_JS) $(SERVER_JS)))

# Make a language file
%.js.strings: %.js
	node build/extractTX.js $^

%.html.strings: %.html
	node build/extractTX.js $^

locale/%.json: $(patsubst %.js,%.js.strings,$(SQUIRREL_JS) $(STORES_JS)) index.html.strings help.html.strings
	node build/translate.js -l $@ $^

# debug, keep .strings files around
#.SECONDARY: $(patsubst %.js,%.js.strings,$(SQUIRREL_JS) $(STORES_JS)) index.html.strings help.html.strings


