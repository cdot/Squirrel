## Developers

You are welcome to submit pull requests with proposals for changes/fixes.

# Translations

Squirrel incorporates support for translation of all user messages to
languages other than English.

Translations are simply mappings from the English string to the equivalent
in the other language, using the symbols $1, $2 etc to indicate parameters
such as key names. Initial translations are generated using
http://api.mymemory.translated.net

To generate (or update) a translation for a language, for example German
(language code de):
- clone the repository
- identify the ISO-639-1 https://en.wikipedia.org/wiki/List_of_ISO_639-1_codes code for the required language e.g. 'fr`, `ab'. You can optionally use a localisation e.g. `zh-cn`
- node build-dist.js -l xx -t 0
to generate initial translations or provide missing translations. To correct an existing translation, use a text editor to edit the `locale/xx.json' file. If a string is not present in a translation, Squirrel will fall back to English.

# Testing

## Unit tests

There is a directory of unit tests in `js/test/*.ut'. These tests are written using the `Mocha' framework. Use `node` to run the tests, or `make` in the root.

## Browser testing

The easiest way to test Squirrel in the browser is to use a local server
with `HttpServerStore` or `WebDAVStore`. See `README.md` for more on
running the stand-alone server, which was designed with this specific purpose in mind.

# Documentation

`make doc` will extract the code HTML documentation in `doc/index.html`.

# Debugging

The easiest way to debug is to use a local server running on port 3000
with a plain text (unencrypted) store. Run the server with:

```
$ node js/web_server.js
```
and in the browser visit:

`http://localhost:3000/Squirrel/Squirrel.html?debug&use=&store=HttpServerStore&url=http://localhost:3000`

## Debug URL parameters
* `debug=1` to enable detailed console messages
* `plaintext=1` for an unencrypted store
* `dumpcloud=1` to dump the cloud. This can be useful when you have a
problem with an encrypted store.

## Module versions
`make update` will automatically update `node.js` module dependencies
for you. Note that version dependencies on third-party modules in HTML
and `js/main.js` have to be updated manually.

# Hosting Squirrel on other sites

Some stores require OAuth2 authentication. Squirrel by default is configured
to be served from github pages when using these stores. If you prefer to
host Squirrel on a different site, you will have to change the OAuth2
identification.

## Google Drive

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

These cookies are not passed to the server.
