# Welcome to Squirrel

Most people have realised by now that to enjoy full online security they need to have a different password for each site they visit, and those passwords need to be long, complex and changed regularly. This creates a problem - how to remember this plethora of passwords and other security information demanded by these sites? So people often have a place - electronic or physical - where they write down their passwords. An electronic document is a really bad idea, but a physical book is as secure as anything else in your house or office, so can't easily be hacked. At the same time it's bad, because you depend on having physical access to the book.

Enter the concept of a "password safe". This is a software tool that stores your passwords under the shelter of a single master password. Some of these safes only work online (and cost money), some of them only work if you install software on your computer. Some are very clever, some not so much. Some cost money, some are free. An excellent free tool is Password Safe http://passwordsafe.sourceforge.net/

These tools have some problems:
   - Exclusively online tools require access to the internet to use
   - Online tools (usually) cost money
   - Personal tools require software to be installed to your computer
   - It's hard to share between platforms with personal tools (though some have mobile apps, for example)

Squirrel is different. Squirrel:
   - runs entirely in the browser, so nothing needs to be installed
   - doesn't require an internet connection to run
   - encrypts *everything* that it stores, sends or receives
   - doesn't require a special website to store stuff (it can use a number of different online cloud services as a store, and you can even add more)
   - uses 256 bit AES, one of the toughest ciphers to crack
   - caches your encrypted safe locally, so you don't need to be online to use it
   - works with all modern browsers
   - is entirely open source, allowing you to inspect, and if you want, modify the code
   - doesn't have any way for users - or even developers - to access the data without your unique password
   - is simple to use

Additional features include:
   - Reminders for when you think passwords need to be changed
   - Built-in random password generator
   - Export to, or import from, JSON
   - Uses a "cloud store" to synchronise your safe between multiple computers.

## Security risks

In the past browsers have often been highlighted as the source of security problems. As a result, modern browsers are very well designed and, if used properly, offer a very secure environment in which to run software.

Squirrel doesn't store your password, nor does it transmit your password over the internet. Is it extremely difficult to extract your password from your stored data. If you forget your password, no-one can help you, so don't forget it.

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

Ultimately I'm not going to tell you my best password tips, because I'd be giving away my own secrets. But if you follow the tips above, you should be able to come up with something pretty good.

## Using Squirrel

Using Squirrel is as easy as visiting the Squirrel page that corresponds to
the cloud service you want to use (currently Dropbox or Google Drive). Once
the sources have been cached in your browser, there is no need to worry about
them again.

You must be logged in to your chosen cloud store provider. Squirrel will ask you for your encryption password. Once in, you are presented with a simple interface where you can create keys, keys within keys, and data associated with those keys. Double-click a key to edit it, or use right click (or long tap/long hold) to pull down a menu of options.

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
- Dropbox API, Copyright (c) 2012 Dropbox, Inc., http://www.dropbox.com
- Google Drive API




