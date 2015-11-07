Introduction
============

Overview
-----------

LexaVideo provides the source code for running a fully responsive web-app that features real-time browser-based 
video conferencing and text chat.

This software relies on WebRTC for the video functionality, and is built using AngularJS and Python. 
This software runs on Google AppEngine.

Demo
----
LexaVideo was originally developed for ChatSurfing.com. Check out ChatSurfing.com 
for an active demo of this source code in action.


Quick Start
===========

Before running LexaVideo
------------------------

Lexalink requires that Python and the Google AppEngine are installed on your local computer. 
This software was tested with AppEngine release 1.9.20, and Python 2.7

Lexavideo uses yeoman, grunt, and bower as part of our build system. Make sure that you have node.js installed, and 
are able to execute grunt.   

How to run LexaVideo
--------------------

LexaVideo has been tested on OSX and Linux. Use a unix shell to execute the following commands:

  1. In the first unix shell, cd into the client directory, and then run 'grunt serve'. If you forget to do this,
  then you may not be able to load css files and other strange behaviour may happen. 
  2. In a second unix shell, from the project base directory, run './run_app.py .' (don't forget the '.' at the end).
  3. In your browser, open localhost:8080


Code Structure
==============

### Server-side Code
The server-side (python) code is contained in the 'video_src' directory

### Client-side Code
The client-side code is located in the 'client/app' directory. Within this directory, you will find the following 
directories of interest:
  1. bower_components: Contains AngularJS, Bootstrap, and many other open-source projects that we rely on.
  2. images: Logos, icons, etc. 
  2. lx-templates: Our custom html templates.
  3. scripts: The directory that contains the client-side javascript code. This is broken into sub-directories that 
  follow AngularJS terminology.
  4. sounds: This contains mp3 sounds that are not currently used.
  5. styles: The SASS (CSS) styles that define how our website looks.
  
Here you will also find index.html, which is the parent html file that imports all javascript, css, and other html.

Releasing code to a production server
=====================================

While it is possible to directly upload code that runs directly from the 'client/app' directory (where we 
have our client-side 'source' files, for performance reasons 
this is not advisable. Instead one should ensure that files that will be used in production are combined, 
minimized, and compressed. This is where grunt is very helpful, and where we have provided scripts to help ensure 
that optimized files are updated.

From the project home, you can execute the file 'build_app.py', which will modify the app.yaml to use files in the 
'client/dist' directory instead of the 'client/app' directory. Note: this script requires that 
DEBUG_BUILD=False (don't worry if you forget, you will get a warning), which can be 
modified in build_config.py. Warning: if you change DEBUG_BUILD to be False, then next time you are editing and testing
'client/app' files, the files will not be used because you will be accessing files in the 'client/dist' directory instead of the 
'client/app' directory. After uploading code to the server, set DEBUG_BUILD=True. Do not manually edit files in the 
'client/dist' directory, as this is over-written by our build scripts.
 
