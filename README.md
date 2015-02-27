Welcome to Squirrel

Most people have realised by now that to enjoy full online security they need to have a different password for each site they visit, and those passwords need to be long, complex and changed regularly. This creates a problem - how to remember this plethora of passwords and other security information demanded by these sites? So people often have a place - electronic or physical - where they write down their passwords. An electronic document is a really bad idea, but a physical book is as secure as anything else in your house or office, so can't easily be hacked. At the same time it's bad, because you depend on having physical access to the book.

Enter the concept of a "password safe". This is a software tool that stores your passwords under the shelter of a single master password. Some of these safes only work online (and cost money), some of them only work if you install software on your computer. Some are very clever, some not so much. Some cost money, some are free. An excellent free tool is Password Safe http://passwordsafe.sourceforge.net/

These tools have some problems:
   - Exclusively online tools require access to the internet to use
   - Online tools (usually) cost money
   - Personal tools require software to be installed to your computer
   - It's hard to share between platforms with personal tools (though some have mobile apps, for example)

Squirrel is different. Squirrel:
   - runs entirely in the browser, so nothing needs to be installed
   - encrypts *everything* that it stores, sends or receives
   - doesn't require a special website to store stuff (it can use a number of different online cloud services as a store, and you can even add more)
   - uses 256 bit AES, one of the toughest ciphers to crack
   - caches your encrypted password safe locally, so you don't need to be online to use it
   - works with all modern browsers
   - is entirely open source, allowing you to inspect, and if you want, modify the code
   - doesn't have any way for users - or even developers - to access the data without your unique password
   - is simple to use

In the past browsers have often been highlighted as the source of security problems. As a result, modern browsers are very well designed and, if used properly, offer a very secure environment in which to run software.

Security risks

Despite what "they" tell you, no software is guaranteed 100% secure. There are always risks - human and computer - in using any software. A big part of managing the risks is understanding what they are.

   - your master password might be guessed, or gathered in some way (e.g. by a key logger, or someone watching over your shoulder)
   - the place where you get Squirrel from might be compromised (phishing)
   - your online safe store might be compromised
   - your browser might be compromised

Possible enhancements:

Password change reminders
Remember password constraints for a site
Alert if the wrong password is used
Different stores (SkyDrive?)