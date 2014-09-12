#!/usr/bin/python

from build_support import prepare_build
import sys
import vidsetup

sys.path.append("/usr/local/google_appengine")

# Execute the code for generating css, compressing, minimizing, watching for modifications, etc.   
# This comes before the dev_appserver call because that call runs infinitely
prepare_build.customize_files(version_id = vidsetup.VERSION_ID)


if __name__ == "__main__":
    # if this is being called as a python script then run the developement server
    from old_dev_appserver import *
    run_file("/usr/local/google_appengine/old_dev_appserver.py", globals())