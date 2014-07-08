#!/usr/bin/python


import vidsetup,  subprocess, sys

sys.path.append("/usr/local/google_appengine")

    
# Execute the code for generating css, compressing, minimizing, watching for modifications, etc.   
# This comes before the dev_appserver call because that call runs infinitely
vidsetup.customize_files()

from old_dev_appserver import *
run_file("/usr/local/google_appengine/old_dev_appserver.py", globals())

