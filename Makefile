JS := $(shell find . \( -path './node_modules/*' -o -path './test/*' -o -path './dist/*' -o -path './doc/*' \) -prune -o -name '*.js' -print)

MD := $(shell find . \( -path './node_modules/*' -o -path './test/*' -o -path './dist/*' \) -prune -o -name '*.md' -print)

release: $(JS)
	node build-dist.js

# Make HTML source-code documentation
doc: doc/index.html

doc/index.html: $(JS) $(MD)
	node_modules/.bin/jsdoc -c doc/config.json -d doc $(JS)

lint:
	node node_modules/.bin/eslint $(JS)

# Update package.json with latest packages
# using npm-check-update (npm install -g npm-check-updates)
update:
	ncu -u
