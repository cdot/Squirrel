# Welcome to Squirrel

In these days of data loss and identify theft it is critically
important to take care of your personal information. Most people have
realised by now that for security they need to have a different
password for each site they visit, and those passwords need to be long,
complex and changed regularly, or they become too easy to crack.

In a misguided attempt to make password management easier, many sites
also ask for "memorable information", such as your mother's maiden
name, or your first pet's name. But it only takes one site to be
hacked, or a leaky Facebook profile, or a slip of the tongue, and your
mother's maiden name is public knowledge. So really, you should never
ever share any personal information with a site. Instead, you should
prefer fake information that has been generated specifically for use
with that one site, and never used elsewhere.

That's a lot of secret information! How can we be expected to remember it
all? Answer - we can't. So most people have a place - electronic or
physical - where they write down their passwords. An unencrypted
electronic document is a really, really, bad idea. A physical book is
as secure as anything else in your house or office, so can't easily be
hacked, but you depend on having physical access to the book. What you
really want is an online password safe - somewhere where passwords can be
stored together, that is accessible from all your devices and from anywhere,
but is highly secure.

There are excellent free tools that solve this problem already. So why
use Squirrel?
   - it runs entirely in the web browser, so nothing needs to be installed
   - it works on anything that has a reasonably modern browser (including those on mobile devices)
   - it doesn't require an internet connection to run
   - it encrypts *everything* that it stores, sends or receives
   - it doesn't require a special website to store stuff (it can use a number of different online services, and you can even add more)
   - it uses AES, one of the toughest ciphers to crack
   - it can use image steganography to mask its use
   - it's entirely open source, allowing you to inspect, and if you want, propose modifications to, the code
   - it doesn't have any way for users - or even developers - to access the data without your unique password
   - it's simple to use

Additional features include:
   - Reminders for when you think passwords need to be changed
   - Built-in random password generator
   - Export to, or import from, JSON
   - Implemented entirely in industry-standard HTML and Javascript

## Getting started

Getting started with Squirrel is as simple as visiting the web address
of the site where the code is stored. We use the 'github pages'
CDN (content delivery network) that gets the code currently checked into
the git repository, https://cdot.github.io/Squirrel, but you are welcome
to make your own copy and host it on your own trusted server.

Run it from 'github pages' by loading the following URL into your browser (using GoogleDriveStore as an example):

https://cdot.github.io/Squirrel/release/Squirrel.html?store=GoogleDriveStore

The following URL parameters are available:
- `store=<store name>' required to set the file store to use (default is `LocalStorageStore', the example above uses `GoogleDriveStore`)
- 'use=' to specify the encryption algorithm. The default is `use=aes`, and you can disable encryption entirely (for debugging) by passing `use` with no value. You can layer multiple algorithms by separating them with commas e.g. `use=aes,steganography`. Note that the same algorithms are used for both cloud and local stores.
- 'debug' to enable verbose debug output to the console
- 'url=<store url>' is required by some stores

## Choosing a File Store

Squirrel normally stores its database in a single online file. It's up
to you which file store you use. We recommend:
* If you have your own web server:
 * If it supports WebDAV, use `WebDAVStore`
 * If you have a web server (e.g. Apache, nginx, lighttpd etc) with CGI and a back-end script that supports PUT requests, you can use `HttpServerStore`
* If you want your own internet-accessible machine but don't want to bother installing Apache/nginx etc:
 * If you have `node.js` on your server host, you can use `HttpServerStore` withthe included `web_server.js`
* If you prefer to use a publicly available service, use `GoogleDriveStore` (not available in China)
* If you don't want to use an online store, you can use `LocalStorageStore`, which simulates the online store in the browser. However you won't be able to share your store with other devices.

### GoogleDriveStore

You must be logged in to Google in the browser for this to work. The
first time you open Squirrel with GoogleDriveStore, it will prompt for
the path to your database file. This is simply the name of a file where
encrypted data will be stored on Drive.

