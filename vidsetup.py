#!/usr/bin/python

import os, datetime, re, codecs, subprocess, logging


VERSION_ID = "2014-09-12-0324"

# The following must be set to False before uploading - this will combine and minimize javascript 
# and css files. This combining/minimizing is only done on upload or on  development server initialization, so this will
# mask any changes that are made to jss/css between server restarts -- therefore this value 
# should be set to True for developing/debugging js/css on the local development server (the original
# js/css files will therefore be accessed instead of the combined/minimized js/css files).
DEBUG_BUILD = True

if  DEBUG_BUILD:
    BASE_STATIC_DIR = "client/app"
    STYLES_STATIC_DIR = "client/.tmp/styles"
    RUN_GRUNT = False
    
else:    
    BASE_STATIC_DIR = "client/dist"
    STYLES_STATIC_DIR = "client/dist/styles"
    RUN_GRUNT = True
    

ENABLE_LIVE_RELOAD = True    
if not DEBUG_BUILD:
    # We don't want to upload code to the server with live-reload enabled, so turn it off unless we 
    # are debugging code.
    ENABLE_LIVE_RELOAD = False


