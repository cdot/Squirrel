JS := $(shell find . \( -path './node_modules/*' -o -path './test/*' -o -path './dist/*' -o -path './doc/*' \) -prune -o -name '*.js' -print)

MD := $(shell find . \( -path './node_modules/*' -o -path './test/*' -o -path './dist/*' \) -prune -o -name '*.md' -print)

TESTS := $(shell find test \( -path './node_modules/*' -o -path './doc/*' -o -path './dist/*' \) -prune -o -name '*.ut' -print)

# Default target; run unit tests
tests: node_modules $(TESTS:.ut=.utr)

%.utr: %.ut
	node $^

node_modules:
	npm install

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
update: node_modules
	ncu -u

clean:
	rm -rf dist/* doc/*.html doc/fonts doc/scripts doc/styles
