## Developers

Developers must be able to run the following:
- GNU `make`
- `uglifyJS` (requires node.js)
- `perl`

You are welcome to push proposals for changes/fixes to github.

# Translations

Squirrel incorporates support for translation of all user messages to
languages other than English. The configured language in your browser
is used to determine which translation to use (if available).

Translations are simply mappings from the English string to the equivalent
in the other language, using the symbols $1, $2 etc to indicate parameters
such as key names. Initial translations are generated using
http://api.mymemory.translated.net

To generate (or update) a translation for a language, for example German
(language code de):
- clone the repository
- `make locale/de.json`
- manually edit the `locale/de.json` file if necessary

Making a translation will also generate a file called `strings.txt`
which is convenient for pasting into Google Translate as a crude starting
point.

# Testing

## Unit tests

There is a directory of unit tests in `js/test'. These tests are written using the `Mocha' framework. APIs are used so use of the `mocha' command is optional (you can just use `node')

`make test'.

Browser tests - including those for the remote stores - are invoked in the browser via HTML files. Load the files into the browser (note that Dropbox and Google Drive tests require valid redirects to be set up in the application.)

## Browser testing

The easiest way to test Squirrel in the browser is to use a local server
with `HttpServerStore' or `WebDAVStore'. See README.md for more on running
the stand-alone server, which was designed with this specific purpose in mind.

# Debugging

The easiest way to debug is to use a local server with a plain text
(unencrypted) store:

`http://192.168.1.11/Squirrel/Squirrel.html?debug=1&plaintext=1`

To debug using a plaintext HttpServerStore:

`http://192.168.1.11/Squirrel/Squirrel.html?debug=1&plaintext=1&store=HttpServerStore&store_url=http://192.168.1.11:3000/remote_data`

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
