# Set this to "true" to compile with steganography. Steganography is
# useful to help obscure the database stored in the cloud - for example
# if your cloud store is open to public view - but is expensive, and
# should not be enabled unless you really need it.
USE_STEGANOGRAPHY := false

# Sources specific to different stores
STORES := dropbox drive tester

dropboxJS := \
	libs/dropbox.uncompressed.js \
	DropboxStore.uncompressed.js

driveJS := \
	GoogleDriveStore.uncompressed.js

testerJS := \
	TestStore.uncompressed.js

# Sources specific to the mobile platform
MOBILEHTML := \
	mobile/Squirrel.html.src

# Sources specific to the desktop platform
DESKTOPJS := \

ifeq ($(USE_STEGANOGRAPHY),true)
COMMONJS += \
	common/Steganographer.uncompressed.js \
	common/StegaStore.uncompressed.js
START_STEG = '<!--Steganography-->'
END_STEG = '<!--/Steganography-->'
else
START_STEG = '<!--Steganography'
END_STEG = '/Steganography-->'
endif

%.map %.min.js : %.uncompressed.js
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

#########################################
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
	USE_STEGANOGRAPHY '<script type="text/javascript">const USE_STEGANOGRAPHY=$(USE_STEGANOGRAPHY);</script>' \
	STEGANOGRAPHY $(START_STEG) \
	YHPARGONAGETS $(END_STEG) \
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

