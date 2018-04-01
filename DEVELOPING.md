## Developers

Developers must be able to run the following:
- GNU `make`
- `uglifyJS` (requires node.js)
- `perl`

You are welcome to push proposals for changes/fixes to github.

Squirrel incorporates support for translation of all user messages to
languages other than English. The configured language in your browser
is used to determine which translation to use (if available).

Translations are simply mappings from the English string to the equivalent
in the other language, using the symbols $1, $2 etc to indicate parameters
such as key names. Currently a single (google) translation is provided as an
example, in the file `locale/fr.json`

To generate (or refresh) a translation for a language, for example German
(language code de):
- clone the repository
- `make locales/de.json`
- manually edit the `locales/de.json` file

Making a translation will also generate a file called `strings.txt`
which is convenient for pasting into Google Translate as a crude starting
point.

The `upload.pl` script is provided for those who want to upload a
production version to an FTP site. See the `upload` target in the `Makefile`.

There is a directory of tests focused on the store implementations,
in an HTML file per store. These tests files all use a common test script,
`storetests.js`. Load the files into the browse (note that the dropbox and
drive tests require valid redirects to be set up in the application).

Two additional HTML files, `steg.html` and `aes.html` are used for testing
steganography and encryption modules respectively.

# Hosting Squirrel on other sites

By default Squirrel is configured to be served only from my own site, using
the OAuth2 identification parameters set up for this site with various
storage providers. If you prefer to host Squirrel on a different site, this
is fairly easy to set up.

## Google Drive

In the Google Drive API console https://console.developers.google.com/project
you need to create a new project. In the "APIs" section, enable the "Drive" API.
In the "Credentials" section find the Client ID and replace the CLIENT_ID
in GoogleDriveStore.uncompressed.js. Configure the "Javascript origins"
to point to your site.

You can test using `test/drive.html`.

When you are ready, `make drive.html`

## Dropbox

In the Dropbox App Console https://www.dropbox.com/developers/apps you will
need to create a new application. You need one piece of information, the
App key. Copy this and replace the APP_KEY constant in
DropboxStore.uncompressed.js.

You will also have to configure appropriate an Oauth2 redirect URL to point
to dropbox.html (which must be hosted on an `https:` server.)

You can test using `test/dropbox.html`

When you are ready, `make dropbox.html`.

## Debugging on Android

https://developers.google.com/web/tools/chrome-devtools/remote-debugging/

`http://192.168.1.11/Squirrel/Squirrel.html?debug=1&plaintext=1`

### URL parameters

`debug=1` for console messages

`plaintext=1` for unencrypted store

`dumpcloud=1` to dump the cloud
