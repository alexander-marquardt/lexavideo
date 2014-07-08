#!/usr/bin/python


import setup_video_project,  subprocess, sys

sys.path.append("/usr/local/google_appengine")

    
# Execute the code for generating css, compressing, minimizing, watching for modifications, etc.   
# This comes before the dev_appserver call because that call runs infinitely
setup_video_project.customize_files()

from old_dev_appserver import *
run_file("/usr/local/google_appengine/old_dev_appserver.py", globals())

# couldn't get the normal dev_appserver working like this, so it is "temporarily" commented out.
#from dev_appserver import *
#_run_file("/usr/local/google_appengine/dev_appserver.py", globals())
    

