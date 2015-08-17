STORES = dropbox drive tester

dropboxJS = \
	libs/dropbox.uncompressed.js \
	DropboxStore.uncompressed.js

driveJS = \
	GoogleDriveStore.uncompressed.js

testerJS = \
	TestStore.uncompressed.js

LIBSJS = \
	libs/jquery-2.1.3.uncompressed.js \
	libs/jquery.mobile-1.4.5.uncompressed.js \
	libs/aes.uncompressed.js

LIBSCSS = \
	libs/jquery.mobile-1.4.5.uncompressed.css \
	libs/jquery.mobile.external-png-1.4.5.uncompressed.css \
	libs/jquery.mobile.icons-1.4.5.uncompressed.css \
	libs/jquery.mobile.inline-png-1.4.5.uncompressed.css \
	libs/jquery.mobile.inline-svg-1.4.5.uncompressed.css \
	libs/jquery.mobile.structure-1.4.5.uncompressed.css \
	libs/jquery.mobile.theme-1.4.5.uncompressed.css

COMMONJS = \
	Utils.uncompressed.js \
	Translation.uncompressed.js \
	AbstractStore.uncompressed.js \
	LocalStorageStore.uncompressed.js \
	AES.uncompressed.js \
	EncryptedStore.uncompressed.js \
	Steganographer.uncompressed.js \
	StegaStore.uncompressed.js \
	Squirrel.uncompressed.js \
	Tree.uncompressed.js \
	ContextMenu.uncompressed.js \
	Pages.uncompressed.js \
	Hoard.uncompressed.js

COMMONCSS = \
	Squirrel.uncompressed.css

# Making debug
# e.g make dropbox.uncompressed.html
# make drive.uncompressed.html

SPRE=<script type="text/javascript" src="
SPOS="></script>
LPRE=<link rel="stylesheet" href="
LPOS=">

debug: $(patsubst %,%.uncompressed.html,$(STORES))

%.uncompressed.html : Squirrel.html.src $(COMMONJS)
	perl build_scripts/sub.pl Squirrel.html.src \
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
	perl build_scripts/sub.pl Squirrel.html.src \
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

%.map : %.min.js

%.min.js : %.uncompressed.js
	uglifyjs \
		--source-map $(patsubst %.min.js,%.map,$@) \
		--source-map-url $(patsubst libs/%,%, $(patsubst %.min.js,%.map,$@)) \
		--source-map-include-sources \
		--compress \
		--define DEBUG=false \
		-o $@ \
		-- $^

%.min.css : %.uncompressed.css
	echo "" > $@; \
	$(patsubst %,cleancss %>>$@;,$^)

release: $(subst uncompressed,min,$(COMMONJS)) \
	 $(subst uncompressed.js,map,$(COMMONJS)) \
	 $(subst uncompressed,min,$(LIBSJS)) \
	 $(subst uncompressed.js,map,$(LIBSJS)) \
	$(patsubst %,%.html,$(STORES))
	@echo "Done"

# Other targets

clean:
	find . -name '*~' -exec rm \{\} \;
	find . -name '*.min.*' -exec rm \{\} \;
	find . -name '*.map' -exec rm \{\} \;
	rm -f *.html

eslint: *.uncompressed.js
	eslint --config package.json $^

locale/%.json: *.uncompressed.js Squirrel.html.src
	perl build_scripts/translate.pl $(*F) *.uncompressed.js Squirrel.html.src

.SECONDEXPANSION:
upload: \
	$(patsubst %,%.uncompressed.html,$(STORES)) \
	$(patsubst %,%.html,$(STORES)) \
	$(subst uncompressed,min,$(COMMONJS)) \
	$(subst uncompressed.js,map,$(COMMONJS)) \
	$(subst uncompressed,min,$(LIBSJS)) \
	$(subst uncompressed.js,map,$(LIBSJS)) \
	$(patsubst %.uncompressed.css,%.min.css,$(COMMONCSS)) \
	$(patsubst %.uncompressed.css,%.min.css,$(LIBSCSS)) \
	$(wildcard images/*) \
	$(wildcard libs/images/*) \
	$(wildcard libs/*.swf) \
	$$(subst uncompressed,min,$(patsubst %,$$(%JS),$(STORES))) \
	$$(subst uncompressed.js,map,$(patsubst %,$$(%JS),$(STORES))) \
	$(COMMONJS) $(LIBSJS) $(COMMONCSS) $(LIBSCSS) $(driveJS)
	perl build_scripts/upload.pl $^

