# Developers

You are welcome to submit pull requests with proposals for changes/fixes.

To create a development environment, first clone the repository from (github)[https://github.com/cdot/Squirrel]. Then `npm install` in the root of the repository to install third party modules.

# File structure

The installation has subdirectories as follows:
* `browser_tests` has browser tests (unsurprisingly)
* `build` has webpack stuff
* `css` contains style sheets
* `html` has the html for the user interfaces, `html/dialogs.html` th html for all dialogs
* `i18n` contains the master English `en.json`, `qqq.json` documentation, and any other contributed translations of the interface.
* `images` contains images used by the game
* `src` has all the source code
* `test` has all the unit tests and fixtures

# Building

The application will run in the browser simply by opening `index.html`. For release versions, use `npm run build` to build in a target directory e.g. `npm run build`.

Code documentation is built using `npm run doc`. The documentation will be generated in the `doc` subdirectory.

# Translations

Squirrel incorporates support for translation of all user messages to
languages other than English.

Translations are simply mappings from the English string to the equivalent
in the other language, using the symbols $1, $2 etc to indicate parameters
such as key names.

To generate (or update) a translation for a language, for example Ukranian:
- clone the repository
- identify the (ISO-639-1 code)[https://en.wikipedia.org/wiki/List_of_ISO_639-1_codes] for Ukranian (it's `uk`)
- copy `i18n/qqq.json` to `i18n/uk.json`
- edit `uk.json` as appropriate. Original English strings can be found in `en.json`.
- use `npm run tx` to check the translation is complete.

# Testing

## Unit tests

There is a directory of unit tests in `js/test/*.ut'. These tests are written using the `Mocha' framework. Use `make` in the root to run the tests.

## Browser testing

The easiest way to test Squirrel in the browser is to use a local server
with `HttpServerStore` or `WebDAVStore`. See `README.md` for more on
running the stand-alone server, which was designed with this specific purpose in mind.

# Code Documentation

The code is documented using (jsdoc)[https://jsdoc.app/].
`npm run doc` will extract the code HTML documentation in `doc/index.html`.

# Debugging

The easiest way to debug is to use a local server running on port 3000
with a plain text (unencrypted) store. Run the server with:
```
$ npm run server
```
and in the browser visit:

`http://localhost:3000?debug=1&store=HttpServerStore&url=http://localhost:3000`

# Debug URL parameters
* `debug=1` to enable detailed console messages
* `plaintext=1` for an unencrypted store
* `dumpcloud=1` to dump the cloud. This can be useful when you have a
problem with an encrypted store.

# Module versions
`npm` is use for maintaining third party modules, both for the server (which runs under `node.js` but also for the browser. `npm run update` will automatically update `node.js` module dependencies
for you. Note that version dependencies on third-party modules in HTML
and `js/main.js` have to be updated manually.

# Google Drive

In the Google Drive API console https://console.developers.google.com/project
you need to create a new project. In the "APIs" section, enable the "Drive" API.
In the "Credentials" section find the Client ID and replace the CLIENT_ID
in `js/GoogleDriveStore.js'. Configure the "Javascript origins"
to point to your site.

# Cookies

Squirrel uses a number of client-side cookies as follows:

* `ui_theme` contains the name of the select jQuery UI theme
* `ui_scale` contains the UI scale set by the user to increase/decrease font size
* `ui_autosave` contains the user's preference for automatic saves
* `ui_lang` contains the last selected UI language
* `ui_hidevalues` is set to `on` to hide values in the interface
* `ui_showchanges` is set `on` to show changes
* `ui_randomise` can be set to a JSON string defining default random value constraints e.g. `{"size":10,"chars":"A-Z0-9"}`
These cookies are not passed to the server.
