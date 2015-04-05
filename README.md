# Welcome to Squirrel

Most people have realised by now that to enjoy full online security they need to have a different password for each site they visit, and those passwords need to be long, complex and changed regularly. This creates a problem - how to remember this plethora of passwords and other security information demanded by these sites? So people often have a place - electronic or physical - where they write down their passwords. An unencrypted electronic document is a really bad idea. A physical book is as secure as anything else in your house or office, so can't easily be hacked, but you depend on having physical access to the book.

An excellent free tool that solves this problem the passwdsafe family. This toolset supports most of the features we might require, but falls down in a coupld of key areas:
   - It requires software to be installed to your computer
   - That software has to be maintained and upgraded each time your operating system changes
   - It can be complex to set up sharing between platforms (though some have mobile apps, for example)
   - It's obvious to an attacker when it is being used

Enter Squirrel. Squirrel:
   - runs entirely in the browser, so nothing needs to be installed, and the same code is used on all platforms
   - doesn't require an internet connection to run
   - encrypts *everything* that it stores, sends or receives
   - doesn't require a special website to store stuff (it can use a number of different online cloud services as a store, and you can even add more)
   - uses 256 bit AES (Rijndael), one of the toughest ciphers to crack
   - uses steganography to mask its use
   - caches your encrypted safe locally, so you don't need to be online to use it
   - works with all modern browsers
   - is entirely open source, allowing you to inspect, and if you want, propose modifications to the code
   - doesn't have any way for users - or even developers - to access the data without your unique password
   - is simple to use

Additional features include:
   - Reminders for when you think passwords need to be changed
   - Built-in random password generator
   - Export to, or import from, JSON
   - Implemented entirely in industry-standard HTML5 Javascript and jQuery

## Security risks

In the past browsers have often been highlighted as the source of security problems. As a result, modern browsers are under constant scrutiny and are very well designed. If used properly, they offer a very secure environment in which to run software.

Squirrel doesn't store your password, nor does it transmit your password over the internet. Is it extremely difficult to extract your password from your stored data (if you forget your password, no-one can help you, so don't forget it). So the major risks you should be aware of are:
- compromised browser (someone has installed a hacked version of the browser)
- compromised operating system
- compromised software source (the place you got Squirrel has been hacked)
- man-in-the-middle attacks, which have compromised the code

These are basically all the same risks all other online tools face.

## Some tips on passwords

The algorithm Squirrel uses to store data is very secure, and the only known way to crack it in finite time is to guess your password. So:
- make your passwords hard to guess
"Hard to guess for a computer" doesn't mean the same thing as "hard to guess" for a human. Computers can rapidly test millions of passwords in an attempt to find yours. Things that can help computers do this are using things such as real words, people and place names, dates, telephone numbers - all be tested by password crackers. Some people seem to believe that substituting numbers or punctuation for letters - for example, using "0" in place of "O" or "$" in place of "S" - somehow makes their password more secure. If does, a tiny bit, but not enough for it to be a good idea. Hackers know how people think, so try not to think like a person when choosing a password.
- avoid using real words, names, dates, telephone numbers
- substituting numbers or punctuation for letters doesn't work very well
Your master password needs to be as hard as possible for a computer to crack. Ideally you will choose a long string of random characters, though that might be too hard to remember.
- A long string of random characters is best
Despite what many IT departments tell you, writing down your password isn't a bad idea, just so long as you make sure that the physical security of what you have written is very strong.
- writing down a very strong password may not be a bad idea

Ultimately I'm not going to tell you my best password tips, because I'd be giving away my own secrets. But if you follow the tips above, you should be able to come up with something pretty good. The password generator built into Squirrel generates very strong passwords.

## Using Squirrel

Using Squirrel is as easy as visiting the Squirrel page that corresponds to
the cloud service you want to use (currently Dropbox or Google Drive). Once
the sources have been cached in your browser, there is no need to worry about
them again.

Before you use Squirrel for the first time, you need to upload an image to
your chosen cloud store provider. Your password safe will be embedded into
this image, so it needs to be readable and writable, and needs to be large
enough to store all the data. For an average sized password store, a 1024x768
colour image will usually suffice.

Run Squirrel by loading the HTML file that corresponds to your cloud provider
(e.g. dropbox.html). You will be prompted for the name of the image you
uploaded. Squirrel will then ask you for your encryption password. Once in,
you are presented with a simple interface where you can create keys (and keys
within keys), and add data associated with those keys. Double-click a key to
edit it, or use right click (or long tap/long hold) to pull down a menu of
options.

After your first run, Squirrel will not ask you for the image again. You can
change what image is used at any time using the 'Extras' menu.

## Developers

Developers must be able to run the following:
- GNU `make`
- `uglifyJS` (requires node.js)
- `perl`

You are welcome to push proposals for changes/fixes to github.

Squirrel incorporates support for translation of all user messages. The
configured language in your browser is used which translation to use.

Translations are simply mappings from the English string to the equivalent
in the other language, using the symbols $1, $2 etc to indicate parameters
such as key names. Currently a single (google) translation is provided as an
example, in the file `locales/fr.json`

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

## About Squirrel

Squirrel was written by Crawford Currie http://c-dot.co.uk, and uses the following 3rd party libraries:

- JQuery & JQuery UI, from the JQuery Foundation, https://jquery.org
- AES implementation in JavaScript (c) Chris Veness 2005-2014, http://www.movable-type.co.uk/scripts/aes.html
- jquery-bonsai, Copyright (c) 2014 Simon Wade, http://aexmachina.info/jquery-bonsai
- jquery-contextmenu, Copyright 2013-2015 Martin Wendt and others, https://github.com/mar10/jquery-ui-contextmenu
- ZeroClipboard, Copyright (c) 2009-2014 Jon Rohan, James M. Greene, http://zeroclipboard.org/
- steganography.js, Copyright (C) 2012, Peter Eigenschink, http://www.peter-eigenschink.at/
- Dropbox API, Copyright (c) 2012 Dropbox, Inc., http://www.dropbox.com
- Google Drive API




