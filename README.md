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
   - uses image steganography to mask its use
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

Data stored on the web is exposed to other risks, such as security agencies
taking an interest in why you are storing encrypted data. For most of us this
isn't a problem, but there are areas of the world where the use of encryption
is frowned upon. For this reason, Squirrel uses image steganography to store
data on the web. The algorithm used is proprietary, and we believe it is
difficult to detect its use, given a sufficiently complex image. Even if the
image steganography is decoded, the underlying data is AES encrypted and
just looks like random data.

## Some tips on passwords

The algorithm Squirrel uses to store data is very secure, and the only known
way to crack it in finite time is to guess your password. So:
- make your passwords hard to guess

"Hard to guess for a computer" doesn't mean the same thing as "hard to guess" for a human. Computers can rapidly test millions of passwords in an attempt to find yours. Things that can help computers do this are using things such as real words, people and place names, dates, telephone numbers - all be tested by password crackers.

Some people seem to believe that substituting numbers or punctuation for letters - for example, using "0" in place of "O" or "$" in place of "S" - somehow makes their password more secure. It does, a tiny bit, but not enough for it to be a good idea. Hackers know how people think, so try not to think like a person when choosing a password.
- avoid using real words, names, dates, telephone numbers
- substituting numbers or punctuation for letters doesn't work very well

Your master password needs to be as hard as possible for a computer to crack. Ideally you will choose a long string of random characters, though that might be too hard to remember.
- a long string of random characters is best.

Despite what many IT departments tell you, writing down your password isn't a bad idea, just so long as you make sure that the physical security of what you have written is very strong.
- writing down a very strong password may not be a bad idea

If you follow the tips above, you should be able to come up with something pretty good. The password generator built into Squirrel generates very strong passwords.

## Using Squirrel

Using Squirrel is as easy as visiting the Squirrel page that corresponds to
the cloud service you want to use (currently Dropbox or Google Drive). Once
the sources have been cached in your browser, there is no need to worry about
them again.

Before you use Squirrel for the first time, you need to choose an image from
your local drive. Your password safe will be embedded into
this image, so it needs to be large enough to store all the data without
degrading the image too much. For an average sized password store, a 1024x768
colour image will usually suffice. It's a good idea to change the image
you use on a regular basis (and change where it is stored) as you will otherwise
leave traceable usage patterns (e.g. by updating the same image frequently).

Run Squirrel by loading the HTML file that corresponds to your cloud provider.
If you are running from the built version on github, then https://cdn.rawgit.com/cdot/Squirrel/master/drive.html for the Google Drive build, and https://cdn.rawgit.com/cdot/Squirrel/master/dropbox.html for the Dropbox version.

You will be prompted for the encryption password you want
to use. The first time you run you will be asked for the image you want to
use, and the store path in the cloud.

You are then presented with a simple interface where you can create keys
(and keys within keys), and add data associated with those keys. Double-click
a key to edit it, or use right click (or long tap/long hold) to pull down a
menu of options. The cog wheel button can be used to access a menu of less-frequently used commands.

After your first run, Squirrel will not ask you for the image again. You can
change what image is used at any time using the cog wheel menu
(Change Store Settings).

Note that Squirrel uses state-of-the-art Javascript and HTML5, and requires
the latest browsers to run. If you are stuck with IE8, don't even think about
it :-(

## About Squirrel

Squirrel was written by Crawford Currie http://c-dot.co.uk, and uses the following 3rd party libraries:

- JQuery & JQuery UI, from the JQuery Foundation, https://jquery.org
- AES implementation in JavaScript, Copyright Chris Veness 2005-2014, http://www.movable-type.co.uk/scripts/aes.html
- jquery-bonsai, Copyright 2014 Simon Wade, http://aexmachina.info/jquery-bonsai
- jquery-contextmenu, Copyright 2013-2015 Martin Wendt and others, https://github.com/mar10/jquery-ui-contextmenu
- ZeroClipboard, Copyright 2009-2014 Jon Rohan, James M. Greene, http://zeroclipboard.org/
- Dropbox API, Copyright 2012 Dropbox, Inc., http://www.dropbox.com
- Google Drive API
