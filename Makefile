STORES = dropbox drive facebook

dropboxJS = \
	libs/dropbox.uncompressed.js \
	DropboxStore.uncompressed.js

driveJS = \
	GoogleDriveStore.uncompressed.js

facebookJS = \
	FacebookStore.uncompressed.js

LIBSJS = \
	libs/jquery-2.1.3.uncompressed.js \
	libs/jquery-ui.uncompressed.js \
	libs/jquery-bonsai.uncompressed.js \
	libs/jquery-ui-contextmenu.uncompressed.js \
	libs/ZeroClipboard.uncompressed.js \
	libs/aes.uncompressed.js \
	libs/aes-ctr.uncompressed.js

LIBSCSS = \
	libs/jquery-ui.uncompressed.css \
	libs/jquery-bonsai.uncompressed.css

COMMONJS = \
	Utils.uncompressed.js \
	Translation.uncompressed.js \
	AbstractStore.uncompressed.js \
	LocalStorageStore.uncompressed.js \
	EncryptedStore.uncompressed.js \
	Squirrel.uncompressed.js \
	Tree.uncompressed.js \
	ContextMenu.uncompressed.js \
	Dialogs.uncompressed.js \
	Hoard.uncompressed.js

COMMONCSS = \
	Squirrel.uncompressed.css

# Making debug
# e.g make dropbox.uncompressed.html
# make drive.uncompressed.html

SPRE=<script "type="text/javascript" src="
SPOS="></script>
LPRE=<link rel="stylesheet" href="
LPOS=">

debug: $(patsubst %,%.uncompressed.html,$(STORES))

%.uncompressed.html : Squirrel.html.src
	./sub.pl Squirrel.html.src \
		LIBSJS_HTML '$(patsubst %,$(SPRE)%$(SPOS),$(LIBSJS))' \
		COMMONJS_HTML '$(patsubst %,$(SPRE)%$(SPOS),$(COMMONJS))' \
		STOREJS_HTML '$(patsubst %,$(SPRE)%$(SPOS),$($*JS))' \
		LIBSCSS_HTML '$(patsubst %,$(LPRE)%$(LPOS),$(LIBSCSS))' \
		COMMONCSS_HTML '$(patsubst %,$(LPRE)%$(LPOS),$(COMMONCSS))' \
		DEBUG '<script type="text/javascript">const DEBUG=true;</script>' \
	> $@

# Making release 

#		--source-map $(patsubst %.js,%.map,$@) \

uglifyJS = \
	uglifyjs \
		--compress \
		--define DEBUG=false \
		-o $@ \
		-- $^

cleancss = \
	echo "" > $@; \
	$(patsubst %,cleancss %>>$@;,$^)

libs/libs.min.js : $(LIBSJS)
	$(uglifyJS)

libs/libs.min.css : $(LIBSCSS)
	$(cleancss)

Squirrel.min.js : $(COMMONJS)
	$(uglifyJS)

Squirrel.min.css : $(COMMONCSS)
	$(cleancss)

%.min.js : $(%JS)
	$(uglifyJS)

%.html : Squirrel.html.src Squirrel.min.js libs/libs.min.js %.min.js libs/libs.min.css Squirrel.min.css
	perl sub.pl Squirrel.html.src \
	LIBSJS_HTML '$(SPRE)libs/libs.min.js$(SPOS)' \
	COMMONJS_HTML '$(SPRE)Squirrel.min.js$(SPOS)' \
	STOREJS_HTML '$(SPRE)$*.min.js$(SPOS)' \
	LIBSCSS_HTML '$(LPRE)libs/libs.min.css$(LPOS)' \
	COMMONCSS_HTML '$(LPRE)Squirrel.min.css$(LPOS)' \
	> $@

release: $(patsubst %,%.html,$(STORES))

# Other targets

clean:
	rm -f *~
	rm -f libs/*.min.*
	rm -f *.min.*
	rm -f *.html
	rm -f *.map

eslint: $(COMMONJS) DropboxStore.uncompressed.js $(driveJS)
	eslint --config package.json $^

locale/*.json: *.uncompressed.js Squirrel.html.src Makefile translate.pl
	cat $^ \
	| perl translate.pl


