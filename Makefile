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
SQUIRREL_JS  := $(shell \
		grep '<script class="compressable" src=' Squirrel.html | \
		sed -e 's/.*src="//;s/[?"].*//g' )
SQUIRREL_CSS := $(shell \
		grep '<link class="compressable"' Squirrel.html | \
		sed -e 's/.*href="//;s/[?"].*//g' )
HELP_JS      := $(shell \
		grep '<script class="compressable" src=' help.html | \
		sed -e 's/.*src="//;s/[?"].*//g' )
HELP_CSS     := $(shell \
		grep '<link class="compressable"' help.html | \
		sed -e 's/.*href="//;s/["?].*//g' )

STORES_JS    := $(wildcard js/*Store.js)
TESTS        := $(wildcard js/test/*.js test/*.js node.js.server/test/*.js) \
		$(wildcard js/test/*.html test/*.html node.js.server/test/*.html)
SERVER_JS    := $(wildcard node.js.server/*.js)
LANGS        := $(wildcard locale/*.json)
IMAGES       := $(wildcard images/*)
TMP          := /tmp/

# Update version numbers to reflect local changes.
# Use git status to get a list of locally changed files and update the version
# identifiers in Squirrel.html. Used during development only.
version:
	node build/version.js -o Squirrel.html Squirrel.html

# Update version numbers to reflect the current checked-in status ofthe project.
# Get a list of interesting files from Squirrel.html (the ones with ?version=)
# and use git log to get the latest checked-in date
reversion:
	INTERESTING=`grep -P '\?version=[0-9]*' Squirrel.html | sed -e 's/^.*\(src\|href\)="//;s/\?version.*//'`;\
	for c in $$INTERESTING; do \
		DATE=`git log -n 1 $$c | grep Date | sed -e 's/Date: *//;s/ +0.*//'`; \
		DATE=`date -d "$$DATE" +%s`; \
		echo "GIT: $$c: $$DATE" ;\
		sed -e "s#$$c?version=[a-f0-9]*#$$c?version=$$DATE#" Squirrel.html > $(TMP)Squirrel.html;\
		diff $(TMP)Squirrel.html Squirrel.html || mv $(TMP)Squirrel.html Squirrel.html; \
	done

# Release 
release/%.css : %.css
	@mkdir -p $(@D)
	cleancss -o $@ $^

release/images/% : images/%
	@mkdir -p $(@D)
	cp $^ $@

release/%.html : %.html
	@mkdir -p $(@D)
	sed -e 's/BUILD_DATE/$(shell date)/g' $^ \
	| sed -e 's/<!--babel:\(.*\):babel-->/\1/' $^ > $@
	@CHANGED=`git status -s --porcelain | grep -v "^\?" | grep -P -v "^ ?D" | sed -e 's/^ M.//;s/^R.*->.//'`;\
	for c in $$CHANGED; do \
          export DATE=`stat -c %Y $$c`; \
          sed -e "s#$$c?version=[0-9]*#$$c?version=$$DATE#" $@ > $(TMP)html;\
          diff -q $@ $(TMP)html || echo $$c && mv $(TMP)html $@; \
	done

# locale
release/locale/%.json : locale/%.json
	@mkdir -p $(@D)
	cp $^ $@

release/index.html : release/Squirrel.html
	@mkdir -p $(@D)
	cp $^ $@

# @babel/polyfill
release/libs/polyfill.min.js : node_modules/@babel/polyfill/dist/polyfill.min.js
	@mkdir -p $(@D)
	cp $< $@

release/libs/utf8.js : node_modules/utf8/utf8.js
	@mkdir -p $(@D)
	cp $< $@

release/libs/bundle.js : node_modules/babel-runtime-amd/dist/bundle.js
	@mkdir -p $(@D)
	cp $< $@

release/libs/require.js : node_modules/requirejs/require.js
	@mkdir -p $(@D)
	cp $< $@

release/%.js : %.js
	@mkdir -p $(@D)
	node_modules/.bin/babel $^ -sourceMap -o $@

release: release/libs/polyfill.min.js \
	release/libs/utf8.js \
	release/libs/bundle.js \
	release/libs/require.js \
	$(SQUIRREL_JS:%.js=release/%.js) \
	$(STORES_JS:%.js=release/%.js) \
	$(HELP_JS:%.js=release/%.js) \
	$(SQUIRREL_CSS:%.css=release/%.css) \
	$(HELP_CSS:%.css=release/%.css) \
	$(IMAGES:images/%=release/images/%) \
	$(TESTS:%=release/%) \
	release/index.html release/help.html
	@mkdir -p release/js/test
	@echo $^ built

ignore_for_now:	$(LANGS:locale/%.json=release/locale/%.json) \

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
%.strings: %
	node build/extractTX.js $^

locale/%.json: $(SQUIRREL_JS:%=%.strings) $(STORES_JS:%=%.strings) \
		Squirrel.html.strings help.html.strings
	node build/translate.js -l $@ $^

# keep .strings files around
.SECONDARY: $(patsubst %.js,%.js.strings,$(SQUIRREL_JS) $(STORES_JS)) Squirrel.html.strings help.html.strings


