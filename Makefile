LIBSJS= \
	libs/jquery-2.1.3.uncompressed.js \
	libs/jquery-ui.uncompressed.js \
	libs/jquery-bonsai.uncompressed.js \
	libs/jquery-ui-contextmenu.uncompressed.js \
	libs/jquery-fileinput.uncompressed.js \
	libs/ZeroClipboard.uncompressed.js \
	libs/aes.uncompressed.js \
	libs/aes-ctr.uncompressed.js

LIBSCSS= \
	libs/jquery-ui.uncompressed.css \
	libs/jquery-bonsai.uncompressed.css

COMMONJS= \
	Utils.uncompressed.js \
	Translation.uncompressed.js \
	AbstractStore.uncompressed.js \
	LocalStorageStore.uncompressed.js \
	EncryptedStore.uncompressed.js \
	Squirrel.uncompressed.js \
	ContextMenu.uncompressed.js \
	Dialogs.uncompressed.js \
	Hoard.uncompressed.js

COMMONCSS= \
	Squirrel.uncompressed.css

dropboxJS= \
	libs/dropbox.uncompressed.js \
	DropboxStore.uncompressed.js

driveJS= \
	GoogleDriveStore.uncompressed.js

# Making debug
# e.g make dropbox.uncompressed.html
# make drive.uncompressed.html

SPRE=<script "type="text/javascript" src="

SPOS="></script>

LPRE=<link rel="stylesheet" href="

LPOS=">

LIBSJS_HTML= $(patsubst %,$(SPRE)%$(SPOS),$(LIBSJS))

LIBSCSS_HTML= $(patsubst %,$(LPRE)%$(LPOS),$(LIBSCSS))

COMMONJS_HTML= $(patsubst %,$(SPRE)%$(SPOS),$(COMMONJS))

COMMONCSS_HTML= $(patsubst %,$(LPRE)%$(LPOS),$(COMMONCSS))

dropboxJS_HTML= $(patsubst %,$(SPRE)%$(SPOS),$(dropboxJS))

drive_JS_HTML= $(patsubst %,$(SPRE)%$(SPOS),$(driveJS))

%.uncompressed.html : Squirrel.html.src
	./sub.pl Squirrel.html.src \
		LIBSJS_HTML '$(LIBSJS_HTML)' \
		COMMONJS_HTML '$(COMMONJS_HTML)' \
		STOREJS_HTML '$($*JS_HTML)' \
		LIBSCSS_HTML '$(LIBSCSS_HTML)' \
		COMMONCSS_HTML '$(COMMONCSS_HTML)' \
	> $@

# Making release 

uglifyJS = \
	uglifyjs \
		--compress \
		--source-map $*.min.map \
		--define DEBUG=false \
		--mangle \
		-o $@ \
		-- $^

libs.min.js : $(LIBSJS)
	$(uglifyJS)

libs.min.css : $(LIBSCSS)
	cleancss $< > $@

Squirrel.min.js : $(COMMONJS)
	$(uglifyJS)

Squirrel.min.css : $(COMMONCSS)
	cleancss $< > $@

dropbox.min.js : $(dropboxJS_JS)

%.html : Squirrel.html.src Squirrel.min.js libs.min.js %.min.js libs.min.css Squirrel.min.css 
	./sub.pl Squirrel.html.src \
	LIBSJS_HTML '$(SPRE)libs.min.js$(SPOS)' \
	COMMONJS_HTML '$(SPRE)Squirrel.min.js$(SPOS)' \
	STOREJS_HTML '$(SPRE)$*.min.js$(SPOS)' \
	LIBSCSS_HTML '$(LPRE)libs.min.css$(LPOS)' \
	COMMONCSS_HTML '$(LPRE)Squirrel.min.css$(LPOS)' \
	> $@

release: \
	dropbox.html drive.html

clean:
	rm *~
	rm libs/*.min.*
	rm *.min.*
	rm *.html

eslint: *.uncompressed.js
	eslint --config package.json *.uncompressed.js

locale/*.json: *.uncompressed.js Squirrel.html.src Makefile translate.pl
	cat $^ \
	| perl translate.pl

%.uncompressed.html : Squirrel.html.src Makefile
	cat Squirrel.html.src \
	| perl -e '$$/=undef;$$_=<>;s{<!--cloud:$*\s*(.*?)\s*cloud:$*-->}{"$$1"}sge;print $$_;' \
	> $@