Squirrel will prompt for a password every time you open it. This is
the encryption password for your database, and should not be the same
as your Google password.

### HttpServerStore

This store will work with any HTTP server that supports `GET` and `POST`
requests and `BasicAuth`, and permits writing files on the server.

You need to tell Squirrel where to look for the server. The following
additonal URL parameters are used:

`url` - full URL pointing to the server location where Squirrel
may save files.

For example, if the server is running on `https://myserver/my/files'
you would use:

`?store=HttpServerStore&url=https://myserver/my/files`

Note that it uses Basic Authentication and should only ever be used with
an `HTTPS` server.

#### web_server.js

A suitable super-lightweight server using `node.js` is provided as part of the
 package.

For information on how to run the lightweight server, `cd` to the `js` directory and:

```
node web_server.js --help
```

The same server can serve the Squirrel application from a git checkout. Start the server as described above at the root of the checkout, then use a URL like this:

`https://myhost:3000/Squirrel.html?store=HttpServerStore&url=https://myhost:3000/remote_data`

### LocalStorageStore

You may not want to use a Cloud store, but store your password safe locally in
the machine where the browser is running. This file store lets you do that, however
you will not be able to share the database with other machines.

### WebDAVStore

If you have access to a web server that supports the WebDAV protocol, you
can use it with Squirrel. You will need to pass the URL of a WebDAV-accessible
folder using the `url` parameter.

## Choosing an Encryption Algorithm
The encryption algorithm is selected using the `use` parameter. There are two algorithms available, `crypto` and `steganography`. These algorithms can be used individually, or can be combined e.g. `use=crypto,steganography`. You can also switch off encryption completely using `use=` with no value.

### Crypto
This is the default if no `use` parameter is given, It uses AES in GCM mode for a very good level of encryption.

### Steganography

This is not encryption per se, it is data-hiding. Your data is embedded into
extra bits in an image such that the image appears normal to the naked eye, but has your secret message embedded within it. You can use it alongside another algorithm e.g. `use=crypto,steganography`

Steganography is expensive, but may be a viable alternative to encryption
in regions where encryption is illegal. If you run with steganography enabled,
you will need to choose an image URL for Squirrel to use.
Your password safe will be embedded into this image, so it needs to be large
enough to store
all the data without degrading the image too much. For an average
sized password store, a 1024x768 RGB colour image will usually
suffice. If you are changing the content of your database regularly,
it's a good idea to change the image you use on a regular basis as you
may otherwise leave traceable usage patterns (e.g. by updating the
same image frequently with different binary content but no obvious visual
change).

### Once you have chosen a store

A Squirrel store is rather like a traditional computer file system,
which contains *folders* and *values*. A folder can contain other
folders and values. A value is simply a text string. Values are
used to record important information such as usernames and passwords,
while folders are provided to help you organise all this information.

When you first open a new database you will just see a search bar and the
word "Squirrel". You add new folders by right-clicking (long press on
mobile devices) on the "Squirrel" and selecting "Add new folder" from
the pop-up menu. Enter a name for the folder, OK, and then click on
the spot icon to the left of the name of the new folder to open it.

Now right-click (or long press) on the name of the folder. You will
see a pop-up menu. Select "Add new value" and enter the name and
value.

Double-click (or double-tap) on a name or a value to edit it. You can
copy the value from inside the editor.

And that's about it - you can find out the rest by experimenting.

## Security risks

Once it's stored in a Squirrel database with strong encryption, your
secret data is as secure as it
gets. The weak point of any password safe application is the master
password - if a hacker can guess that, then it's game over. So:
- make your Squirrel master password hard to guess

See "Some tips on passwords" below for more.

In the past browsers have often been highlighted as the source of
security problems. As a result, modern browsers are under constant
scrutiny and are very well designed. If used properly, they offer a
very secure environment in which to run software.

Squirrel is designed to work in a well defined environment:
- Served from a totally trusted website
- Using SSL (https:) communications
- With an uncompromised, modern browser

