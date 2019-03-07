# Copyright (C) 2015-2018 Crawford Currie http://c-dot.co.uk / MIT
# Main targets are:
#
# make tests   - run unit tests
# make release - build all derived objects
# make tidy    - beautify code
# make clean   - remove intermediates and derived objects
# make lint    - run eslint
# make langs   - update all translations

# Macros using shell commands
FIND         := find . -name 'jquery*' -prune -o -name node_modules -prune -o
DATE_SED     := sed -e 's/BUILD_DATE/$(shell date)/g'

JS	:= src/AbstractStore.js src/LayeredStore.js src/EncryptedStore.js \
	src/Steganographer.js \
	src/Utils.js src/Serror.js src/RGBA.js src/Translator.js src/AES.js \
	src/LocalStorageStore.js src/HttpServerStore.js src/WebDAVStore.js \
	src/StegaStore.js src/FileStore.js src/GoogleDriveStore.js \
	src/Hoard.js src/Tree.js \
	src/Server.js src/Dialogs.js src/Squirrel.js \
	src/web_server.js \
	src/main.js \
	src/help.js

CSS	:= $(shell cat index.html help.html | \
		grep '<link class="compressable"' $^ | \
		sed -e 's/.*href="//;s/[?"].*//g' )

TESTS_JS     := AES.js \
		EncryptedStore.js \
		Hoard.js \
		HttpServerStore.js \
		icon_button.js \
		LocalStorageStore.js \
		Pseudoword.js \
		RGBA.js \
		Server.js \
		simulated_password.js \
		Translator.js \
		Tree.js \
		Utils.js

# cannot test WebDAVStore.js from makefile, as it requires a webdav server.
# Test it from the command-line thus:
#
# T_net_url=http://localhost/webdav && \
# T_net_user=<webdavuser> && \
# T_net_pass=<webdavpass> && \
# node WebDAVStore.js
#
# Or use test/WebDAVStore.html to test in the browser

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

tests:
	for f in $(TESTS_JS); do \
		(cd test && node $$f); \
	done

# Clean generated stuff

clean:
	$(FIND) \( \
		-name '*~' -o \
		-name '*.min.*' -o \
		-name '*.map' -o \
		-name '*.esl' -o \
		-name '*.strings' \
		\) -exec rm \{\} \;

# Formatting

%.js.tidy : %.js
	js-beautify --jslint-happy --break-chained-methods \
		--wrap-line-length 72 --unindent-chained-methods \
		--preserve-newlines --operator-position after-newline \
		--good-stuff -o $^ $^

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


