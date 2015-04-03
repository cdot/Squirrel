STORES = dropbox drive

dropboxJS = \
	libs/dropbox.uncompressed.js \
	DropboxStore.uncompressed.js

driveJS = \
	GoogleDriveStore.uncompressed.js

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

.PRECIOUS: %.min.js %.min.css

.SECONDEXPANSION:
%.html : Squirrel.html.src \
	$(subst uncompressed,min,$(COMMONJS)) \
	$(subst uncompressed,min, $(LIBSJS)) \
	$(patsubst %.uncompressed.css,%.min.css,$(COMMONCSS)) \
	$(patsubst %.uncompressed.css,%.min.css,$(LIBSCSS)) \
	$$(subst uncompressed,min,$$($$*JS))
	./sub.pl Squirrel.html.src \
	LIBSJS_HTML \
	'$(patsubst %.uncompressed.js,$(SPRE)%.min.js$(SPOS),$(LIBSJS))' \
	COMMONJS_HTML \
	'$(patsubst %.uncompressed.js,$(SPRE)%.min.js$(SPOS),$(COMMONJS))' \
	STOREJS_HTML \
	'$(patsubst %.uncompressed.js,$(SPRE)%.min.js$(SPOS),$($*JS))' \
	LIBSCSS_HTML \
	'$(patsubst %.uncompressed.css,$(LPRE)%.min.css$(LPOS),$(LIBSCSS))' \
	COMMONCSS_HTML \
	'$(patsubst %.uncompressed.css,$(LPRE)%.min.css$(LPOS),$(COMMONCSS))' \
	> $@

# Making release 

#		--source-map $(patsubst %.js,%.map,$@) \
#		--beautify \

%.min.js : %.uncompressed.js
	uglifyjs \
		--compress \
		--define DEBUG=false \
		-o $@ \
		-- $^

%.min.css : %.uncompressed.css
	echo "" > $@; \
	$(patsubst %,cleancss %>>$@;,$^)

release: $(subst uncompressed,min, $(COMMONJS)) \
	 $(subst uncompressed,min, $(LIBSJS)) \
	$(patsubst %,%.html,$(STORES))
	@echo "Done"

# Other targets

clean:
	rm -f *~
	rm -f libs/*.min.*
	rm -f *.min.*
	rm -f *.html
	rm -f *.map

eslint: *.uncompressed.js
	eslint --config package.json $^

locale/%.json: *.uncompressed.js Squirrel.html.src Makefile translate.pl
	perl translate.pl $@ *.uncompressed.js Squirrel.html.src

.SECONDEXPANSION:
upload: \
	$(patsubst %,%.html,$(STORES)) \
	$(subst uncompressed,min,$(COMMONJS)) \
	$(subst uncompressed,min, $(LIBSJS)) \
	$(patsubst %.uncompressed.css,%.min.css,$(COMMONCSS)) \
	$(patsubst %.uncompressed.css,%.min.css,$(LIBSCSS)) \
	$(wildcard images/*) \
	$(wildcard libs/images/*) \
	$(wildcard libs/*.swf) \
	$$(subst uncompressed,min,$(patsubst %,$$(%JS),$(STORES)))
	./upload.pl $^

