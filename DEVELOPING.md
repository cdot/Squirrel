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
- idenitfy the ISO-639-1 https://en.wikipedia.org/wiki/List_of_ISO_639-1_codes code for the required language e.g. 'fr`, `ab'. You can optionally use a localisation e.g. `zh-cn`
- node build-dist.js -l xx -t 0
to generate initial translations or provide missing translations. To correct an existing translation, use a text editor to edit the `locale/xx.json' file. If a string is not present in a translation, Squirrel will fall back to English.

# Testing

## Unit tests

There is a directory of unit tests in `js/test'. These tests are written using the `Mocha' framework. Use `node' to run the tests.

## Browser testing

The easiest way to test Squirrel in the browser is to use a local server
with `HttpServerStore' or `WebDAVStore'. See README.md for more on running
the stand-alone server, which was designed with this specific purpose in mind.

# Debugging

The easiest way to debug is to use a local server with a plain text
(unencrypted) store:

`http://192.168.1.11/Squirrel/Squirrel.html?debug;use

To debug using a plain text HttpServerStore:

`http://192.168.1.11/Squirrel/Squirrel.html?debug&use=&store=HttpServerStore&store_url=http://192.168.1.11:3000/remote_data`

## Debug URL parameters
- `debug=1` sets `global.DEBUG' to enable detailed console messages
- `plaintext=1` for an unencrypted store
- `dumpcloud=1` to dump the cloud. This can be useful when you have a problem with an encrypted store.

## Debugging on Android

Use remote debugging on your Android device. This is described in https://developers.google.com/web/tools/chrome-devtools/remote-debugging/

## Coverage
The `c8' coverage tool is specified as a development dependency.

## npm-check
Use `npm-check' to make sure npm modules are up to date.

# Hosting Squirrel on other sites

Some stores require OAuth2 authentication. Squirrel by default is configured
to be served from the `rawgit' CDN when using these stores. If you prefer to
host Squirrel on a different site, you will have to change the OAuth2
identification.

## Google Drive

In the Google Drive API console https://console.developers.google.com/project
you need to create a new project. In the "APIs" section, enable the "Drive" API.
In the "Credentials" section find the Client ID and replace the CLIENT_ID
in `js/GoogleDriveStore.js'. Configure the "Javascript origins"
to point to your site.

## Dropbox

In the Dropbox App Console https://www.dropbox.com/developers/apps you will
need to create a new application. You need one piece of information, the
App key. Copy this and replace the APP_KEY constant in
`DropboxStore.js'.

You will also have to configure appropriate an Oauth2 redirect URL (which
must be hosted on an `https:` server.)

# Cookies

Squirrel uses a number of client-side cookies as follows:

`ui_theme' contains the name of the select jQuery UI theme
`ui_scale' contains the UI scale set by the user to increase/decrease font size
`ui_autosave' contains the user's preference for automatic saves

These cookies are not passed to the server.
