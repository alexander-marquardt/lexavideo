#!/usr/bin/python

from build_support import prepare_build
import sys
import vidsetup

# Execute the code for generating css, compressing, minimizing, watching for modifications, etc.   
# This comes before the dev_appserver call because that call runs infinitely
prepare_build.customize_files(version_id = vidsetup.VERSION_ID)

if __name__ == "__main__":
    sys.path.append("/usr/local/google_appengine")    
    
    # The following hack makes it appear that we are running the dev_appserver from the /usr/local/google_appengine directory,
    # which is required for the script to run properly.
    
    if '--use_old_dev_appserver' in sys.argv:
        # remove this option from sys.argv so that it doesn't cause problems in other parts of the code
        sys.argv = filter(lambda a: a != "--use_old_dev_appserver", sys.argv)
        
        import old_dev_appserver 
        old_dev_appserver.run_file("/usr/local/google_appengine/old_dev_appserver.py", globals())    
    else:
        import dev_appserver        
        sys.argv[0] = "/usr/local/google_appengine/dev_appserver.py"
        dev_appserver._run_file("/usr/local/google_appengine/dev_appserver.py", globals())        