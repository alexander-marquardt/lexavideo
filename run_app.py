#!/usr/bin/python

from build_support import prepare_build
import sys
import vidsetup

# Execute the code for generating css, compressing, minimizing, watching for modifications, etc.   
# This comes before the dev_appserver call because that call runs infinitely
prepare_build.customize_files(version_id = vidsetup.VERSION_ID)

if __name__ == "__main__":
    sys.path.append("/usr/local/google_appengine")    
    import dev_appserver
    
    # The following hack makes it appear that we are running the dev_appserver from the /usr/local/google_appengine directory,
    # which is required for the script to run properly.
    sys.argv[0] = "/usr/local/google_appengine/dev_appserver.py"
    dev_appserver._run_file("/usr/local/google_appengine/dev_appserver.py", globals())