Squirrel doesn't store your password, nor does it transmit your
encyrption password over the internet. Is it extremely difficult to extract your
password from your database (if you forget your password, no-one
can help you - so don't forget it). The major risks you should be
aware of are:
- compromised browser (someone has installed a hacked version of the browser)
- compromised operating system
- compromised software source (the place you got Squirrel has been hacked)
- man-in-the-middle attacks, which have compromised the code

These are basically all the same risks all other online tools face.

Data stored on the web is exposed to other risks, such as security
agencies taking an interest in why you are storing encrypted data. For
most of us this isn't a problem, but there are areas of the world
where the use of encryption is frowned upon. For this reason, Squirrel
can use image steganography to mask the use of encryption. The
algorithm used is proprietary, and we believe it is difficult to
detect its use, given a sufficiently complex image.

## Some tips on passwords

"Hard to guess" for a computer doesn't mean the same thing as "hard to
guess" for a human. Computers can rapidly test millions of passwords
in an attempt to find yours. The simplest attack uses "brute force" to
try and guess your password. This involves the computer generating
every possible password, and trying each of them until it finds yours.
Of course this is hugely expensive in terms of computer time - to find
an average 12 character password this way would require hundreds of
years. But hackers know that people are very predictable, so they use
some sneaky tricks.

The first sneaky trick is to use what is known as a "dictionary
attack".  For this, the computer will test your password for real
words from the dictionary, either singly or in combinations. Many
people create memorable passwords by combining words (or names), and
these are highly susceptible to this kind of attack.
Some people think that substituting numbers or punctuation for letters
- for example, using "0" in place of "O" or "$" in place of "S" - in a
memorable password somehow makes their password more secure. It does,
a little bit, But it has limited value defending against a dictionary
attack - hackers are people, and know how people think.

The second sneaky trick is to personalise the attack. If the hacker has
some information about you already - such as childrens or pets names,
or car number plates, or telephone numbers, these will be added to the
dictionary.

So, what is a "strong" password? Given enough time, any password can be
cracked. However we can make the hacker's job as hard as possible.

- a long string of random characters is best
- the longer the better
- the less memorable, the better
- avoid using real words, names, dates, telephone numbers, car number plates
- substituting numbers or punctuation for letters doesn't work very well

Despite what many IT people may tell you, writing down your password isn't a bad idea, just so long as you make sure that the physical security of what you have written is very strong.
- writing down a very strong password may not be a bad idea

If you follow the tips above, you should be able to come up with something pretty good. The password generator built into Squirrel can generate very strong passwords for you.

Further reading can be found in a series of blog posts from the UK's NCSC unit:
https://www.ncsc.gov.uk/guidance/password-guidance-simplifying-your-approach
https://www.ncsc.gov.uk/blog-post/what-does-ncsc-think-password-managers


Note that Squirrel uses state-of-the-art Javascript and HTML5, and
requires the latest browsers to run. If you are stuck with IE8, don't
even think about it :-(

## Developers
See https://github.com/cdot/Squirrel/blob/master/DEVELOPING.md

## About Squirrel

Squirrel was written by Crawford Currie http://c-dot.co.uk, and uses the
following 3rd party libraries:

- JQuery & JQuery UI, from the JQuery Foundation, https://jquery.org
- AES implementation in JavaScript, Copyright Chris Veness 2005-2014, http://www.movable-type.co.uk/scripts/aes.html
- jQuery UI contextmenu, by Martin Wendt, https://github.com/mar10/jquery-ui-contextmenu
- jQuery touch events, by Ben Major, https://github.com/benmajor/jQuery-Touch-Events
- Clipboard.js, by Zeno Rocha, https://clipboardjs.com/
- js-cookie, Copyright 2014 Klaus Hartl, https://github.com/js-cookie/js-cookie
- Dropbox API, Copyright 2012 Dropbox, Inc., http://www.dropbox.com
- Google Drive API
