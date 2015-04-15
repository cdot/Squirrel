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